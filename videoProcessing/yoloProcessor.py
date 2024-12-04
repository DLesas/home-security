from ultralytics import YOLO
import multiprocessing as mp
import numpy as np
import time
from typing import List, Optional, Dict, Any, Tuple
from queue import Empty, Full
import torch
import logging
from dataclasses import dataclass
from resourceManager import ResourceManager
from numpy.typing import NDArray
import torch.cuda
from collections import defaultdict
from performanceMonitor import measure_operation
from yoloClasses import yolo_classes

@dataclass
class BoundingBox:
    x_center: float  # Normalized center x coordinate (0-1)
    y_center: float  # Normalized center y coordinate (0-1)
    width: float     # Normalized width (0-1)
    height: float    # Normalized height (0-1)

@dataclass
class Detection:
    bbox: BoundingBox
    confidence: float
    class_id: int
    class_name: str
    class_color: Tuple[int, int, int]
    
@dataclass
class ProcessedFrame:
    frame_id: int
    stream_id: str
    timestamp: float
    frame: NDArray[np.uint8]
    detections: List[Detection]

class YOLOProcessor:
    def __init__(
        self,
        model_path: str,
        shared_queue: mp.Queue,
        result_queue: mp.Queue,
        performance_queue: mp.Queue,
        logging_queue: mp.Queue,
        drop_frames: mp.Value,
        processed_frames: mp.Value,
        memory_fraction: float = 0.6,
    ) -> None:
        self.logger = logging.getLogger(__name__)

        # Get optimal configuration
        self.num_workers = ResourceManager.get_optimal_process_count(min_cores_available=4)
        self.batch_size = 8
        # ResourceManager.calculate_optimal_batch_size(
        #     memory_fraction=memory_fraction,
        #     num_workers=self.num_workers
        # )

        self.model_path = model_path
        self.shared_queue = shared_queue
        self.result_queue = result_queue
        self.performance_queue = performance_queue
        self.logging_queue = logging_queue
        self.drop_frames = drop_frames
        self.processed_frames = processed_frames
        self.device = 'cuda' if torch.cuda.is_available() else 'cpu'
        self.processes: List[mp.Process] = []
        self.running = mp.Event()

    def start(self) -> None:
        """Start YOLO processing workers"""
        self.running.set()

        # Start worker processes
        for worker_id in range(self.num_workers):
            process = mp.Process(
                target=self._inference_worker,
                args=(
                    worker_id,
                    self.model_path,
                    self.shared_queue,
                    self.result_queue,
                    self.performance_queue,
                    self.processed_frames,
                    self.drop_frames,
                    self.logging_queue,
                    self.running,
                    self.batch_size,
                    self.device
                ),
                daemon=True
            )
            process.start()
            self.processes.append(process)

        self.logger.info(f"Started {self.num_workers} YOLO workers with batch size {self.batch_size}")

    def stop(self) -> None:
        """Stop all processes"""
        self.running.clear()

        # Drain the shared queue to unblock workers
        while not self.shared_queue.empty():
            try:
                self.shared_queue.get_nowait()
            except Empty:
                break

        for process in self.processes:
            process.join(timeout=2.0)
            if process.is_alive():
                process.terminate()
                process.join(timeout=1.0)
                if process.is_alive():
                    process.kill()  # Force kill if still alive
        self.processes.clear()
        self.logger.info("All YOLO workers stopped")

    @staticmethod
    def _inference_worker(
        worker_id: int,
        model_path: str,
        shared_queue: mp.Queue,
        result_queue: mp.Queue,
        performance_queue: mp.Queue,
        processed_frames: mp.Value,
        drop_frames: mp.Value,
        logging_queue: mp.Queue,
        running: mp.Event,
        batch_size: int,
        device: str,
    ) -> None:
        """Worker process for YOLO inference"""
        mp.current_process().name = f"YOLOProcessor-{worker_id}"

        stream_id = f"yoloProcessor-{worker_id}"  # Add stream ID for metrics

        try:
            # Initialize CUDA for this process
            if device == 'cuda':
                torch.cuda.init()
                torch.cuda.empty_cache()

            # Load model on specified device
            with measure_operation(performance_queue, stream_id, "model_load"):
                model = YOLO(model_path)
                model.to(device)

            logging_queue.put({
                "severity": "info",
                "message": f"Worker {worker_id} initialized on device: {device}"
            })

        except Exception as e:
            logging_queue.put({
                "severity": "error",
                "message": f"Worker {worker_id} initialization error: {e}"
            })
            return

        batch_frames: List[NDArray[np.uint8]] = []
        batch_metadata: List[Dict[str, Any]] = []

        while running.is_set():
            try:
                # Collect batch
                with measure_operation(performance_queue, stream_id, "batch_collection"):
                    while len(batch_frames) < batch_size:
                        try:
                            frame_data = shared_queue.get(timeout=0.01)
                            batch_frames.append(frame_data.frame)
                            batch_metadata.append({
                                'frame_id': frame_data.frame_id,
                                'stream_id': frame_data.stream_id,
                                'timestamp': frame_data.timestamp
                            })
                        except Empty:
                            break
        
                if not batch_frames:
                    time.sleep(0.01)
                    continue

                # Process batch
                with measure_operation(performance_queue, stream_id, "inference"):
                    results = model(batch_frames, verbose=False)

                # Process results
                with measure_operation(performance_queue, stream_id, "post_processing"):
                    for frame, metadata, result in zip(batch_frames, batch_metadata, results):
                        detections = YOLOProcessor._process_detections(result)
                        result_dict = ProcessedFrame(
                            **metadata,
                            frame=frame,
                            detections=detections
                        )

                        try:
                            result_queue.put(result_dict, timeout=0.1)
                            processed_frames.value += 1
                        except Full:
                            logging_queue.put({
                                "severity": "warning",
                                "message": f"Worker {worker_id}: Result queue full"
                            })
                            drop_frames.value += 1

                batch_frames.clear()
                batch_metadata.clear()

            except Exception as e:
                logging_queue.put({
                    "severity": "error",
                    "message": f"Worker {worker_id} error: {e}"
                })
                # Clear batches on error to prevent memory issues
                batch_frames.clear()
                batch_metadata.clear()
                time.sleep(0.1)  # Brief pause before retrying

    @staticmethod
    def _process_detections(result: Any) -> List[Detection]:
        """Convert YOLO results to standard format"""
        detections: List[Detection] = []
        for box in result.boxes:
            detections.append(Detection(
                bbox=BoundingBox(
                    x_center=float(box.xyxy[0][0]) / 640,
                    y_center=float(box.xyxy[0][1]) / 480,
                    width=float(box.xyxy[0][2]) / 640,
                    height=float(box.xyxy[0][3]) / 480
                ),
                confidence=float(box.conf[0]),
                class_id=int(box.cls[0]),
                class_name=yolo_classes[int(box.cls[0])]['name'],
                class_color=yolo_classes[int(box.cls[0])]['color']
            ))
        return detections

import multiprocessing as mp
from queue import Queue, Empty
import os
import time
import logging
from typing import Dict, Optional, List, TypedDict
import cv2
import numpy as np
from numpy.typing import NDArray
from performanceMonitor import MultiProcessMonitor
from frameGrabber import FrameGrabber
from yoloProcessor import YOLOProcessor, Detection
from visualizer import DetectionVisualizer
from faceDetector.faceDetectorManager import FaceDetectorManager, ProcessedFrame


def get_frames_with_people(results: list[ProcessedFrame]) -> tuple[list[ProcessedFrame], list[ProcessedFrame]]:
    leftover: list[ProcessedFrame] = []
    frames_with_people: list[ProcessedFrame] = []
    for result in results:
        if "person" in [detection.get("class_name") for detection in result.get("detections")]:
            frames_with_people.append(result)
        else:
            leftover.append(result)
    return frames_with_people, leftover


def create_shared_values() -> (
    Tuple[
        mp.Queue, mp.Queue, mp.Queue, mp.Queue, mp.Value, mp.Value, mp.Value, mp.Value
    ]
):
    frame_queue = mp.Queue(maxsize=120)
    result_queue = mp.Queue(maxsize=120)
    performance_queue = mp.Queue()
    logging_queue = mp.Queue()
    grabber_drop_frames = mp.Value("i", 0)
    grabber_processed_frames = mp.Value("i", 0)
    processor_drop_frames = mp.Value("i", 0)
    processor_processed_frames = mp.Value("i", 0)
    return (
        frame_queue,
        result_queue,
        performance_queue,
        logging_queue,
        grabber_drop_frames,
        grabber_processed_frames,
        processor_drop_frames,
        processor_processed_frames,
    )


def start_services(
    stream_configs: Dict[str, str],
    performance_queue: mp.Queue,
    logging_queue: mp.Queue,
    frame_queue: mp.Queue,
    result_queue: mp.Queue,
    grabber_processed_frames: mp.Value,
    grabber_drop_frames: mp.Value,
    processor_processed_frames: mp.Value,
    processor_drop_frames: mp.Value,
    general_yolo_model_path: str,
) -> Tuple[FrameGrabber, MultiProcessMonitor, YOLOProcessor, DetectionVisualizer]:
    # Initialize performance monitoring
    multi_process_monitor = MultiProcessMonitor(
        performance_queue=performance_queue,
        logging_queue=logging_queue,
        grabber_processed_frames=grabber_processed_frames,
        grabber_drop_frames=grabber_drop_frames,
        processor_processed_frames=processor_processed_frames,
        processor_drop_frames=processor_drop_frames,
        log_interval=5.0,
    )

    # Initialize system components
    grabber = FrameGrabber(
        stream_configs=stream_configs,
        shared_queue=frame_queue,
        performance_queue=performance_queue,
        logging_queue=logging_queue,
        processed_frames=grabber_processed_frames,
        drop_frames=grabber_drop_frames,
    )

    # Initialize YOLO processors
    processor = YOLOProcessor(
        model_path=general_yolo_model_path,
        shared_queue=frame_queue,
        result_queue=result_queue,
        performance_queue=performance_queue,
        logging_queue=logging_queue,
        processed_frames=processor_processed_frames,
        drop_frames=processor_drop_frames,
        memory_fraction=0.6,
    )

    # Initialize detection visualizer
    visualizer = DetectionVisualizer(performance_queue=performance_queue)

    # Start all components
    grabber.start()
    processor.start()

    return grabber, multi_process_monitor, processor, visualizer


def main() -> None:
    # Setup logging first, before any other operations
    logger = logging.getLogger(__name__)

    try:
        # Initialize paths and configs
        BASE_DIR = os.path.dirname(os.path.abspath(__file__))
        GENERAL_YOLO_MODEL_PATH = os.path.join(
            BASE_DIR, "yoloModels", "general", "yolo11l.pt"
        )
        FACE_YOLO_MODEL_PATH = os.path.join(
            BASE_DIR, "yoloModels", "face", "yolov11m-face.pt"
        )
        stream_configs = {
            "test camera": "udp://192.168.95.234:9000?fifo_size=50000000&overrun_nonfatal=1&flags=low_delay&fflags=nobuffer&probesize=32&analyzeduration=0",  # UDP stream configuration
        }

        # Create shared queues
        (
            frame_queue,
            result_queue,
            performance_queue,
            logging_queue,
            grabber_drop_frames,
            grabber_processed_frames,
            processor_drop_frames,
            processor_processed_frames,
        ) = create_shared_values()
        grabber, multi_process_monitor, processor, visualizer = start_services(
            stream_configs,
            performance_queue,
            logging_queue,
            frame_queue,
            result_queue,
            grabber_processed_frames,
            grabber_drop_frames,
            processor_processed_frames,
            processor_drop_frames,
            GENERAL_YOLO_MODEL_PATH,
            FACE_YOLO_MODEL_PATH,
        )

        logger.info("System running. Press 'q' to stop.")

        # Main processing loop
        while True:
            if cv2.waitKey(1) & 0xFF == ord("q"):
                break

            # Process monitoring queues and log if needed
            multi_process_monitor.process_queues()
            if multi_process_monitor.should_log():
                multi_process_monitor.log_metrics()

            try:
                # Get results with timeout to allow for keyboard interrupt
                result: list[ProcessedFrame] = result_queue.get(timeout=0.1)
                if isinstance(result, list):
                    frames_with_people, leftover = get_frames_with_people(result)
                    detections = FaceDetectorManager.process_frames_sync(frames_with_people)
                    #visualizer.update(frames_with_people)
                        # Send frames to face detection manager

            except Empty:
                continue

    except KeyboardInterrupt:
        logger.info("\nShutdown signal received")

    except Exception as e:
        logger.error(f"Fatal error: {e}")
        import traceback

        logger.error(traceback.format_exc())  # Added detailed error logging

    finally:
        # Cleanup
        logger.info("Stopping system components...")
        visualizer.cleanup()
        grabber.stop()
        processor.stop()
        multi_process_monitor.stop()
        logger.info("Shutdown complete")


if __name__ == "__main__":
    # Enable clean shutdown with Ctrl+C
    if os.name == "nt":  # Windows
        mp.set_start_method("spawn")

    # Freeze support for Windows
    mp.freeze_support()
    main()

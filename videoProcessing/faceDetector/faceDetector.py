import numpy as np
import torch
from typing import List, Optional
from numpy.typing import NDArray
import multiprocessing as mp
from ..faceRecognition.inception_resnet import InceptionResnetV1
from ultralytics.engine.results import Results
from yoloProcessor import measure_operation
from ultralytics import YOLO
from yoloProcessor import Detection, ProcessedFrame


class FaceDetector:
    """
    A face detection worker that processes frames using YOLO model.

    This class handles the loading and inference of a YOLO model for face detection.
    Each instance represents a worker that can process frames independently.

    Attributes:
        model_path (str): Path to the YOLO model file
        device (str): Device to run inference on ('cpu' or 'cuda')
        performance_queue (mp.Queue): Queue for reporting performance metrics
        worker_id (int): Unique identifier for this worker
        model (YOLO): Loaded YOLO model instance
    """

    def __init__(
        self, model_path: str, device: str, performance_queue: mp.Queue, worker_id: int
    ) -> None:
        """
        Initialize the FaceDetector.

        Args:
            model_path: Path to the YOLO model file
            device: Device to run inference on ('cpu' or 'cuda')
            performance_queue: Queue for performance metrics
            worker_id: Unique identifier for this worker
        """
        self.model_path = model_path
        self.device = device
        self.performance_queue = performance_queue
        self.worker_id = worker_id
        self.model = self.load_model()
        self.resnet = InceptionResnetV1(pretrained="vggface2").eval().to(self.device)

    def load_model(self) -> YOLO:
        """
        Load the YOLO model into memory.

        Returns:
            YOLO: Loaded model instance

        Note:
            Performance is measured and reported through the performance queue
        """
        with measure_operation(
            self.performance_queue,
            f"facedetector-{self.worker_id}",
            "facedetector_model_load",
        ):
            model = YOLO(self.model_path)
            model.to(self.device)
            return model

    def _chop_frames(self, frames: List[ProcessedFrame]) -> List[ProcessedFrame]:
        """
        Chop frames based on person detections.

        Args:
            frames: List of ProcessedFrame objects containing person detections

        Returns:
            List[ProcessedFrame]: List of new ProcessedFrame objects containing cropped frames
        """
        with measure_operation(
            self.performance_queue,
            f"facedetector-{self.worker_id}",
            "facedetector_inference_chop",
        ):
            chopped_frames: List[ProcessedFrame] = []

            # Iterate through each input frame
            for frame in frames:
                # Skip frames with no detections
                if not frame.detections:
                    continue

                # Filter for person detections
                person_detections: filter[Detection] = filter(
                    lambda d: d.class_name == "person", frame.detections
                )

                # Process each person detection
                for det in person_detections:
                    # Get frame dimensions
                    height, width = frame.frame.shape[:2]

                    # Convert normalized coordinates to pixel coordinates
                    y1 = int(det.bbox.y_center * height)
                    y2 = int((det.bbox.y_center + det.bbox.height) * height)
                    x1 = int(det.bbox.x_center * width)
                    x2 = int((det.bbox.x_center + det.bbox.width) * width)

                    # Create cropped frame
                    chopped_frame: ProcessedFrame = ProcessedFrame(
                        frame=frame.frame[y1:y2, x1:x2].copy(),
                        frame_id=frame.frame_id,
                        stream_id=frame.stream_id,
                        timestamp=frame.timestamp,
                        detections=[],
                    )
                    chopped_frames.append(chopped_frame)

            return chopped_frames

    def produce_embeddings(self, frames: List[ProcessedFrame]) -> List[List[Detection]]:
        """
        Produce embeddings for each frame.
        """
        self.resnet

    def detect(self, frames: List[ProcessedFrame]) -> List[List[Detection]]:
        """
        Perform face detection on a batch of frames.

        Args:
            frames: List of frames to process

        Returns:
            List[List[Detection]]: Detection results for each frame

        Note:
            Performance is measured and reported through the performance queue
        """
        chopped_frames = self._chop_frames(frames)
        with measure_operation(
            self.performance_queue,
            f"facedetector-{self.worker_id}",
            "facedetector_inference",
        ):
            results = self.model.predict(chopped_frames)
            embeddings = self.produce_embeddings(results)
            return results

    def cleanup(self) -> None:
        """
        Clean up resources used by the detector.

        This method should be called when the detector is no longer needed.
        """
        # Release CUDA memory if using GPU
        if hasattr(self.model, "model"):
            if hasattr(self.model.model, "cuda"):
                torch.cuda.empty_cache()

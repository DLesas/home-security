"""YOLO detection strategy using ultralytics with batch support."""

import logging
import os
from typing import List, Optional, Tuple

import cv2
import numpy as np
import torch
from ultralytics import YOLO

from models import DetectionBox, CameraObjectDetectionSettings
from .base_strategy import BaseDetectionStrategy

logger = logging.getLogger(__name__)

# Full COCO class mapping (80 classes)
COCO_CLASSES = {
    0: "person", 1: "bicycle", 2: "car", 3: "motorcycle", 4: "airplane",
    5: "bus", 6: "train", 7: "truck", 8: "boat", 9: "traffic light",
    10: "fire hydrant", 11: "stop sign", 12: "parking meter", 13: "bench",
    14: "bird", 15: "cat", 16: "dog", 17: "horse", 18: "sheep", 19: "cow",
    20: "elephant", 21: "bear", 22: "zebra", 23: "giraffe", 24: "backpack",
    25: "umbrella", 26: "handbag", 27: "tie", 28: "suitcase", 29: "frisbee",
    30: "skis", 31: "snowboard", 32: "sports ball", 33: "kite", 34: "baseball bat",
    35: "baseball glove", 36: "skateboard", 37: "surfboard", 38: "tennis racket",
    39: "bottle", 40: "wine glass", 41: "cup", 42: "fork", 43: "knife",
    44: "spoon", 45: "bowl", 46: "banana", 47: "apple", 48: "sandwich",
    49: "orange", 50: "broccoli", 51: "carrot", 52: "hot dog", 53: "pizza",
    54: "donut", 55: "cake", 56: "chair", 57: "couch", 58: "potted plant",
    59: "bed", 60: "dining table", 61: "toilet", 62: "tv", 63: "laptop",
    64: "mouse", 65: "remote", 66: "keyboard", 67: "cell phone", 68: "microwave",
    69: "oven", 70: "toaster", 71: "sink", 72: "refrigerator", 73: "book",
    74: "clock", 75: "vase", 76: "scissors", 77: "teddy bear", 78: "hair drier",
    79: "toothbrush",
}


class YOLOStrategy(BaseDetectionStrategy):
    """
    YOLO detection strategy with batch inference support.

    Supports yolov8, yolo11, yolo12 models with GPU acceleration.
    Does NOT cache models - loads fresh each time to avoid RAM issues.
    """

    def __init__(
        self,
        model_name: str,
        weights_dir: str = "/app/src/models/weights",
    ):
        self._model_name = model_name
        self._weights_dir = weights_dir
        self._model: Optional[YOLO] = None
        self._device: str = "cuda" if torch.cuda.is_available() else "cpu"

    @property
    def model_name(self) -> str:
        return self._model_name

    @property
    def is_loaded(self) -> bool:
        return self._model is not None

    def load(self) -> None:
        """Load YOLO model."""
        if self._model is not None:
            return

        weights_path = self._get_weights_path()
        logger.info(f"Loading {self._model_name} on {self._device}")

        self._model = YOLO(weights_path)
        self._model.to(self._device)
        logger.info(f"Model {self._model_name} loaded successfully")

    def unload(self) -> None:
        """Unload model from memory."""
        if self._model is not None:
            del self._model
            self._model = None
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
            logger.info(f"Model {self._model_name} unloaded")

    def detect(
        self,
        frames: List[Tuple[bytes, CameraObjectDetectionSettings]],
    ) -> List[List[DetectionBox]]:
        """
        Run batch YOLO detection on frames.

        Args:
            frames: List of (JPEG bytes, per-camera settings) tuples

        Returns:
            List of detection box lists, one per input frame
        """
        if not frames:
            return []

        # Lazy load
        if self._model is None:
            self.load()

        # Decode all frames and find minimum confidence
        images = []
        settings_list = []
        min_conf = 1.0

        for jpeg_bytes, settings in frames:
            np_arr = np.frombuffer(jpeg_bytes, np.uint8)
            img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

            if img is None:
                logger.warning("Failed to decode frame in batch")
                images.append(None)
            else:
                images.append(img)

            settings_list.append(settings)

            # Track global minimum confidence for batch inference
            frame_min = settings.get_min_confidence()
            if frame_min is not None and frame_min < min_conf:
                min_conf = frame_min

        # Filter out None images and track indices
        valid_indices = [i for i, img in enumerate(images) if img is not None]
        valid_images = [images[i] for i in valid_indices]

        if not valid_images:
            return [[] for _ in frames]

        # Run batch inference
        results = self._model.predict(
            valid_images,
            conf=min_conf,
            verbose=False,
            device=self._device,
        )

        # Process results for each frame
        all_boxes: List[List[DetectionBox]] = [[] for _ in frames]

        for result_idx, result in enumerate(results):
            frame_idx = valid_indices[result_idx]
            settings = settings_list[frame_idx]

            if result.boxes is None:
                continue

            frame_boxes = []
            for box in result.boxes:
                class_id = int(box.cls[0])
                confidence = float(box.conf[0])

                # Get class name from COCO mapping
                class_name = COCO_CLASSES.get(class_id)
                if class_name is None:
                    continue

                # Check if class is enabled and passes per-camera threshold
                threshold = settings.get_confidence_threshold(class_name)
                if threshold is None:
                    continue
                if confidence < threshold:
                    continue

                # Extract coordinates
                xyxy = box.xyxy[0].cpu().numpy()

                frame_boxes.append(DetectionBox(
                    class_id=class_id,
                    class_name=class_name,
                    confidence=confidence,
                    x1=float(xyxy[0]),
                    y1=float(xyxy[1]),
                    x2=float(xyxy[2]),
                    y2=float(xyxy[3]),
                ))

            all_boxes[frame_idx] = frame_boxes

        return all_boxes

    def _get_weights_path(self) -> str:
        """Get path to model weights."""
        # Check for local weights file
        local_path = os.path.join(self._weights_dir, f"{self._model_name}.pt")
        if os.path.exists(local_path):
            logger.info(f"Using local weights: {local_path}")
            return local_path

        # Use model name directly - ultralytics will auto-download
        logger.info(f"Local weights not found, will download {self._model_name}")
        return f"{self._model_name}.pt"

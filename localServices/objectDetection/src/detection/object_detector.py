"""Object detector - runs YOLO on frames with zone filtering."""

import logging
import threading
import time
from typing import List, Optional, Set, Tuple

from config import GlobalConfigManager
from models import DetectionResult, CameraObjectDetectionSettings
from .strategies import YOLOStrategy, BaseDetectionStrategy
from .zone_filter import filter_detections_by_zones

logger = logging.getLogger(__name__)


class ObjectDetector:
    """
    Runs object detection on frames.

    - Uses global model from GlobalConfigManager
    - Keeps model loaded in GPU memory until model changes
    - Filters detections by zones with motion
    """

    def __init__(
        self,
        global_config: GlobalConfigManager,
        weights_dir: str = "/app/src/models/weights",
    ):
        self._global_config = global_config
        self._weights_dir = weights_dir
        self._strategy: Optional[BaseDetectionStrategy] = None
        self._current_model: Optional[str] = None
        self._lock = threading.Lock()  # Protects model swap during inference

        # Register for model change callbacks
        global_config.on_model_change(self._on_model_change)

    def start(self) -> None:
        """Load the initial model."""
        self._load_model(self._global_config.model)

    def stop(self) -> None:
        """Unload the model."""
        if self._strategy:
            self._strategy.unload()
            self._strategy = None
            self._current_model = None

    def _on_model_change(self, old_model: str, new_model: str) -> None:
        """Handle model change from global config."""
        logger.info(f"Model change detected: {old_model} -> {new_model}")
        self._load_model(new_model)

    def _load_model(self, model_name: str) -> None:
        """Load a new model, unloading the previous one. Thread-safe."""
        with self._lock:
            if self._strategy:
                self._strategy.unload()

            self._strategy = YOLOStrategy(
                model_name=model_name,
                weights_dir=self._weights_dir,
            )
            self._strategy.load()
            self._current_model = model_name
            logger.info(f"Model {model_name} loaded and ready")

    def detect_batch(
        self,
        frames: List[Tuple[str, int, bytes, CameraObjectDetectionSettings, Set[str]]],
    ) -> List[DetectionResult]:
        """
        Run object detection on a batch of frames.

        Args:
            frames: List of tuples:
                - camera_id: Camera identifier
                - timestamp: Frame timestamp
                - jpeg_bytes: JPEG frame data
                - settings: Per-camera settings (classConfigs, zones)
                - zones_with_motion: Set of zone IDs that have motion

        Returns:
            List of DetectionResult objects
        """
        if not frames:
            return []

        # Lock to prevent model swap during inference
        with self._lock:
            if not self._strategy or not self._strategy.is_loaded:
                logger.error("Model not loaded")
                return []

            start_time = time.perf_counter()
            current_model = self._current_model  # Capture model name under lock

            # Prepare frames for batch detection
            detection_inputs = [
                (jpeg_bytes, settings)
                for _, _, jpeg_bytes, settings, _ in frames
            ]

            # Run batch detection
            all_boxes = self._strategy.detect(detection_inputs)

        # Build results with zone filtering (outside lock, using captured values)
        # Calculate per-frame processing time once (total inference time / frame count)
        total_inference_ms = (time.perf_counter() - start_time) * 1000
        per_frame_ms = total_inference_ms / len(frames)

        results = []
        for i, (camera_id, timestamp, _, settings, zones_with_motion) in enumerate(frames):
            boxes = all_boxes[i]

            # Filter by zones with motion
            filtered_boxes = filter_detections_by_zones(
                boxes=boxes,
                zones=settings.motion_zones,
                zones_with_motion=zones_with_motion,
            )

            results.append(DetectionResult(
                camera_id=camera_id,
                timestamp=timestamp,
                model_used=current_model,
                processing_time_ms=per_frame_ms,
                boxes=filtered_boxes,
            ))

        total_time_ms = (time.perf_counter() - start_time) * 1000
        total_detections = sum(len(r.boxes) for r in results)
        logger.debug(
            f"Batch detection: {len(frames)} frames, {total_detections} detections, "
            f"{total_time_ms:.1f}ms total"
        )

        return results

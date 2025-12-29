"""KNN background subtractor strategy for motion detection."""

import logging
from typing import Any, Optional

import cv2
import numpy as np

from .base_strategy import ProcessingStrategy
from models import FrameInput, ForegroundMask, CameraState, MotionDetectionSettings, KNNSettings
from utils.gpu_detection import detect_gpu_capabilities

logger = logging.getLogger(__name__)


class KNNStrategy(ProcessingStrategy):
    """
    KNN (K-Nearest Neighbors) background subtractor motion detection.

    Similar to MOG2 but uses a different algorithm that can be better at
    handling shadows and gradual changes in the background.

    Supports both CPU and GPU processing (auto-detected at init time).
    """

    def __init__(self):
        """Initialize strategy and detect GPU capabilities."""
        gpu_caps = detect_gpu_capabilities()
        self._use_gpu = gpu_caps.gpu_available

        if self._use_gpu:
            logger.info("KNNStrategy initialized with GPU support")
        else:
            logger.info("KNNStrategy initialized with CPU processing")

    @property
    def name(self) -> str:
        return f"KNN ({'GPU' if self._use_gpu else 'CPU'})"

    def create_detector(
        self,
        camera_id: str,
        camera_name: str,
        settings: MotionDetectionSettings,
    ) -> Any:
        """Create KNN background subtractor with settings from Redis."""
        model_settings = settings.model_settings

        # Extract KNN-specific settings
        history = 500
        dist2_threshold = 400.0
        detect_shadows = False

        if isinstance(model_settings, KNNSettings):
            history = model_settings.history
            dist2_threshold = model_settings.dist2_threshold
            detect_shadows = model_settings.detect_shadows

        if self._use_gpu:
            detector = self._create_gpu_detector(
                camera_name, history, dist2_threshold, detect_shadows
            )
        else:
            detector = self._create_cpu_detector(
                camera_name, history, dist2_threshold, detect_shadows
            )

        return detector

    def _create_cpu_detector(
        self,
        camera_name: str,
        history: int,
        dist2_threshold: float,
        detect_shadows: bool,
    ) -> Any:
        """Create CPU KNN background subtractor."""
        detector = cv2.createBackgroundSubtractorKNN(
            history=history,
            dist2Threshold=dist2_threshold,
            detectShadows=detect_shadows,
        )
        logger.debug(
            f"Created CPU KNN for '{camera_name}': "
            f"history={history}, "
            f"dist2Threshold={dist2_threshold}, "
            f"detectShadows={detect_shadows}"
        )
        return detector

    def _create_gpu_detector(
        self,
        camera_name: str,
        history: int,
        dist2_threshold: float,
        detect_shadows: bool,
    ) -> Any:
        """Create GPU (CUDA) KNN background subtractor."""
        # Note: cv2.cuda.createBackgroundSubtractorKNN may not be available
        # in all OpenCV builds. Fall back to CPU if not available.
        try:
            detector = cv2.cuda.createBackgroundSubtractorKNN(
                history=history,
                dist2Threshold=dist2_threshold,
                detectShadows=detect_shadows,
            )
            logger.debug(
                f"Created GPU KNN for '{camera_name}': "
                f"history={history}, "
                f"dist2Threshold={dist2_threshold}, "
                f"detectShadows={detect_shadows}"
            )
            return detector
        except AttributeError:
            logger.warning(
                f"CUDA KNN not available for '{camera_name}', falling back to CPU"
            )
            self._use_gpu = False
            return self._create_cpu_detector(
                camera_name, history, dist2_threshold, detect_shadows
            )

    def process_frame(
        self,
        frame_input: FrameInput,
        state: CameraState,
    ) -> ForegroundMask:
        """Process a single frame using KNN background subtraction."""
        # Decode JPEG
        nparr = np.frombuffer(frame_input.jpeg_buffer, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if frame is None:
            raise ValueError(f"Failed to decode frame for '{state.camera_name}'")

        if self._use_gpu:
            fg_mask = self._process_gpu(frame, state.detector)
        else:
            fg_mask = self._process_cpu(frame, state.detector)

        return ForegroundMask(
            camera_id=frame_input.camera_id,
            mask=fg_mask,
            frame_shape=frame.shape,
        )

    def _process_cpu(self, frame: np.ndarray, detector: Any) -> np.ndarray:
        """Process frame on CPU."""
        # Apply KNN background subtraction
        fg_mask = detector.apply(frame, learningRate=-1)
        return fg_mask

    def _process_gpu(self, frame: np.ndarray, detector: Any) -> np.ndarray:
        """Process frame on GPU using CUDA."""
        # Upload frame to GPU
        gpu_frame = cv2.cuda_GpuMat()
        gpu_frame.upload(frame)

        # Apply KNN background subtraction on GPU
        gpu_mask = detector.apply(gpu_frame, learningRate=-1)

        # Download result
        fg_mask = gpu_mask.download()

        return fg_mask

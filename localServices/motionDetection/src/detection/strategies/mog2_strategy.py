"""MOG2 background subtractor strategy for motion detection."""

import logging
from typing import Any, Optional

import cv2
import numpy as np

from .base_strategy import ProcessingStrategy
from models import FrameInput, ForegroundMask, CameraState, MotionDetectionSettings, MOG2Settings
from utils.gpu_detection import detect_gpu_capabilities

logger = logging.getLogger(__name__)


class MOG2Strategy(ProcessingStrategy):
    """
    MOG2 (Mixture of Gaussians) background subtractor motion detection.

    This is the default detection model. Uses adaptive background modeling
    to detect moving objects. Works well for static cameras with changing
    lighting conditions.

    Supports both CPU and GPU processing (auto-detected at init time).
    """

    def __init__(self):
        """Initialize strategy and detect GPU capabilities."""
        gpu_caps = detect_gpu_capabilities()
        self._use_gpu = gpu_caps.gpu_available

        if self._use_gpu:
            logger.info("MOG2Strategy initialized with GPU support")
        else:
            logger.info("MOG2Strategy initialized with CPU processing")

    @property
    def name(self) -> str:
        return f"MOG2 ({'GPU' if self._use_gpu else 'CPU'})"

    def create_detector(
        self,
        camera_id: str,
        camera_name: str,
        settings: MotionDetectionSettings,
    ) -> Any:
        """Create MOG2 background subtractor with settings from Redis."""
        model_settings = settings.model_settings

        # Extract MOG2-specific settings
        history = 500
        var_threshold = 16.0
        detect_shadows = False

        if isinstance(model_settings, MOG2Settings):
            history = model_settings.history
            var_threshold = model_settings.var_threshold
            detect_shadows = model_settings.detect_shadows

        if self._use_gpu:
            detector = self._create_gpu_detector(
                camera_name, history, var_threshold, detect_shadows
            )
        else:
            detector = self._create_cpu_detector(
                camera_name, history, var_threshold, detect_shadows
            )

        return detector

    def _create_cpu_detector(
        self,
        camera_name: str,
        history: int,
        var_threshold: float,
        detect_shadows: bool,
    ) -> Any:
        """Create CPU MOG2 background subtractor."""
        detector = cv2.createBackgroundSubtractorMOG2(
            history=history,
            varThreshold=var_threshold,
            detectShadows=detect_shadows,
        )
        logger.debug(
            f"Created CPU MOG2 for '{camera_name}': "
            f"history={history}, "
            f"varThreshold={var_threshold}, "
            f"detectShadows={detect_shadows}"
        )
        return detector

    def _create_gpu_detector(
        self,
        camera_name: str,
        history: int,
        var_threshold: float,
        detect_shadows: bool,
    ) -> Any:
        """Create GPU (CUDA) MOG2 background subtractor."""
        detector = cv2.cuda.createBackgroundSubtractorMOG2(
            history=history,
            varThreshold=var_threshold,
            detectShadows=detect_shadows,
        )
        logger.debug(
            f"Created GPU MOG2 for '{camera_name}': "
            f"history={history}, "
            f"varThreshold={var_threshold}, "
            f"detectShadows={detect_shadows}"
        )
        return detector

    def process_frame(
        self,
        frame_input: FrameInput,
        state: CameraState,
    ) -> ForegroundMask:
        """Process a single frame using MOG2 background subtraction."""
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
        # Apply MOG2 background subtraction
        fg_mask = detector.apply(frame, learningRate=-1)
        return fg_mask

    def _process_gpu(self, frame: np.ndarray, detector: Any) -> np.ndarray:
        """Process frame on GPU using CUDA."""
        # Upload frame to GPU
        gpu_frame = cv2.cuda_GpuMat()
        gpu_frame.upload(frame)

        # Apply MOG2 background subtraction on GPU
        gpu_mask = detector.apply(gpu_frame, learningRate=-1)

        # Download result
        fg_mask = gpu_mask.download()

        return fg_mask

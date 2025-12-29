"""Simple frame difference strategy for motion detection."""

import logging
from typing import Any, Dict, Optional

import cv2
import numpy as np

from .base_strategy import ProcessingStrategy
from models import FrameInput, ForegroundMask, CameraState, MotionDetectionSettings, SimpleDiffSettings
from utils.gpu_detection import detect_gpu_capabilities

logger = logging.getLogger(__name__)


class SimpleDiffStrategy(ProcessingStrategy):
    """
    Simple frame difference motion detection.

    Computes absolute difference between consecutive frames, converts to
    grayscale, and applies a threshold to create a motion mask.

    This strategy manages its own internal state (previous frames per camera)
    since SimpleDiff doesn't use a background subtractor.

    Supports both CPU and GPU processing (auto-detected at init time).
    """

    def __init__(self):
        """Initialize strategy and detect GPU capabilities."""
        gpu_caps = detect_gpu_capabilities()
        self._use_gpu = gpu_caps.gpu_available
        self._previous_frames: Dict[str, np.ndarray] = {}

        if self._use_gpu:
            logger.info("SimpleDiffStrategy initialized with GPU support")
        else:
            logger.info("SimpleDiffStrategy initialized with CPU processing")

    @property
    def name(self) -> str:
        return f"SimpleDiff ({'GPU' if self._use_gpu else 'CPU'})"

    def create_detector(
        self,
        camera_id: str,
        camera_name: str,
        settings: MotionDetectionSettings,
    ) -> Optional[Any]:
        """
        SimpleDiff doesn't use a background subtractor.

        Returns None as the detector; state is managed internally via _previous_frames.
        """
        model_settings = settings.model_settings
        if isinstance(model_settings, SimpleDiffSettings):
            logger.debug(
                f"SimpleDiff for '{camera_name}': threshold={model_settings.threshold}"
            )
        return None

    def process_frame(
        self,
        frame_input: FrameInput,
        state: CameraState,
    ) -> ForegroundMask:
        """Process a single frame using simple frame difference."""
        camera_id = frame_input.camera_id

        # Decode JPEG
        nparr = np.frombuffer(frame_input.jpeg_buffer, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if frame is None:
            raise ValueError(f"Failed to decode frame for '{state.camera_name}'")

        # Get threshold from settings
        model_settings = state.settings.model_settings
        threshold = 25  # Default
        if isinstance(model_settings, SimpleDiffSettings):
            threshold = model_settings.threshold

        # Get previous frame
        prev_frame = self._previous_frames.get(camera_id)

        if prev_frame is None:
            # First frame - store and return empty mask
            self._previous_frames[camera_id] = frame.copy()
            return ForegroundMask(
                camera_id=camera_id,
                mask=np.zeros(frame.shape[:2], dtype=np.uint8),
                frame_shape=frame.shape,
            )

        # Process using GPU or CPU
        if self._use_gpu:
            fg_mask = self._process_gpu(frame, prev_frame, threshold)
        else:
            fg_mask = self._process_cpu(frame, prev_frame, threshold)

        # Store current frame for next iteration
        self._previous_frames[camera_id] = frame.copy()

        return ForegroundMask(
            camera_id=camera_id,
            mask=fg_mask,
            frame_shape=frame.shape,
        )

    def _process_cpu(
        self,
        frame: np.ndarray,
        prev_frame: np.ndarray,
        threshold: int,
    ) -> np.ndarray:
        """Process frame difference on CPU."""
        # Compute absolute difference
        diff = cv2.absdiff(frame, prev_frame)

        # Convert to grayscale
        gray_diff = cv2.cvtColor(diff, cv2.COLOR_BGR2GRAY)

        # Apply threshold
        _, fg_mask = cv2.threshold(gray_diff, threshold, 255, cv2.THRESH_BINARY)

        return fg_mask

    def _process_gpu(
        self,
        frame: np.ndarray,
        prev_frame: np.ndarray,
        threshold: int,
    ) -> np.ndarray:
        """Process frame difference on GPU using CUDA."""
        # Upload frames to GPU
        gpu_frame = cv2.cuda_GpuMat()
        gpu_prev = cv2.cuda_GpuMat()
        gpu_frame.upload(frame)
        gpu_prev.upload(prev_frame)

        # Compute absolute difference on GPU
        gpu_diff = cv2.cuda.absdiff(gpu_frame, gpu_prev)

        # Convert to grayscale on GPU
        gpu_gray = cv2.cuda.cvtColor(gpu_diff, cv2.COLOR_BGR2GRAY)

        # Apply threshold on GPU
        _, gpu_mask = cv2.cuda.threshold(gpu_gray, threshold, 255, cv2.THRESH_BINARY)

        # Download result
        fg_mask = gpu_mask.download()

        return fg_mask

    def cleanup_camera(self, camera_id: str) -> None:
        """Clean up previous frame storage for removed camera."""
        if camera_id in self._previous_frames:
            del self._previous_frames[camera_id]
            logger.debug(f"Cleaned up SimpleDiff state for camera {camera_id}")

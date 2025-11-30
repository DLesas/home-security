"""CPU-based motion detection strategy using OpenCV MOG2."""

import logging
from typing import List, Dict, Any, Optional

import cv2
import numpy as np

from .base_strategy import ProcessingStrategy
from models import FrameInput, ForegroundMask, CameraState, MOG2Settings

logger = logging.getLogger(__name__)


class CPUProcessingStrategy(ProcessingStrategy):
    """
    CPU-based motion detection using OpenCV MOG2.

    Processes frames sequentially on CPU. Suitable for systems without
    CUDA GPU support or when GPU resources are limited.
    """

    @property
    def name(self) -> str:
        return "CPU"

    def create_detector(
        self,
        camera_id: str,
        camera_name: str,
        mog2_settings: MOG2Settings,
    ) -> Any:
        """Create CPU MOG2 background subtractor with settings from Redis."""
        detector = cv2.createBackgroundSubtractorMOG2(
            history=mog2_settings.history,
            varThreshold=mog2_settings.var_threshold,
            detectShadows=mog2_settings.detect_shadows,
        )
        logger.debug(
            f"Created CPU MOG2 for '{camera_name}': "
            f"history={mog2_settings.history}, "
            f"varThreshold={mog2_settings.var_threshold}, "
            f"detectShadows={mog2_settings.detect_shadows}"
        )
        return detector

    def create_stream(self, camera_id: str, camera_name: str) -> Optional[Any]:
        """CPU doesn't use streams."""
        return None

    def process_frame(
        self,
        frame_input: FrameInput,
        state: CameraState,
    ) -> ForegroundMask:
        """Process a single frame on CPU."""
        # Decode JPEG
        nparr = np.frombuffer(frame_input.jpeg_buffer, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if frame is None:
            raise ValueError(f"Failed to decode frame for '{state.camera_name}'")

        # Apply MOG2 background subtraction
        fg_mask = state.detector.apply(frame, learningRate=-1)

        return ForegroundMask(
            camera_id=frame_input.camera_id,
            mask=fg_mask,
            frame_shape=frame.shape,
        )

    def process_batch(
        self,
        frames: List[FrameInput],
        states: Dict[str, CameraState],
    ) -> List[ForegroundMask]:
        """Process frames sequentially on CPU."""
        results = []

        for frame_input in frames:
            state = states.get(frame_input.camera_id)
            if state is None:
                logger.warning(f"No state for camera {state.camera_name}, skipping")
                continue

            try:
                result = self.process_frame(frame_input, state)
                results.append(result)
            except ValueError as e:
                logger.error(f"Error processing frame for '{state.camera_name}': {e}")

        return results

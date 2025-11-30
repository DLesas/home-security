"""GPU-based motion detection strategy using OpenCV CUDA MOG2."""

import logging
from typing import List, Dict, Any, Optional

import cv2
import numpy as np

from .base_strategy import ProcessingStrategy
from models import FrameInput, ForegroundMask, CameraState, MOG2Settings

logger = logging.getLogger(__name__)


class GPUProcessingStrategy(ProcessingStrategy):
    """
    GPU-based motion detection using OpenCV CUDA MOG2.

    Uses deferred downloads mode - launches all GPU operations first,
    then downloads results. Provides good parallelism without explicit
    CUDA streams.
    """

    @property
    def name(self) -> str:
        return "GPU"

    def create_detector(
        self,
        camera_id: str,
        camera_name: str,
        mog2_settings: MOG2Settings,
    ) -> Any:
        """Create CUDA MOG2 background subtractor with settings from Redis."""
        detector = cv2.cuda.createBackgroundSubtractorMOG2(
            history=mog2_settings.history,
            varThreshold=mog2_settings.var_threshold,
            detectShadows=mog2_settings.detect_shadows,
        )
        logger.debug(
            f"Created GPU MOG2 for '{camera_name}': "
            f"history={mog2_settings.history}, "
            f"varThreshold={mog2_settings.var_threshold}, "
            f"detectShadows={mog2_settings.detect_shadows}"
        )
        return detector

    def create_stream(self, camera_id: str, camera_name: str) -> Optional[Any]:
        """Deferred mode doesn't use explicit streams."""
        return None

    def process_frame(
        self,
        frame_input: FrameInput,
        state: CameraState,
    ) -> ForegroundMask:
        """Process a single frame on GPU."""
        # Decode JPEG on CPU
        nparr = np.frombuffer(frame_input.jpeg_buffer, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if frame is None:
            raise ValueError(f"Failed to decode frame for '{state.camera_name}'")

        # Upload to GPU, apply MOG2, download result
        gpu_frame = cv2.cuda_GpuMat()
        gpu_frame.upload(frame)
        fg_mask_gpu = state.detector.apply(gpu_frame, learningRate=-1)
        fg_mask = fg_mask_gpu.download()

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
        """
        Process frames with deferred downloads.

        Launches all GPU operations first, then downloads all results.
        This allows some GPU parallelism without explicit streams.
        """
        gpu_ops = []

        # Launch all GPU operations
        for frame_input in frames:
            state = states.get(frame_input.camera_id)
            if state is None:
                logger.warning(f"No state for camera ID {frame_input.camera_id}, skipping")
                continue

            try:
                # Decode JPEG on CPU
                nparr = np.frombuffer(frame_input.jpeg_buffer, np.uint8)
                frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

                if frame is None:
                    logger.error(f"Failed to decode frame for '{state.camera_name}'")
                    continue

                # Upload and apply MOG2 (don't download yet)
                gpu_frame = cv2.cuda_GpuMat()
                gpu_frame.upload(frame)
                fg_mask_gpu = state.detector.apply(gpu_frame, learningRate=-1)

                gpu_ops.append({
                    'camera_id': frame_input.camera_id,
                    'camera_name': state.camera_name,
                    'fg_mask_gpu': fg_mask_gpu,
                    'frame_shape': frame.shape,
                })

            except Exception as e:
                logger.error(f"GPU operation error for '{state.camera_name}': {e}")

        # Download all results
        results = []
        for op in gpu_ops:
            try:
                fg_mask = op['fg_mask_gpu'].download()
                results.append(ForegroundMask(
                    camera_id=op['camera_id'],
                    mask=fg_mask,
                    frame_shape=op['frame_shape'],
                ))
            except Exception as e:
                logger.error(f"Result download error for '{op['camera_name']}': {e}")

        return results

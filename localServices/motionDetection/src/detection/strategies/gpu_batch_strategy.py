"""GPU batch processing strategy using CUDA streams for true parallelism."""

import logging
from typing import List, Dict, Any, Optional

import cv2
import numpy as np

from .base_strategy import ProcessingStrategy
from models import FrameInput, ForegroundMask, CameraState, MOG2Settings

logger = logging.getLogger(__name__)


class GPUBatchProcessingStrategy(ProcessingStrategy):
    """
    GPU-based motion detection using CUDA streams for true parallelism.

    Each camera gets its own CUDA stream, allowing truly parallel execution
    of GPU operations across cameras. Provides maximum throughput for
    multi-camera setups.
    """

    @property
    def name(self) -> str:
        return "GPU-Batch"

    @property
    def supports_batch_parallel(self) -> bool:
        return True

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
        """Create CUDA stream for parallel processing."""
        stream = cv2.cuda_Stream()
        logger.debug(f"Created CUDA stream for '{camera_name}'")
        return stream

    def process_frame(
        self,
        frame_input: FrameInput,
        state: CameraState,
    ) -> ForegroundMask:
        """Process a single frame using CUDA stream."""
        # Decode JPEG on CPU
        nparr = np.frombuffer(frame_input.jpeg_buffer, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if frame is None:
            raise ValueError(f"Failed to decode frame for '{state.camera_name}'")

        # Upload to GPU using stream, apply MOG2, wait, download
        gpu_frame = cv2.cuda_GpuMat()
        gpu_frame.upload(frame, stream=state.stream)
        fg_mask_gpu = state.detector.apply(gpu_frame, learningRate=-1)
        state.stream.waitForCompletion()
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
        Process frames in parallel using per-camera CUDA streams.

        Launches all GPU operations asynchronously on separate streams,
        then synchronizes and downloads results.
        """
        pending = []

        # Launch all GPU operations asynchronously
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

                # Upload using stream and apply MOG2 (async)
                gpu_frame = cv2.cuda_GpuMat()
                gpu_frame.upload(frame, stream=state.stream)
                fg_mask_gpu = state.detector.apply(gpu_frame, learningRate=-1)

                pending.append({
                    'camera_id': frame_input.camera_id,
                    'camera_name': state.camera_name,
                    'fg_mask_gpu': fg_mask_gpu,
                    'stream': state.stream,
                    'frame_shape': frame.shape,
                })

            except Exception as e:
                logger.error(f"GPU operation error for '{state.camera_name}': {e}")

        # Wait for all streams and download results
        results = []
        for op in pending:
            try:
                op['stream'].waitForCompletion()
                fg_mask = op['fg_mask_gpu'].download()
                results.append(ForegroundMask(
                    camera_id=op['camera_id'],
                    mask=fg_mask,
                    frame_shape=op['frame_shape'],
                ))
            except Exception as e:
                logger.error(f"Result download error for '{op['camera_name']}': {e}")

        return results

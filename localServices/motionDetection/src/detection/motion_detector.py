"""Motion detector with pluggable processing strategies."""

import logging
import time
from typing import Dict, List, Optional

from .strategies import (
    ProcessingStrategy,
    CPUProcessingStrategy,
    GPUProcessingStrategy,
    GPUBatchProcessingStrategy,
)
from .mask_analyzer import MaskAnalyzer
from models import (
    FrameInput,
    MotionResult,
    CameraState,
    MotionDetectionSettings,
    MOG2Settings,
)
from utils import detect_gpu_capabilities

logger = logging.getLogger(__name__)


class MotionDetector:
    """
    Motion detector with pluggable processing strategies.

    Automatically selects the best strategy based on GPU availability:
    - No GPU: CPUProcessingStrategy
    - GPU without streams: GPUProcessingStrategy (deferred downloads)
    - GPU with streams: GPUBatchProcessingStrategy (true parallel)

    Lifecycle:
    - add_camera(): Create MOG2 instance with settings from Redis
    - remove_camera(): Destroy MOG2 instance, free memory
    - update_camera(): Smart update - only resets MOG2 if MOG2 settings changed
    """

    def __init__(self, strategy: Optional[ProcessingStrategy] = None):
        """
        Initialize motion detector.

        Args:
            strategy: Processing strategy (auto-detected if None)
        """
        self._states: Dict[str, CameraState] = {}
        self._analyzer = MaskAnalyzer()

        # Auto-detect strategy if not provided
        if strategy is None:
            self._strategy = self._auto_select_strategy()
        else:
            self._strategy = strategy

        logger.info(f"MotionDetector initialized with {self._strategy.name} strategy")

    def _auto_select_strategy(self) -> ProcessingStrategy:
        """Auto-select the best processing strategy based on hardware."""
        gpu_info = detect_gpu_capabilities()

        if not gpu_info.gpu_available:
            return CPUProcessingStrategy()
        elif gpu_info.cuda_streams_available:
            return GPUBatchProcessingStrategy()
        else:
            return GPUProcessingStrategy()

    def _mog2_settings_changed(
        self,
        old_settings: MOG2Settings,
        new_settings: MOG2Settings,
    ) -> bool:
        """
        Check if MOG2 settings changed (requires detector reset).

        Args:
            old_settings: Previous MOG2 settings
            new_settings: New MOG2 settings

        Returns:
            True if detector needs to be reset
        """
        return (
            old_settings.history != new_settings.history or
            old_settings.var_threshold != new_settings.var_threshold or
            old_settings.detect_shadows != new_settings.detect_shadows
        )

    # =========================================================================
    # Camera Lifecycle
    # =========================================================================

    def add_camera(
        self,
        camera_id: str,
        camera_name: str,
        settings: MotionDetectionSettings,
    ) -> None:
        """
        Add a camera with settings from Redis.

        Args:
            camera_id: Unique camera identifier
            camera_name: Human-readable camera name
            settings: Motion detection settings from Redis
        """
        if camera_id in self._states:
            logger.warning(f"Camera '{camera_name}' already exists, skipping add")
            return

        # Create detector with MOG2 settings from Redis
        detector = self._strategy.create_detector(
            camera_id,
            camera_name,
            settings.mog2,
        )

        # Create stream if strategy uses them
        stream = self._strategy.create_stream(camera_id, camera_name)

        # Store state
        self._states[camera_id] = CameraState(
            camera_id=camera_id,
            camera_name=camera_name,
            detector=detector,
            settings=settings,
            stream=stream,
        )

        logger.info(
            f"Added camera '{camera_name}' with {len(settings.zones)} zone(s), "
            f"MOG2: history={settings.mog2.history}, "
            f"varThreshold={settings.mog2.var_threshold}"
        )

    def remove_camera(self, camera_id: str) -> None:
        """
        Remove a camera and cleanup its resources.

        Args:
            camera_id: Camera to remove
        """
        state = self._states.get(camera_id)
        if state is None:
            logger.warning(f"Camera ID {camera_id} not found, skipping remove")
            return

        camera_name = state.camera_name
        del self._states[camera_id]
        logger.info(f"Removed camera '{camera_name}'")

    def update_camera(
        self,
        camera_id: str,
        camera_name: str,
        settings: MotionDetectionSettings,
    ) -> None:
        """
        Update camera settings, only resetting MOG2 if necessary.

        MOG2 detector is reset only if MOG2 settings (history, var_threshold,
        detect_shadows) changed. Zone changes don't require MOG2 reset.

        Args:
            camera_id: Camera to update
            camera_name: Human-readable camera name
            settings: New motion detection settings from Redis
        """
        state = self._states.get(camera_id)

        if state is None:
            # Camera doesn't exist, just add it
            self.add_camera(camera_id, camera_name, settings)
            return

        old_mog2 = state.settings.mog2
        new_mog2 = settings.mog2

        if self._mog2_settings_changed(old_mog2, new_mog2):
            # MOG2 settings changed - need full reset
            logger.info(
                f"MOG2 settings changed for '{camera_name}', resetting detector "
                f"(history: {old_mog2.history}->{new_mog2.history}, "
                f"varThreshold: {old_mog2.var_threshold}->{new_mog2.var_threshold}, "
                f"detectShadows: {old_mog2.detect_shadows}->{new_mog2.detect_shadows})"
            )
            self.remove_camera(camera_id)
            self.add_camera(camera_id, camera_name, settings)
        else:
            # Only zone/other settings changed - update in place
            state.settings = settings
            state.camera_name = camera_name  # Name might have changed too
            logger.info(
                f"Updated settings for '{camera_name}' "
                f"({len(settings.zones)} zone(s), MOG2 preserved)"
            )

    def has_camera(self, camera_id: str) -> bool:
        """Check if a camera exists."""
        return camera_id in self._states

    def get_camera_ids(self) -> List[str]:
        """Get list of active camera IDs."""
        return list(self._states.keys())

    # =========================================================================
    # Frame Processing
    # =========================================================================

    def process_frame(self, frame_input: FrameInput) -> MotionResult:
        """
        Process a single frame for motion detection.

        Args:
            frame_input: Input frame with camera_id and JPEG buffer

        Returns:
            MotionResult with detection results
        """
        state = self._states.get(frame_input.camera_id)
        if state is None:
            return MotionResult(
                camera_id=frame_input.camera_id,
                has_motion=False,
                error=f"Camera ID {frame_input.camera_id} not registered",
                zone_results=[],
            )

        start = time.time()

        try:
            # Get foreground mask from strategy
            fg_mask = self._strategy.process_frame(frame_input, state)

            # Analyze mask for motion in zones
            result = self._analyzer.analyze(fg_mask, state.settings, state.camera_name)
            result.processing_time_ms = (time.time() - start) * 1000

            return result

        except Exception as e:
            logger.error(f"Error processing frame for '{state.camera_name}': {e}")
            return MotionResult(
                camera_id=frame_input.camera_id,
                has_motion=False,
                processing_time_ms=(time.time() - start) * 1000,
                error=str(e),
                zone_results=[],
            )

    def process_batch(self, frames: List[FrameInput]) -> List[MotionResult]:
        """
        Process multiple frames (parallel if strategy supports it).

        Args:
            frames: List of input frames

        Returns:
            List of MotionResult in same order as input frames
        """
        if not frames:
            return []

        start = time.time()

        try:
            # Get foreground masks from strategy
            fg_masks = self._strategy.process_batch(frames, self._states)

            # Calculate per-frame time
            batch_time_ms = (time.time() - start) * 1000
            per_frame_time = batch_time_ms / len(frames) if frames else 0

            # Analyze each mask
            results = []
            for fg_mask in fg_masks:
                state = self._states.get(fg_mask.camera_id)
                if state:
                    result = self._analyzer.analyze(
                        fg_mask,
                        state.settings,
                        state.camera_name,
                    )
                    result.processing_time_ms = per_frame_time
                    results.append(result)

            return results

        except Exception as e:
            logger.error(f"Error in batch processing: {e}")
            return []

    # =========================================================================
    # Stats
    # =========================================================================

    @property
    def strategy_name(self) -> str:
        """Get the current strategy name."""
        return self._strategy.name

    @property
    def supports_batch_parallel(self) -> bool:
        """Check if the current strategy supports parallel batch processing."""
        return self._strategy.supports_batch_parallel

    def get_stats(self) -> dict:
        """Get detector statistics."""
        return {
            'strategy': self._strategy.name,
            'supports_batch_parallel': self._strategy.supports_batch_parallel,
            'active_cameras': len(self._states),
            'cameras': {
                state.camera_id: {
                    'name': state.camera_name,
                    'zones': len(state.settings.zones),
                }
                for state in self._states.values()
            },
        }

"""Motion detector with pluggable processing strategies."""

import logging
import time
from typing import Dict, List, Optional

from .strategies import ProcessingStrategy
from .strategies.simple_diff_strategy import SimpleDiffStrategy
from .strategies.knn_strategy import KNNStrategy
from .strategies.mog2_strategy import MOG2Strategy
from .mask_analyzer import MaskAnalyzer
from models import (
    FrameInput,
    MotionResult,
    CameraState,
    MotionDetectionSettings,
    DetectionModel,
    SimpleDiffSettings,
    KNNSettings,
    MOG2Settings,
)

logger = logging.getLogger(__name__)


class MotionDetector:
    """
    Motion detector with pluggable processing strategies.

    Each camera has its own strategy based on its detection model configuration.
    Strategies are created per-camera and handle both CPU and GPU processing
    internally.

    Lifecycle:
    - add_camera(): Create detector with settings from Redis
    - remove_camera(): Destroy detector, free memory
    - update_camera(): Smart update - only resets detector if model or settings changed
    """

    def __init__(self):
        """Initialize motion detector."""
        self._states: Dict[str, CameraState] = {}
        self._analyzer = MaskAnalyzer()

        # Strategy instances (one per model type, shared across cameras)
        self._strategies: Dict[DetectionModel, ProcessingStrategy] = {}

        logger.info("MotionDetector initialized")

    def _get_strategy(self, model: DetectionModel) -> ProcessingStrategy:
        """
        Get or create a strategy for the given detection model.

        Strategies are created lazily and cached per model type.
        """
        if model not in self._strategies:
            self._strategies[model] = self._create_strategy(model)
            logger.info(f"Created {self._strategies[model].name} strategy")

        return self._strategies[model]

    def _create_strategy(self, model: DetectionModel) -> ProcessingStrategy:
        """Create a strategy instance for the given detection model."""
        if model == DetectionModel.SIMPLE_DIFF:
            return SimpleDiffStrategy()
        elif model == DetectionModel.KNN:
            return KNNStrategy()
        else:  # MOG2 (default)
            return MOG2Strategy()

    def _requires_detector_reset(
        self,
        old_settings: MotionDetectionSettings,
        new_settings: MotionDetectionSettings,
    ) -> bool:
        """
        Check if detector needs to be reset (model changed or model settings changed).

        Args:
            old_settings: Previous motion detection settings
            new_settings: New motion detection settings

        Returns:
            True if detector needs to be reset
        """
        # Model changed - always reset
        if old_settings.detection_model != new_settings.detection_model:
            return True

        # Check model-specific settings
        old_model_settings = old_settings.model_settings
        new_model_settings = new_settings.model_settings

        logger.info(
            f"Comparing model settings: old={old_model_settings}, new={new_model_settings}"
        )

        if new_settings.detection_model == DetectionModel.MOG2:
            changed = self._mog2_settings_changed(old_model_settings, new_model_settings)
            logger.info(f"MOG2 settings changed: {changed}")
            return changed
        elif new_settings.detection_model == DetectionModel.KNN:
            changed = self._knn_settings_changed(old_model_settings, new_model_settings)
            logger.info(f"KNN settings changed: {changed}")
            return changed
        elif new_settings.detection_model == DetectionModel.SIMPLE_DIFF:
            changed = self._simple_diff_settings_changed(old_model_settings, new_model_settings)
            logger.info(f"SimpleDiff settings changed: {changed}")
            return changed

        return False

    def _mog2_settings_changed(self, old_settings, new_settings) -> bool:
        """Check if MOG2 settings changed."""
        if not isinstance(old_settings, MOG2Settings) or not isinstance(new_settings, MOG2Settings):
            return True
        return (
            old_settings.history != new_settings.history or
            old_settings.var_threshold != new_settings.var_threshold or
            old_settings.detect_shadows != new_settings.detect_shadows
        )

    def _knn_settings_changed(self, old_settings, new_settings) -> bool:
        """Check if KNN settings changed."""
        if not isinstance(old_settings, KNNSettings) or not isinstance(new_settings, KNNSettings):
            return True
        return (
            old_settings.history != new_settings.history or
            old_settings.dist2_threshold != new_settings.dist2_threshold or
            old_settings.detect_shadows != new_settings.detect_shadows
        )

    def _simple_diff_settings_changed(self, old_settings, new_settings) -> bool:
        """Check if SimpleDiff settings changed."""
        if not isinstance(old_settings, SimpleDiffSettings) or not isinstance(new_settings, SimpleDiffSettings):
            return True
        return old_settings.threshold != new_settings.threshold

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

        # Get strategy for the camera's detection model
        strategy = self._get_strategy(settings.detection_model)

        # Create detector with settings from Redis
        detector = strategy.create_detector(camera_id, camera_name, settings)

        # Store state with strategy reference
        self._states[camera_id] = CameraState(
            camera_id=camera_id,
            camera_name=camera_name,
            detector=detector,
            settings=settings,
            strategy=strategy,
        )

        logger.info(
            f"Added camera '{camera_name}' with {len(settings.zones)} zone(s), "
            f"model={settings.detection_model.value}, "
            f"strategy={strategy.name}"
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

        # Clean up strategy-specific state
        if state.strategy:
            state.strategy.cleanup_camera(camera_id)

        del self._states[camera_id]
        logger.info(f"Removed camera '{camera_name}'")

    def update_camera(
        self,
        camera_id: str,
        camera_name: str,
        settings: MotionDetectionSettings,
    ) -> None:
        """
        Update camera settings, only resetting detector if necessary.

        Detector is reset only if detection model changed or model-specific
        settings changed. Zone changes don't require detector reset.

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

        old_settings = state.settings

        if self._requires_detector_reset(old_settings, settings):
            # Model or model settings changed - need full reset
            old_model = old_settings.detection_model.value
            new_model = settings.detection_model.value
            logger.info(
                f"Detector reset required for '{camera_name}' "
                f"(model: {old_model}->{new_model})"
            )
            self.remove_camera(camera_id)
            self.add_camera(camera_id, camera_name, settings)
        else:
            # Only zone/other settings changed - update in place
            state.settings = settings
            state.camera_name = camera_name  # Name might have changed too
            logger.info(
                f"Updated settings for '{camera_name}' "
                f"({len(settings.zones)} zone(s), detector preserved)"
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
            # Get foreground mask from camera's strategy
            fg_mask = state.strategy.process_frame(frame_input, state)

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
        Process multiple frames sequentially.

        Args:
            frames: List of input frames

        Returns:
            List of MotionResult in same order as input frames
        """
        return [self.process_frame(frame) for frame in frames]

    # =========================================================================
    # Stats
    # =========================================================================

    def get_stats(self) -> dict:
        """Get detector statistics."""
        return {
            'active_strategies': [s.name for s in self._strategies.values()],
            'active_cameras': len(self._states),
            'cameras': {
                state.camera_id: {
                    'name': state.camera_name,
                    'model': state.settings.detection_model.value,
                    'strategy': state.strategy.name if state.strategy else 'unknown',
                    'zones': len(state.settings.zones),
                }
                for state in self._states.values()
            },
        }

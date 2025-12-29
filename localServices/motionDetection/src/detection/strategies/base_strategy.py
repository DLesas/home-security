"""Abstract base class for motion detection processing strategies."""

from abc import ABC, abstractmethod
from typing import Any, Optional

from models import FrameInput, ForegroundMask, CameraState, MotionDetectionSettings


class ProcessingStrategy(ABC):
    """
    Abstract base class for motion detection processing strategies.

    Each detection model (SimpleDiff, KNN, MOG2) implements this interface.
    Each strategy handles both CPU and GPU processing internally, auto-detecting
    GPU availability at initialization time.

    Strategies are responsible for:
    - Creating algorithm-specific detectors
    - Processing frames and returning foreground masks
    - Managing their own internal state (e.g., previous frames for SimpleDiff)
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """Strategy name for logging and identification."""
        pass

    @abstractmethod
    def create_detector(
        self,
        camera_id: str,
        camera_name: str,
        settings: MotionDetectionSettings,
    ) -> Optional[Any]:
        """
        Create a background subtractor or detector for a camera.

        Args:
            camera_id: Unique camera identifier
            camera_name: Human-readable camera name for logging
            settings: Motion detection settings including model-specific config

        Returns:
            Detector instance (BackgroundSubtractor for MOG2/KNN, None for SimpleDiff)
        """
        pass

    @abstractmethod
    def process_frame(
        self,
        frame_input: FrameInput,
        state: CameraState,
    ) -> ForegroundMask:
        """
        Process a single frame and return the foreground mask.

        Args:
            frame_input: Input frame with camera_id and JPEG buffer
            state: Camera state with detector and settings

        Returns:
            ForegroundMask with the motion mask

        Raises:
            ValueError: If frame decoding fails
        """
        pass

    def cleanup_camera(self, camera_id: str) -> None:
        """
        Clean up resources for a camera being removed.

        Override in subclasses that maintain per-camera state (e.g., SimpleDiff).

        Args:
            camera_id: ID of the camera being removed
        """
        pass

"""Abstract base class for detection strategies."""

from abc import ABC, abstractmethod
from typing import List, Tuple

from models import DetectionBox, CameraObjectDetectionSettings


class BaseDetectionStrategy(ABC):
    """Abstract detection strategy interface with batch support."""

    @abstractmethod
    def load(self) -> None:
        """Load the model into memory."""
        pass

    @abstractmethod
    def unload(self) -> None:
        """Unload the model from memory."""
        pass

    @abstractmethod
    def detect(
        self,
        frames: List[Tuple[bytes, CameraObjectDetectionSettings]],
    ) -> List[List[DetectionBox]]:
        """
        Run detection on a batch of frames.

        Args:
            frames: List of (JPEG bytes, per-camera settings) tuples

        Returns:
            List of detection box lists, one per input frame
        """
        pass

    @property
    @abstractmethod
    def model_name(self) -> str:
        """Get the model name."""
        pass

    @property
    @abstractmethod
    def is_loaded(self) -> bool:
        """Check if model is loaded."""
        pass

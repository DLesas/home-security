"""Abstract base class for motion detection processing strategies."""

from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional

from models import FrameInput, ForegroundMask, CameraState, MOG2Settings


class ProcessingStrategy(ABC):
    """
    Abstract base class for motion detection processing strategies.

    Strategies encapsulate the differences between CPU, GPU, and GPU batch
    processing. MOG2 configuration comes from CameraState (via Redis).

    Each strategy is responsible for:
    - Creating MOG2 detectors (CPU or CUDA version) with settings from Redis
    - Creating processing streams (CUDA streams for GPU batch)
    - Processing frames and returning foreground masks
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """Strategy name for logging and identification."""
        pass

    @property
    def supports_batch_parallel(self) -> bool:
        """Whether this strategy supports true parallel batch processing."""
        return False

    @abstractmethod
    def create_detector(
        self,
        camera_id: str,
        camera_name: str,
        mog2_settings: MOG2Settings,
    ) -> Any:
        """
        Create a MOG2 background subtractor for a camera.

        Args:
            camera_id: Unique camera identifier
            camera_name: Human-readable camera name for logging
            mog2_settings: MOG2 configuration from Redis

        Returns:
            MOG2 detector instance (CPU or CUDA version)
        """
        pass

    @abstractmethod
    def create_stream(self, camera_id: str, camera_name: str) -> Optional[Any]:
        """
        Create a processing stream for a camera.

        Args:
            camera_id: Unique camera identifier
            camera_name: Human-readable camera name for logging

        Returns:
            CUDA stream for GPU strategies, None for CPU
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

    @abstractmethod
    def process_batch(
        self,
        frames: List[FrameInput],
        states: Dict[str, CameraState],
    ) -> List[ForegroundMask]:
        """
        Process multiple frames.

        For CPU, this is sequential. For GPU strategies, this may be parallel.

        Args:
            frames: List of input frames
            states: Dictionary of camera states keyed by camera_id

        Returns:
            List of ForegroundMask in same order as input frames
        """
        pass

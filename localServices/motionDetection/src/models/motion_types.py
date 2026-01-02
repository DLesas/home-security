"""Dataclass definitions for internal motion detection state."""

from dataclasses import dataclass, field
from typing import Optional, Tuple, List, Any

import numpy as np

from .config_types import MotionDetectionSettings


@dataclass
class FrameInput:
    """Input frame for motion detection processing."""
    camera_id: str
    jpeg_buffer: bytes
    timestamp: int  # Original capture timestamp from cameraIngestion


@dataclass
class DecodedFrame:
    """Decoded frame ready for MOG2 processing."""
    camera_id: str
    frame: np.ndarray
    timestamp: int
    shape: Tuple[int, int, int]  # (height, width, channels)


@dataclass
class ForegroundMask:
    """Result of MOG2 background subtraction."""
    camera_id: str
    mask: np.ndarray
    frame_shape: Tuple[int, int, int]  # Original frame shape


@dataclass
class ZoneMotionResult:
    """Motion detection result for a specific zone."""
    id: str  # Zone ID (e.g., "default", "front-door")
    zone_name: str
    has_motion: bool
    motion_percentage: float
    motion_regions: int
    total_motion_pixels: int

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            'zone_id': self.id,
            'zone_name': self.zone_name,
            'has_motion': self.has_motion,
            'motion_percentage': self.motion_percentage,
            'motion_regions': self.motion_regions,
            'total_motion_pixels': self.total_motion_pixels,
        }


@dataclass
class MotionResult:
    """
    Result of motion detection for a single frame.

    Aggregates results from all zones. has_motion is True if any zone detected motion.
    """
    camera_id: str
    has_motion: bool  # True if any zone detected motion
    processing_time_ms: float = 0.0
    error: Optional[str] = None
    zone_results: List[ZoneMotionResult] = field(default_factory=list)
    mask: Optional[np.ndarray] = None  # Foreground mask for visualization
    original_frame: Optional[bytes] = None  # JPEG bytes for object detection forwarding

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        result = {
            'camera_id': self.camera_id,
            'has_motion': self.has_motion,
            'processing_time_ms': self.processing_time_ms,
            'zone_results': [z.to_dict() for z in self.zone_results],
        }
        if self.error:
            result['error'] = self.error
        return result

    @property
    def total_motion_percentage(self) -> float:
        """Get maximum motion percentage across all zones."""
        if not self.zone_results:
            return 0.0
        return max(z.motion_percentage for z in self.zone_results)

    @property
    def total_motion_regions(self) -> int:
        """Get total motion regions across all zones."""
        return sum(z.motion_regions for z in self.zone_results)

    @property
    def total_motion_pixels(self) -> int:
        """Get total motion pixels across all zones."""
        return sum(z.total_motion_pixels for z in self.zone_results)


@dataclass
class CameraState:
    """
    Internal state for a camera's motion detector.

    Each camera has its own detector that learns the background over time.
    The detector type depends on the selected detection model (MOG2, KNN, or None for SimpleDiff).
    """
    camera_id: str
    camera_name: str  # Human-readable name for logging
    detector: Any  # cv2.BackgroundSubtractor (MOG2/KNN) or None for SimpleDiff
    settings: MotionDetectionSettings
    strategy: Any = None  # ProcessingStrategy instance (set by MotionDetector)
    frames_processed: int = 0  # Counter for warm-up period

    def get_warmup_frames(self) -> int:
        """Get warm-up frame count from detector's history setting."""
        model_settings = self.settings.model_settings
        # Handle both object attributes and dict keys
        if hasattr(model_settings, 'history'):
            return model_settings.history
        elif isinstance(model_settings, dict) and 'history' in model_settings:
            return model_settings['history']
        return 0  # SimpleDiff doesn't need warm-up

    def is_warming_up(self) -> bool:
        """Check if detector is still in warm-up period (building background model)."""
        return self.frames_processed < self.get_warmup_frames()

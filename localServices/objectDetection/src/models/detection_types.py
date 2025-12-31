"""Type definitions for object detection."""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple


@dataclass
class MotionZone:
    """Motion zone definition from camera config."""
    id: str
    name: str
    points: List[Tuple[int, int]]  # Empty = full frame, otherwise polygon vertices

    def is_full_frame(self) -> bool:
        """Check if this zone covers the full frame."""
        return len(self.points) == 0


@dataclass
class CameraObjectDetectionSettings:
    """Per-camera object detection settings (from Redis cameras)."""
    class_configs: List[Dict]  # Raw from Redis: [{"class": "person", "confidence": 0.5}]
    motion_zones: List[MotionZone]  # Zone definitions with polygon points

    def get_confidence_threshold(self, class_name: str) -> Optional[float]:
        """Get confidence threshold for a class, or None if not enabled."""
        for config in self.class_configs:
            if config.get('class') == class_name:
                return config.get('confidence')
        return None

    def is_class_enabled(self, class_name: str) -> bool:
        """Check if a class is enabled for detection."""
        return any(c.get('class') == class_name for c in self.class_configs)

    def get_min_confidence(self) -> Optional[float]:
        """Get minimum confidence across all enabled classes."""
        if not self.class_configs:
            return None
        return min(c.get('confidence', 1.0) for c in self.class_configs)

    def get_zone_by_id(self, zone_id: str) -> Optional[MotionZone]:
        """Get zone by ID."""
        for zone in self.motion_zones:
            if zone.id == zone_id:
                return zone
        return None


@dataclass
class ZoneMotionResult:
    """Motion result for a specific zone (from motion event)."""
    zone_id: str
    zone_name: str
    has_motion: bool


@dataclass
class DetectionBox:
    """Single detection bounding box."""
    class_id: int
    class_name: str
    confidence: float
    x1: float
    y1: float
    x2: float
    y2: float

    @property
    def center(self) -> Tuple[float, float]:
        """Get center point of bounding box."""
        return ((self.x1 + self.x2) / 2, (self.y1 + self.y2) / 2)


@dataclass
class DetectionResult:
    """Result of object detection on a frame."""
    camera_id: str
    timestamp: int
    model_used: str
    processing_time_ms: float
    boxes: List[DetectionBox] = field(default_factory=list)

    @property
    def has_detections(self) -> bool:
        return len(self.boxes) > 0


@dataclass
class MotionEvent:
    """
    Motion event received from motion detection service.

    Matches the format published by motionDetection/output/motion_publisher.py
    """
    camera_id: str
    timestamp: int
    motion_detected: bool
    processing_time_ms: float
    zone_results: List[ZoneMotionResult]
    mask: str  # Base64 encoded JPEG, empty string if not present
    original_frame: str  # Base64 encoded JPEG, empty string if not present

    @classmethod
    def from_dict(cls, data: dict) -> 'MotionEvent':
        """Parse motion event from Redis pub/sub message."""
        zone_results = [
            ZoneMotionResult(
                zone_id=z['zone_id'],
                zone_name=z['zone_name'],
                has_motion=z['has_motion'],
            )
            for z in data.get('zone_results', [])
        ]

        return cls(
            camera_id=data['camera_id'],
            timestamp=data['timestamp'],
            motion_detected=data['motion_detected'],
            processing_time_ms=data['processing_time_ms'],
            zone_results=zone_results,
            mask=data.get('mask', ''),
            original_frame=data.get('original_frame', ''),
        )

    def has_original_frame(self) -> bool:
        """Check if original frame is present."""
        return bool(self.original_frame)

    def get_zones_with_motion(self) -> List[str]:
        """Get list of zone IDs that have motion."""
        return [z.zone_id for z in self.zone_results if z.has_motion]

"""Configuration type definitions using Pydantic for validation."""

from typing import List, Tuple
from pydantic import BaseModel, Field, field_validator


class MotionZone(BaseModel):
    """
    Motion detection zone with per-zone settings.

    Zone detection behavior:
    - points: [] (empty) = full frame detection
    - points: [(x1,y1), (x2,y2), ...] = polygon region detection

    Only active (non-deleted) zones are synced to Redis.
    """
    id: str  # Semantic ID (e.g., "default", "front-door")
    name: str
    points: List[Tuple[int, int]] = Field(default_factory=list)
    min_contour_area: int = Field(alias='minContourArea')
    threshold_percent: float = Field(alias='thresholdPercent')

    model_config = {'populate_by_name': True}

    @field_validator('points', mode='before')
    @classmethod
    def parse_points(cls, v):
        """Convert [[x,y], ...] from Redis to [(x,y), ...]."""
        if not v:
            return []
        return [(p[0], p[1]) for p in v]

    def is_full_frame(self) -> bool:
        """Check if this zone covers the full frame."""
        return len(self.points) == 0


class MOG2Settings(BaseModel):
    """
    MOG2 background subtractor settings (per-camera).

    All values come from Redis - no defaults in Python service.
    """
    history: int = Field(alias='mog2History')
    var_threshold: float = Field(alias='mog2VarThreshold')
    detect_shadows: bool = Field(alias='mog2DetectShadows')

    model_config = {'populate_by_name': True}


class MotionDetectionSettings(BaseModel):
    """
    Motion detection settings for a camera.

    All values come from Redis - no defaults in Python service.
    All cameras must have at least one zone (enforced by backend).
    """
    enabled: bool = Field(alias='motionDetectionEnabled')
    mog2: MOG2Settings
    zones: List[MotionZone] = Field(alias='motionZones')

    model_config = {'populate_by_name': True}

    @field_validator('zones')
    @classmethod
    def at_least_one_zone(cls, v):
        """Ensure at least one zone exists."""
        if not v:
            raise ValueError('At least one motion zone is required')
        return v

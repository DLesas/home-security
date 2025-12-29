"""Configuration type definitions using Pydantic for validation."""

import json
from enum import Enum
from typing import List, Tuple, Union
from pydantic import BaseModel, Field, field_validator


class DetectionModel(str, Enum):
    """Available motion detection models."""
    SIMPLE_DIFF = "simple_diff"
    KNN = "knn"
    MOG2 = "mog2"


class SimpleDiffSettings(BaseModel):
    """Simple frame difference settings."""
    threshold: int = Field(ge=0, le=255)  # 0-255

    model_config = {'populate_by_name': True}


class KNNSettings(BaseModel):
    """KNN background subtractor settings."""
    history: int = Field(ge=1)
    dist2_threshold: float = Field(alias='dist2Threshold', ge=0)
    detect_shadows: bool = Field(alias='detectShadows')

    model_config = {'populate_by_name': True}


class MOG2Settings(BaseModel):
    """MOG2 background subtractor settings."""
    history: int = Field(ge=1)
    var_threshold: float = Field(alias='varThreshold', ge=0)
    detect_shadows: bool = Field(alias='detectShadows')

    model_config = {'populate_by_name': True}


# Union type for all model settings
ModelSettings = Union[SimpleDiffSettings, KNNSettings, MOG2Settings]


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


class MotionDetectionSettings(BaseModel):
    """
    Motion detection settings for a camera.

    All values come from Redis - no defaults in Python service.
    All cameras must have at least one zone (enforced by backend).
    """
    enabled: bool = Field(alias='motionDetectionEnabled')
    detection_model: DetectionModel = Field(alias='detectionModel', default=DetectionModel.MOG2)
    model_settings: ModelSettings = Field(alias='modelSettings')
    zones: List[MotionZone] = Field(alias='motionZones')

    model_config = {'populate_by_name': True}

    @field_validator('model_settings', mode='before')
    @classmethod
    def parse_model_settings(cls, v, info):
        """Parse modelSettings JSON based on detectionModel."""
        # If already a ModelSettings instance, return as-is
        if isinstance(v, (SimpleDiffSettings, KNNSettings, MOG2Settings)):
            return v

        # Parse JSON string if needed
        if isinstance(v, str):
            v = json.loads(v)

        # Get detection model from info.data (already parsed fields)
        detection_model = info.data.get('detectionModel', 'mog2')
        if isinstance(detection_model, DetectionModel):
            detection_model = detection_model.value

        # Parse based on model type
        if detection_model == 'simple_diff':
            return SimpleDiffSettings(**v)
        elif detection_model == 'knn':
            return KNNSettings(**v)
        else:  # mog2
            return MOG2Settings(**v)

    @field_validator('zones')
    @classmethod
    def at_least_one_zone(cls, v):
        """Ensure at least one zone exists."""
        if not v:
            raise ValueError('At least one motion zone is required')
        return v

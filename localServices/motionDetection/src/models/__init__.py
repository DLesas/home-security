"""Type definitions for the motion detection service."""

from .redis_types import (
    RedisMotionZone,
    RedisCameraConfig,
    RedisCameraConfigEvent,
    RedisZoneMotionResult,
    RedisMotionEvent,
    RedisFrameData,
)
from .config_types import (
    DetectionModel,
    SimpleDiffSettings,
    KNNSettings,
    MOG2Settings,
    ModelSettings,
    MotionZone,
    MotionDetectionSettings,
)

# Re-export Pydantic's ValidationError for convenience
from pydantic import ValidationError
from .motion_types import (
    FrameInput,
    DecodedFrame,
    ForegroundMask,
    ZoneMotionResult,
    MotionResult,
    CameraState,
)

__all__ = [
    # Redis types
    "RedisMotionZone",
    "RedisCameraConfig",
    "RedisCameraConfigEvent",
    "RedisZoneMotionResult",
    "RedisMotionEvent",
    "RedisFrameData",
    # Config types
    "DetectionModel",
    "SimpleDiffSettings",
    "KNNSettings",
    "MOG2Settings",
    "ModelSettings",
    "MotionZone",
    "MotionDetectionSettings",
    "ValidationError",
    # Motion types
    "FrameInput",
    "DecodedFrame",
    "ForegroundMask",
    "ZoneMotionResult",
    "MotionResult",
    "CameraState",
]

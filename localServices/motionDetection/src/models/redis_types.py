"""TypedDict definitions for Redis data structures.

These types match the backend's Redis-OM schema for cameras and the
pub/sub event formats used for camera config changes and motion events.
"""

from typing import TypedDict, Optional, List


class RedisMotionZone(TypedDict):
    """
    Motion zone definition stored in Redis.

    Zone detection behavior:
    - points: [] (empty) = full frame detection
    - points: [[x1,y1], [x2,y2], ...] = polygon region detection

    Only active (non-deleted) zones are stored in Redis.
    """
    id: str  # Semantic ID (e.g., "default", "front-door")
    name: str
    points: List[List[int]]  # Empty = full frame, otherwise polygon vertices
    minContourArea: int
    thresholdPercent: float


class RedisCameraConfig(TypedDict, total=False):
    """
    Camera configuration as stored in Redis-OM.

    Matches backend schema at: localServices/backend/src/redis/cameras.ts

    All motion detection fields are REQUIRED - no defaults in Python service.
    """
    # Required fields
    externalID: str
    name: str
    building: str
    port: int
    expectedSecondsUpdated: int

    # Motion detection settings (all required)
    motionDetectionEnabled: bool
    motionZones: List[RedisMotionZone]

    # Detection model: "simple_diff" | "knn" | "mog2"
    detectionModel: str
    # Model-specific settings (dict or JSON string depending on source)
    # - From Redis-OM: JSON string
    # - From pub/sub: dict
    modelSettings: dict

    # Optional fields
    ipAddress: Optional[str]
    protocol: Optional[str]  # "udp" or "rtsp"
    username: Optional[str]  # RTSP auth
    password: Optional[str]  # RTSP auth
    streamPath: Optional[str]  # RTSP stream path
    targetWidth: Optional[int]
    targetHeight: Optional[int]
    lastUpdated: Optional[str]  # ISO date string


class RedisCameraConfigEvent(TypedDict):
    """
    Pub/sub event for camera configuration changes.

    Published by backend on channel: camera:config
    """
    timestamp: int  # Unix timestamp in milliseconds
    action: str  # "created" | "updated" | "deleted"
    camera: RedisCameraConfig


class RedisZoneMotionResult(TypedDict):
    """Motion result for a specific zone in Redis event."""
    zone_id: str  # Maps from ZoneMotionResult.id
    zone_name: str
    has_motion: bool
    motion_percentage: float
    motion_regions: int
    total_motion_pixels: int


class RedisMotionEvent(TypedDict):
    """
    Motion detection result published to Redis pub/sub.

    Published on channel: motion:{camera_id}
    """
    camera_id: str
    timestamp: int  # Original frame capture timestamp from ingestion
    motion_detected: bool  # True if any zone detected motion
    processing_time_ms: float
    zone_results: List[RedisZoneMotionResult]


class RedisFrameData(TypedDict):
    """
    Frame data structure from Redis Streams.

    Produced by cameraIngestion service on stream: camera:{camera_id}:frames
    """
    image: bytes  # JPEG encoded frame
    timestamp: int  # Unix timestamp in milliseconds

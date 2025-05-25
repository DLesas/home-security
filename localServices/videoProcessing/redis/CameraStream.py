from datetime import datetime
import json
from redis import Redis
from typing import TypedDict, List
import numpy as np
from numpy.typing import NDArray
from yoloProcessor import Detection, ProcessedFrame

class CameraStreams:
    def __init__(self, redis_client: Redis, camera_id: str):
        self.redis = redis_client

    async def publish_frame(self, frame: ProcessedFrame):
        """Publish a new camera frame to the stream"""
        stream_key = f"camera:{frame.stream_id}:stream"
        entry = {
            "frame_id": frame.frame_id,
            "stream_id": frame.stream_id,
            "image": frame.frame,
            "timestamp": str(frame.timestamp),
            "detections": json.dumps(frame.detections),
        }

        # Keep only latest frames with MAXLEN 120
        return await self.redis.xadd(stream_key, entry, maxlen=120, approximate=True)

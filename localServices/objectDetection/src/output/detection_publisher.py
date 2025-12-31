"""Publishes object detection results to Redis pub/sub."""

import json
import logging
from typing import List

import redis

from models import DetectionResult

logger = logging.getLogger(__name__)


class DetectionPublisher:
    """
    Publishes detection results to Redis pub/sub.

    Channel format: detection:{camera_id}
    Backend subscribes to process results (DB writes, clip extraction).
    """

    def __init__(
        self,
        redis_host: str,
        redis_port: int,
        channel_prefix: str = 'detection:',
    ):
        self._redis = redis.Redis(host=redis_host, port=redis_port, decode_responses=True)
        self._channel_prefix = channel_prefix

    def publish(self, result: DetectionResult) -> None:
        """Publish single detection result."""
        try:
            event = self._build_event(result)
            channel = f"{self._channel_prefix}{result.camera_id}"
            self._redis.publish(channel, json.dumps(event))

        except Exception as e:
            logger.error(f"Failed to publish detection result: {e}")

    def publish_batch(self, results: List[DetectionResult]) -> None:
        """Publish multiple detection results efficiently."""
        if not results:
            return

        try:
            pipeline = self._redis.pipeline()

            for result in results:
                event = self._build_event(result)
                channel = f"{self._channel_prefix}{result.camera_id}"
                pipeline.publish(channel, json.dumps(event))

            pipeline.execute()

        except Exception as e:
            logger.error(f"Failed to publish detection batch: {e}")

    def close(self) -> None:
        """Close Redis connection."""
        self._redis.close()

    def _build_event(self, result: DetectionResult) -> dict:
        """Build Redis event from detection result."""
        return {
            'camera_id': result.camera_id,
            'timestamp': result.timestamp,
            'model_used': result.model_used,
            'processing_time_ms': round(result.processing_time_ms, 2),
            'detection_count': len(result.boxes),
            'boxes': [
                {
                    'class_id': box.class_id,
                    'class_name': box.class_name,
                    'confidence': round(box.confidence, 4),
                    'x1': round(box.x1, 2),
                    'y1': round(box.y1, 2),
                    'x2': round(box.x2, 2),
                    'y2': round(box.y2, 2),
                }
                for box in result.boxes
            ],
        }

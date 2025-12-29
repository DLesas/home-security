"""Publishes motion detection results to Redis pub/sub."""

import base64
import json
import logging
from typing import List, Optional, Tuple

import cv2
import numpy as np
import redis

from models import MotionResult, RedisMotionEvent, RedisZoneMotionResult

logger = logging.getLogger(__name__)


class MotionPublisher:
    """
    Publishes motion detection results to Redis pub/sub.

    Separates Redis publishing from detection logic.
    Injected as a dependency into the frame consumer.
    """

    def __init__(
        self,
        redis_client: redis.Redis,
        channel_prefix: str = 'motion:',
    ):
        """
        Initialize motion publisher.

        Args:
            redis_client: Redis client instance
            channel_prefix: Prefix for motion event channels
        """
        self._redis = redis_client
        self._channel_prefix = channel_prefix

    def publish(
        self,
        result: MotionResult,
        original_timestamp: int,
    ) -> None:
        """
        Publish motion detection result to Redis.

        Args:
            result: Motion detection result
            original_timestamp: Original frame capture timestamp
        """
        try:
            event = self._build_event(result, original_timestamp)
            channel = f"{self._channel_prefix}{result.camera_id}"
            self._redis.publish(channel, json.dumps(event))

        except Exception as e:
            logger.error(f"Failed to publish motion event: {e}")

    def publish_batch(
        self,
        results: List[Tuple[MotionResult, int]],
    ) -> None:
        """
        Publish multiple results efficiently using pipeline.

        Args:
            results: List of (MotionResult, timestamp) tuples
        """
        if not results:
            return

        try:
            pipeline = self._redis.pipeline()

            for result, timestamp in results:
                # Publish motion event (includes mask if available)
                event = self._build_event(result, timestamp)
                channel = f"{self._channel_prefix}{result.camera_id}"
                pipeline.publish(channel, json.dumps(event))

            pipeline.execute()

        except Exception as e:
            logger.error(f"Failed to publish motion batch: {e}")

    def _encode_mask(self, mask: Optional[np.ndarray]) -> str:
        """
        Encode mask as base64 JPEG.

        Args:
            mask: Grayscale foreground mask, or None

        Returns:
            Base64 encoded JPEG string, or empty string if no mask
        """
        if mask is None:
            return ''
        _, jpeg_buffer = cv2.imencode('.jpg', mask, [cv2.IMWRITE_JPEG_QUALITY, 80])
        return base64.b64encode(jpeg_buffer).decode('utf-8')

    def _build_event(
        self,
        result: MotionResult,
        timestamp: int,
    ) -> dict:
        """Build Redis motion event from result."""
        zone_results: List[RedisZoneMotionResult] = [
            {
                'zone_id': z.id,
                'zone_name': z.zone_name,
                'has_motion': z.has_motion,
                'motion_percentage': z.motion_percentage,
                'motion_regions': z.motion_regions,
                'total_motion_pixels': z.total_motion_pixels,
            }
            for z in result.zone_results
        ]

        return {
            'camera_id': result.camera_id,
            'timestamp': timestamp,
            'motion_detected': result.has_motion,
            'processing_time_ms': round(result.processing_time_ms, 2),
            'zone_results': zone_results,
            'mask': self._encode_mask(result.mask),
        }

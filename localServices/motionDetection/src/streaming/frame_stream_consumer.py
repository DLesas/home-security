"""Frame stream consumer that reads from Redis Streams and processes motion detection."""

import time
import logging
from typing import Optional, Dict

import redis

from detection import MotionDetector
from config import CameraConfigManager
from output import MotionLogger, MotionPublisher
from models import FrameInput, MotionDetectionSettings

logger = logging.getLogger(__name__)


class FrameStreamConsumer:
    """
    Consumes frames from Redis Streams and orchestrates motion detection.

    Reads from all camera streams in a single xreadgroup call for efficiency.
    Uses a short block timeout to ensure responsive processing.

    Dependencies are injected for separation of concerns:
    - MotionDetector: Detection logic with strategy pattern
    - CameraConfigManager: Configuration management
    - MotionLogger: Logging (injected)
    - MotionPublisher: Redis publishing (injected)
    """

    def __init__(
        self,
        redis_client: redis.Redis,
        detector: MotionDetector,
        config_manager: CameraConfigManager,
        motion_logger: MotionLogger,
        motion_publisher: MotionPublisher,
        consumer_group: str = 'motion-detectors',
        consumer_name: str = 'worker-1',
        block_timeout_ms: int = 50,
    ):
        """
        Initialize frame stream consumer.

        Args:
            redis_client: Redis client instance
            detector: MotionDetector instance
            config_manager: CameraConfigManager instance
            motion_logger: MotionLogger for logging events
            motion_publisher: MotionPublisher for Redis pub/sub
            consumer_group: Consumer group name for load balancing
            consumer_name: Unique name for this consumer instance
            block_timeout_ms: Max time to wait for frames (default: 50ms)
        """
        self._redis = redis_client
        self._detector = detector
        self._config_manager = config_manager
        self._logger = motion_logger
        self._publisher = motion_publisher
        self._consumer_group = consumer_group
        self._consumer_name = consumer_name
        self._block_timeout_ms = block_timeout_ms

        # Track active cameras: camera_id -> camera_name
        self._cameras: Dict[str, str] = {}

        # Register for camera config changes
        self._config_manager.on_change(self._on_camera_change)

        logger.info(
            f"FrameStreamConsumer initialized: {consumer_name} in group {consumer_group} "
            f"(block timeout: {block_timeout_ms}ms)"
        )

    def _on_camera_change(
        self,
        action: str,
        camera_id: str,
        camera_name: str,
        settings: Optional[MotionDetectionSettings],
    ) -> None:
        """Handle camera lifecycle events from config manager."""
        if action == 'created' and settings:
            self._detector.add_camera(camera_id, camera_name, settings)
            self._cameras[camera_id] = camera_name
            self._ensure_consumer_group(camera_id)
            self._logger.log_camera_added(camera_name, len(settings.zones))

        elif action == 'updated' and settings:
            self._detector.update_camera(camera_id, camera_name, settings)
            self._cameras[camera_id] = camera_name

        elif action == 'deleted':
            self._detector.remove_camera(camera_id)
            old_name = self._cameras.pop(camera_id, camera_name)
            self._logger.log_camera_removed(old_name)

    def _ensure_consumer_group(self, camera_id: str) -> None:
        """Ensure consumer group exists for camera stream."""
        stream_key = f'camera:{camera_id}:frames'
        try:
            self._redis.xgroup_create(
                stream_key,
                self._consumer_group,
                id='0',
                mkstream=True
            )
            logger.debug(f"Created consumer group for {stream_key}")
        except redis.ResponseError as e:
            if 'BUSYGROUP' not in str(e):
                logger.error(f"Error creating consumer group for {stream_key}: {e}")

    def consume_and_process(self) -> None:
        """Main consumer loop."""
        logger.info("Starting frame stream consumer")
        logger.info(f"  Consumer: {self._consumer_name}")
        logger.info(f"  Group: {self._consumer_group}")
        logger.info(f"  Strategy: {self._detector.strategy_name}")
        logger.info(f"  Parallel batch: {self._detector.supports_batch_parallel}")
        logger.info(f"  Block timeout: {self._block_timeout_ms}ms")

        # Ensure consumer groups for initial cameras
        for camera_id in self._cameras:
            self._ensure_consumer_group(camera_id)

        if self._cameras:
            camera_names = [self._cameras[cid] for cid in self._cameras]
            logger.info(f"Starting with {len(self._cameras)} camera(s): {camera_names}")

        while True:
            try:
                if not self._cameras:
                    time.sleep(0.1)  # Brief sleep when no cameras
                    continue

                # Build streams dict for xreadgroup
                streams = {f'camera:{cam}:frames': '>' for cam in self._cameras}

                # Read from all cameras with short timeout
                entries = self._redis.xreadgroup(
                    self._consumer_group,
                    self._consumer_name,
                    streams,
                    count=len(self._cameras),
                    block=self._block_timeout_ms,
                )

                if not entries:
                    continue

                # Collect frames for batch processing
                batch = []
                ack_info = []

                for stream_key, messages in entries:
                    stream_key_str = stream_key.decode() if isinstance(stream_key, bytes) else stream_key
                    camera_id = stream_key_str.split(':')[1]

                    for msg_id, data in messages:
                        frame_timestamp = int(data[b'timestamp']) if b'timestamp' in data else int(time.time() * 1000)
                        batch.append(FrameInput(
                            camera_id=camera_id,
                            jpeg_buffer=data[b'image'],
                            timestamp=frame_timestamp,
                        ))
                        ack_info.append((stream_key, msg_id, frame_timestamp))

                if not batch:
                    continue

                # Process batch
                start_time = time.time()
                results = self._detector.process_batch(batch)
                total_time_ms = (time.time() - start_time) * 1000

                self._logger.log_batch_stats(
                    len(batch),
                    len(set(f.camera_id for f in batch)),
                    total_time_ms,
                )

                # ACK, log, and publish
                publish_batch = []
                for i, result in enumerate(results):
                    stream_key, msg_id, timestamp = ack_info[i]
                    camera_name = self._cameras.get(result.camera_id, result.camera_id)

                    # Acknowledge and delete message
                    self._redis.xack(stream_key, self._consumer_group, msg_id)
                    self._redis.xdel(stream_key, msg_id)

                    # Log events
                    self._logger.log_motion_detected(result, camera_name)
                    self._logger.log_processing_error(result, camera_name)

                    # Collect for batch publish
                    publish_batch.append((result, timestamp))

                # Publish all results
                self._publisher.publish_batch(publish_batch)

            except KeyboardInterrupt:
                logger.info("Received shutdown signal")
                break
            except Exception as e:
                logger.error(f"Error in consumer loop: {e}", exc_info=True)
                time.sleep(0.1)

        logger.info("Frame stream consumer stopped")

    def get_stats(self) -> dict:
        """Get consumer statistics."""
        return {
            'consumer_name': self._consumer_name,
            'consumer_group': self._consumer_group,
            'block_timeout_ms': self._block_timeout_ms,
            'active_cameras': len(self._cameras),
            'cameras': dict(self._cameras),
            'detector_stats': self._detector.get_stats(),
        }

"""Consumes motion events from Redis pub/sub and runs object detection."""

import base64
import json
import logging
import threading
from collections import deque
from typing import Deque, List, Optional, Set, Tuple

import redis

from config import CameraConfigManager
from detection import ObjectDetector
from models import MotionEvent, CameraObjectDetectionSettings, DetectionResult
from output import DetectionPublisher

logger = logging.getLogger(__name__)

# Type alias for frame tuple
FrameTuple = Tuple[str, int, bytes, CameraObjectDetectionSettings, Set[str]]


class MotionEventConsumer:
    """
    Consumes motion events and runs object detection.

    - Subscribes to motion:{camera_id} channels for all enabled cameras
    - Uses async worker thread for inference (consumer never blocks)
    - Automatic backpressure: drops oldest frames when queue is full
    - Dynamic batching: worker processes whatever frames are available
    """

    def __init__(
        self,
        redis_host: str,
        redis_port: int,
        detector: ObjectDetector,
        camera_config: CameraConfigManager,
        publisher: DetectionPublisher,
        channel_prefix: str = 'motion:',
        max_pending_frames: int = 12,
        max_batch_size: int = 16,
    ):
        self._redis = redis.Redis(host=redis_host, port=redis_port, decode_responses=True)
        self._detector = detector
        self._camera_config = camera_config
        self._publisher = publisher
        self._channel_prefix = channel_prefix
        self._max_batch_size = max_batch_size

        self._running = False
        self._pubsub: Optional[redis.client.PubSub] = None

        # Frame queue with automatic backpressure (drops oldest when full)
        # Frame tuple: (camera_id, timestamp, jpeg_bytes, settings, zones_with_motion)
        self._frame_queue: Deque[FrameTuple] = deque(maxlen=max_pending_frames)
        self._queue_lock = threading.Lock()
        self._frames_available = threading.Condition(self._queue_lock)

        # Worker thread for inference
        self._worker_thread: Optional[threading.Thread] = None
        self._dropped_frames = 0  # Counter for monitoring

        # Lock for pubsub operations (accessed from main thread and config callback thread)
        self._pubsub_lock = threading.Lock()

        # Register for camera config changes
        camera_config.on_change(self._on_camera_change)

    def start(self) -> None:
        """Start consuming motion events."""
        logger.info("Starting motion event consumer")
        self._running = True

        # Start worker thread for inference
        self._worker_thread = threading.Thread(target=self._worker_loop, daemon=True)
        self._worker_thread.start()
        logger.info("Worker thread started")

        # Subscribe to all enabled cameras
        self._pubsub = self._redis.pubsub()
        self._subscribe_to_cameras()

        # Start message consumption loop (blocks main thread)
        self._consume_loop()

    def stop(self) -> None:
        """Stop consuming and flush pending frames."""
        self._running = False

        # Wake up worker thread if waiting
        with self._frames_available:
            self._frames_available.notify_all()

        # Wait for worker to finish current batch
        if self._worker_thread:
            self._worker_thread.join(timeout=10)
            if self._worker_thread.is_alive():
                logger.warning("Worker thread did not stop gracefully")

        # Process any remaining frames
        remaining = []
        with self._queue_lock:
            remaining = list(self._frame_queue)
            self._frame_queue.clear()

        if remaining:
            logger.info(f"Processing {len(remaining)} remaining frames before shutdown")
            self._process_batch(remaining)

        with self._pubsub_lock:
            if self._pubsub:
                self._pubsub.close()

        # Close Redis connection
        self._redis.close()

        if self._dropped_frames > 0:
            logger.warning(f"Total frames dropped due to backpressure: {self._dropped_frames}")

    def _subscribe_to_cameras(self) -> None:
        """Subscribe to motion channels for all enabled cameras."""
        cameras = self._camera_config.get_enabled_cameras()
        if not cameras:
            logger.info("No cameras with object detection enabled")
            return

        channels = [f"{self._channel_prefix}{camera_id}" for camera_id in cameras]
        with self._pubsub_lock:
            self._pubsub.subscribe(*channels)
        logger.info(f"Subscribed to {len(channels)} motion channels")

    def _on_camera_change(
        self,
        action: str,
        camera_id: str,
        camera_name: str,
        settings: Optional[CameraObjectDetectionSettings],
    ) -> None:
        """Handle camera config changes - update subscriptions."""
        if not self._pubsub:
            return

        channel = f"{self._channel_prefix}{camera_id}"

        with self._pubsub_lock:
            if action in ('created', 'updated') and settings:
                self._pubsub.subscribe(channel)
                logger.info(f"Subscribed to {channel}")
            elif action == 'deleted':
                self._pubsub.unsubscribe(channel)
                logger.info(f"Unsubscribed from {channel}")

    def _consume_loop(self) -> None:
        """Main consumption loop - reads messages and queues frames."""
        while self._running:
            # Check for new messages (non-blocking with short timeout)
            with self._pubsub_lock:
                message = self._pubsub.get_message(timeout=0.01)

            if message and message['type'] == 'message':
                self._handle_message(message)

    def _handle_message(self, message: dict) -> None:
        """Handle incoming motion event message - add to queue."""
        try:
            data = json.loads(message['data'])
            event = MotionEvent.from_dict(data)

            # Skip if no motion or no original frame
            if not event.motion_detected or not event.has_original_frame():
                return

            # Get camera settings
            camera_info = self._camera_config.get_camera(event.camera_id)
            if not camera_info:
                return

            camera_name, settings = camera_info

            # Decode frame
            jpeg_bytes = base64.b64decode(event.original_frame)

            # Get zones with motion
            zones_with_motion = set(event.get_zones_with_motion())

            # Add to queue (deque with maxlen auto-drops oldest if full)
            frame: FrameTuple = (
                event.camera_id,
                event.timestamp,
                jpeg_bytes,
                settings,
                zones_with_motion,
            )

            with self._frames_available:
                queue_was_full = len(self._frame_queue) == self._frame_queue.maxlen
                self._frame_queue.append(frame)

                if queue_was_full:
                    self._dropped_frames += 1
                    if self._dropped_frames % 10 == 1:  # Log every 10th drop
                        logger.warning(
                            f"Backpressure: dropped frame (total: {self._dropped_frames})"
                        )

                # Notify worker that frames are available
                self._frames_available.notify()

        except Exception as e:
            logger.error(f"Failed to handle motion event: {e}")

    def _worker_loop(self) -> None:
        """Worker thread - continuously processes available frames."""
        while self._running:
            frames: List[FrameTuple] = []

            with self._frames_available:
                # Wait for frames if queue is empty
                while self._running and len(self._frame_queue) == 0:
                    self._frames_available.wait(timeout=0.1)

                if not self._running:
                    break

                # Grab all available frames (up to max_batch_size)
                batch_size = min(len(self._frame_queue), self._max_batch_size)
                for _ in range(batch_size):
                    frames.append(self._frame_queue.popleft())

            # Process batch outside lock
            if frames:
                self._process_batch(frames)

    def _process_batch(
        self,
        frames: List[Tuple[str, int, bytes, CameraObjectDetectionSettings, Set[str]]],
    ) -> None:
        """Run detection on batch and publish results."""
        try:
            results = self._detector.detect_batch(frames)

            # Publish all results in single batch (more efficient than individual publishes)
            self._publisher.publish_batch(results)

            # Log individual results
            for result in results:
                logger.info(
                    f"Camera {result.camera_id}: {len(result.boxes)} detections "
                    f"({result.processing_time_ms:.1f}ms)"
                )
        except Exception as e:
            logger.error(f"Batch detection failed: {e}")

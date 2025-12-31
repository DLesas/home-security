"""Camera configuration manager - syncs per-camera settings from Redis."""

import json
import logging
import threading
from typing import Callable, Dict, List, Optional, Tuple

import redis

from models import CameraObjectDetectionSettings, MotionZone

logger = logging.getLogger(__name__)


class CameraConfigManager:
    """
    Manages per-camera object detection configurations from Redis.

    Per-camera settings:
    - objectDetectionEnabled
    - classConfigs

    Global settings (model, clip durations) are managed by GlobalConfigManager.
    """

    def __init__(
        self,
        redis_host: str = 'localhost',
        redis_port: int = 6379,
        config_channel: str = 'camera:config',
    ):
        self._redis = redis.Redis(host=redis_host, port=redis_port, decode_responses=False)
        self._config_channel = config_channel

        # camera_id -> (camera_name, settings)
        self._cameras: Dict[str, Tuple[str, CameraObjectDetectionSettings]] = {}
        self._lock = threading.Lock()

        # Single callback for camera changes
        self._on_change: Optional[Callable[[str, str, str, Optional[CameraObjectDetectionSettings]], None]] = None

        # Subscriber thread
        self._subscriber_thread: Optional[threading.Thread] = None
        self._running = False

    def on_change(self, callback: Callable[[str, str, str, Optional[CameraObjectDetectionSettings]], None]) -> None:
        """
        Register callback for camera config changes.

        Callback receives (action, camera_id, camera_name, settings).
        action is 'created', 'updated', or 'deleted'.
        """
        self._on_change = callback

    def start(self) -> None:
        """Start config manager - discover cameras and subscribe to changes."""
        logger.info("Starting camera config manager")

        # Discover existing cameras
        self._discover_cameras()

        # Start subscriber thread
        self._running = True
        self._subscriber_thread = threading.Thread(target=self._subscribe_loop, daemon=True)
        self._subscriber_thread.start()

        logger.info(f"Config manager started with {len(self._cameras)} camera(s)")

    def stop(self) -> None:
        """Stop config manager and close Redis connections."""
        self._running = False
        if self._subscriber_thread:
            self._subscriber_thread.join(timeout=10.0)  # Allow time for cleanup
        # Close main Redis connection
        self._redis.close()

    def get_camera(self, camera_id: str) -> Optional[Tuple[str, CameraObjectDetectionSettings]]:
        """Get camera settings by ID."""
        with self._lock:
            return self._cameras.get(camera_id)

    def get_enabled_cameras(self) -> Dict[str, Tuple[str, CameraObjectDetectionSettings]]:
        """Get all cameras with object detection enabled."""
        with self._lock:
            return dict(self._cameras)

    def _discover_cameras(self) -> None:
        """Discover cameras from Redis on startup."""
        try:
            cursor = 0
            while True:
                cursor, keys = self._redis.scan(cursor, match='cameras:*', count=100)
                for key in keys:
                    key_str = key.decode() if isinstance(key, bytes) else key
                    if 'index' in key_str:
                        continue

                    try:
                        data = self._redis.execute_command('JSON.GET', key)
                        if data:
                            camera_data = json.loads(data)
                            self._process_camera_data('created', camera_data)
                    except Exception as e:
                        logger.warning(f"Failed to load camera {key_str}: {e}")

                if cursor == 0:
                    break

        except Exception as e:
            logger.error(f"Failed to discover cameras: {e}")

    def _subscribe_loop(self) -> None:
        """Subscribe to camera config changes."""
        pubsub = None
        try:
            pubsub = self._redis.pubsub()
            pubsub.subscribe(self._config_channel)

            logger.info(f"Subscribed to {self._config_channel}")

            while self._running:
                message = pubsub.get_message(timeout=1.0)
                if message and message['type'] == 'message':
                    try:
                        data = json.loads(message['data'])
                        action = data.get('action')
                        camera_data = data.get('camera', {})
                        self._process_camera_data(action, camera_data)
                    except Exception as e:
                        logger.error(f"Failed to process config message: {e}")

        except Exception as e:
            logger.error(f"Subscriber loop error: {e}")
        finally:
            if pubsub:
                pubsub.close()

    def _process_camera_data(self, action: str, camera_data: dict) -> None:
        """Process camera config update."""
        camera_id = camera_data.get('externalID')
        camera_name = camera_data.get('name', camera_id)

        if not camera_id:
            return

        # Check if object detection is enabled
        object_detection_enabled = camera_data.get('objectDetectionEnabled', False)

        if action in ('created', 'updated'):
            if object_detection_enabled:
                try:
                    settings = self._parse_settings(camera_data)
                    with self._lock:
                        self._cameras[camera_id] = (camera_name, settings)
                    logger.info(f"Camera {camera_name}: object detection enabled")
                    self._notify_change(action, camera_id, camera_name, settings)
                except Exception as e:
                    logger.warning(f"Failed to parse settings for {camera_name}: {e}")
            else:
                # Object detection disabled - remove from tracking
                with self._lock:
                    if camera_id in self._cameras:
                        del self._cameras[camera_id]
                        logger.info(f"Camera {camera_name}: object detection disabled")
                        self._notify_change('deleted', camera_id, camera_name, None)

        elif action == 'deleted':
            with self._lock:
                if camera_id in self._cameras:
                    del self._cameras[camera_id]
            self._notify_change('deleted', camera_id, camera_name, None)

    def _parse_settings(self, camera_data: dict) -> CameraObjectDetectionSettings:
        """Parse per-camera object detection settings."""
        # Parse classConfigs from JSON string if needed (may be double-encoded)
        class_configs = camera_data.get('classConfigs', [])
        if isinstance(class_configs, str):
            class_configs = json.loads(class_configs)
            # Handle double-encoding (string containing JSON string)
            if isinstance(class_configs, str):
                class_configs = json.loads(class_configs)

        # Parse motionZones from JSON string if needed
        motion_zones_raw = camera_data.get('motionZones', [])
        if isinstance(motion_zones_raw, str):
            motion_zones_raw = json.loads(motion_zones_raw)

        # Convert to MotionZone objects
        motion_zones = [
            MotionZone(
                id=z.get('id', ''),
                name=z.get('name', ''),
                points=[(p[0], p[1]) for p in z.get('points', [])],
            )
            for z in motion_zones_raw
        ]

        return CameraObjectDetectionSettings(
            class_configs=class_configs,
            motion_zones=motion_zones,
        )

    def _notify_change(
        self,
        action: str,
        camera_id: str,
        camera_name: str,
        settings: Optional[CameraObjectDetectionSettings],
    ) -> None:
        """Notify registered callback of camera change."""
        if self._on_change:
            try:
                self._on_change(action, camera_id, camera_name, settings)
            except Exception as e:
                logger.error(f"Callback error: {e}")

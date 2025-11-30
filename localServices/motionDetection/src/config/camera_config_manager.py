"""Camera configuration manager with real-time updates via Redis pub/sub."""

import os
import json
import logging
import threading
from typing import Callable, Dict, List, Optional, Tuple

import redis

from .config_validator import ConfigValidator
from models import RedisCameraConfig, MotionDetectionSettings

logger = logging.getLogger(__name__)

CAMERA_CONFIG_CHANNEL = os.getenv('CAMERA_CONFIG_CHANNEL', 'camera:config')

# Callback type: (action, camera_id, camera_name, settings) -> None
# action: 'created', 'updated', 'deleted'
# settings: None for 'deleted' action
ChangeCallback = Callable[[str, str, str, Optional[MotionDetectionSettings]], None]


class CameraConfigManager:
    """
    Manages camera configurations with real-time updates via Redis pub/sub.

    Single source of truth for camera configuration in the motion detection service.
    Uses Pydantic for validation - cameras with invalid config are rejected.

    Responsibilities:
    - Initial discovery of cameras from Redis-OM
    - Subscribe to camera:config pub/sub channel for real-time updates
    - Validate all settings using Pydantic (no defaults)
    - Notify listeners when cameras are added, updated, or removed
    """

    def __init__(self, redis_client: redis.Redis):
        """
        Initialize camera config manager.

        Args:
            redis_client: Redis client instance
        """
        self._redis = redis_client
        self._validator = ConfigValidator()

        # Camera settings: camera_id -> (camera_name, settings)
        self._cameras: Dict[str, Tuple[str, MotionDetectionSettings]] = {}

        # Change listeners
        self._listeners: List[ChangeCallback] = []

        # Pub/sub state
        self._pubsub: Optional[redis.client.PubSub] = None
        self._subscriber_thread: Optional[threading.Thread] = None
        self._running = False

        logger.info(f"CameraConfigManager initialized (channel: {CAMERA_CONFIG_CHANNEL})")

    def start(self) -> None:
        """Start the config manager: initial discovery + pub/sub subscription."""
        if self._running:
            logger.warning("CameraConfigManager already running")
            return

        logger.info("Starting CameraConfigManager...")
        self._running = True

        # Initial discovery from Redis-OM
        self._discover_cameras()

        # Start pub/sub subscription in background thread
        self._start_subscription()

        logger.info(f"CameraConfigManager started with {len(self._cameras)} camera(s)")

    def stop(self) -> None:
        """Stop the config manager and cleanup."""
        if not self._running:
            return

        logger.info("Stopping CameraConfigManager...")
        self._running = False

        # Stop pub/sub
        if self._pubsub:
            try:
                self._pubsub.unsubscribe(CAMERA_CONFIG_CHANNEL)
                self._pubsub.close()
            except Exception as e:
                logger.warning(f"Error closing pubsub: {e}")
            self._pubsub = None

        # Wait for subscriber thread
        if self._subscriber_thread and self._subscriber_thread.is_alive():
            self._subscriber_thread.join(timeout=2.0)
            self._subscriber_thread = None

        logger.info("CameraConfigManager stopped")

    def on_change(self, callback: ChangeCallback) -> None:
        """
        Register a callback for camera configuration changes.

        Args:
            callback: Function called with (action, camera_id, camera_name, settings)
                      action is 'created', 'updated', or 'deleted'
                      settings is None for 'deleted' action
        """
        self._listeners.append(callback)
        logger.debug(f"Registered change listener (total: {len(self._listeners)})")

    def get_cameras(self) -> Dict[str, Tuple[str, MotionDetectionSettings]]:
        """Get all current camera configurations."""
        return self._cameras.copy()

    def get_camera(self, camera_id: str) -> Optional[Tuple[str, MotionDetectionSettings]]:
        """Get configuration for a specific camera."""
        return self._cameras.get(camera_id)

    def _discover_cameras(self) -> None:
        """Discover cameras from Redis-OM schema."""
        logger.info("Discovering cameras from Redis-OM...")
        discovered = 0

        try:
            cursor = 0
            while True:
                cursor, keys = self._redis.scan(
                    cursor=cursor,
                    match='cameras:*',
                    count=100
                )

                for key in keys:
                    try:
                        key_str = key.decode() if isinstance(key, bytes) else key
                        if 'index' in key_str:
                            continue

                        camera_data = self._redis.execute_command('JSON.GET', key, '$')
                        if camera_data:
                            parsed = json.loads(camera_data)
                            if parsed and len(parsed) > 0:
                                if self._process_camera_data('created', parsed[0]):
                                    discovered += 1

                    except Exception as e:
                        logger.warning(f"Error reading camera {key}: {e}")

                if cursor == 0:
                    break

            logger.info(f"Discovered {discovered} camera(s) with valid motion detection config")

        except Exception as e:
            logger.error(f"Camera discovery failed: {e}")

    def _process_camera_data(
        self,
        action: str,
        camera_data: RedisCameraConfig,
    ) -> bool:
        """
        Process camera data from discovery or pub/sub.

        Args:
            action: 'created', 'updated', or 'deleted'
            camera_data: Camera configuration from Redis

        Returns:
            True if camera was processed successfully
        """
        camera_id = camera_data.get('externalID')
        camera_name = camera_data.get('name', camera_id or 'unknown')

        if not camera_id:
            logger.warning(f"Camera data missing externalID, skipping")
            return False

        # Handle deletion
        if action == 'deleted':
            if camera_id in self._cameras:
                old_name = self._cameras[camera_id][0]
                del self._cameras[camera_id]
                self._notify_listeners('deleted', camera_id, old_name, None)
                logger.info(f"Camera '{old_name}' deleted")
            return True

        # Check if motion detection is enabled
        motion_enabled = camera_data.get('motionDetectionEnabled', False)
        was_tracked = camera_id in self._cameras

        if not motion_enabled:
            if was_tracked:
                # Motion detection was disabled
                old_name = self._cameras[camera_id][0]
                del self._cameras[camera_id]
                self._notify_listeners('deleted', camera_id, old_name, None)
                logger.info(f"Motion detection disabled for '{old_name}'")
            return False

        # Validate and parse settings
        settings = self._validator.parse_settings(camera_data, camera_name)
        if settings is None:
            if was_tracked:
                # Config became invalid
                old_name = self._cameras[camera_id][0]
                del self._cameras[camera_id]
                self._notify_listeners('deleted', camera_id, old_name, None)
                logger.warning(f"Config invalid for '{old_name}', removing from tracking")
            return False

        # Update tracking and notify
        self._cameras[camera_id] = (camera_name, settings)

        if was_tracked:
            self._notify_listeners('updated', camera_id, camera_name, settings)
        else:
            self._notify_listeners('created', camera_id, camera_name, settings)

        return True

    def _start_subscription(self) -> None:
        """Start pub/sub subscription in background thread."""
        self._pubsub = self._redis.pubsub()
        self._pubsub.subscribe(CAMERA_CONFIG_CHANNEL)

        self._subscriber_thread = threading.Thread(
            target=self._subscription_loop,
            name="CameraConfigSubscriber",
            daemon=True
        )
        self._subscriber_thread.start()
        logger.info(f"Subscribed to {CAMERA_CONFIG_CHANNEL}")

    def _subscription_loop(self) -> None:
        """Background thread: listen for pub/sub messages."""
        logger.debug("Subscription loop started")

        while self._running:
            try:
                message = self._pubsub.get_message(timeout=1.0)
                if message and message['type'] == 'message':
                    self._handle_message(message['data'])
            except Exception as e:
                if self._running:
                    logger.error(f"Error in subscription loop: {e}", exc_info=True)

        logger.debug("Subscription loop ended")

    def _handle_message(self, data: bytes) -> None:
        """Handle a pub/sub message from the camera config channel."""
        try:
            message = json.loads(data.decode() if isinstance(data, bytes) else data)
            action = message.get('action')
            camera_data = message.get('camera', {})

            if not action:
                logger.warning(f"Config event missing action: {message}")
                return

            camera_name = camera_data.get('name', camera_data.get('externalID', 'unknown'))
            logger.info(f"Received config event: {action} for camera '{camera_name}'")

            self._process_camera_data(action, camera_data)

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse config event: {e}")
        except Exception as e:
            logger.error(f"Error handling config event: {e}", exc_info=True)

    def _notify_listeners(
        self,
        action: str,
        camera_id: str,
        camera_name: str,
        settings: Optional[MotionDetectionSettings],
    ) -> None:
        """Notify all registered listeners of a camera change."""
        for listener in self._listeners:
            try:
                listener(action, camera_id, camera_name, settings)
            except Exception as e:
                logger.error(f"Error in change listener: {e}", exc_info=True)

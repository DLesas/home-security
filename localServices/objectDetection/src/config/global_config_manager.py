"""Global configuration manager - syncs global settings from Redis."""

import json
import logging
import threading
from dataclasses import dataclass
from typing import Callable, Optional

import redis

logger = logging.getLogger(__name__)


@dataclass
class GlobalObjectDetectionConfig:
    """Global object detection configuration."""
    model: str
    clip_pre_duration: int
    clip_post_duration: int


class GlobalConfigManager:
    """
    Manages global object detection configuration from Redis.

    - Fetches global config on startup
    - Subscribes to config:change events
    - Provides current global config to consumers
    - Notifies on model change (requires detection restart)
    """

    def __init__(
        self,
        redis_host: str = 'localhost',
        redis_port: int = 6379,
        config_redis_key: str = 'config:default',
        config_change_channel: str = 'config:change',
    ):
        self._redis = redis.Redis(host=redis_host, port=redis_port, decode_responses=True)
        self._config_redis_key = config_redis_key
        self._config_change_channel = config_change_channel

        self._config: Optional[GlobalObjectDetectionConfig] = None
        self._lock = threading.Lock()

        # Single callback for model changes (requires restart)
        self._on_model_change: Optional[Callable[[str, str], None]] = None

        # Subscriber thread
        self._subscriber_thread: Optional[threading.Thread] = None
        self._running = False

    def on_model_change(self, callback: Callable[[str, str], None]) -> None:
        """
        Register callback for model changes.

        Callback receives (old_model, new_model).
        """
        self._on_model_change = callback

    @property
    def config(self) -> GlobalObjectDetectionConfig:
        """Get current global config."""
        with self._lock:
            if self._config is None:
                raise RuntimeError("Global config not initialized - call start() first")
            return self._config

    @property
    def model(self) -> str:
        """Get current model name."""
        return self.config.model

    @property
    def clip_pre_duration(self) -> int:
        """Get clip pre-duration in seconds."""
        return self.config.clip_pre_duration

    @property
    def clip_post_duration(self) -> int:
        """Get clip post-duration in seconds."""
        return self.config.clip_post_duration

    def start(self) -> None:
        """Start config manager - fetch config and subscribe to changes."""
        logger.info("Starting global config manager")

        # Fetch initial config (required)
        self._fetch_config()

        # Start subscriber thread
        self._running = True
        self._subscriber_thread = threading.Thread(target=self._subscribe_loop, daemon=True)
        self._subscriber_thread.start()

        logger.info(f"Global config manager started (model: {self.model})")

    def stop(self) -> None:
        """Stop config manager and close Redis connections."""
        self._running = False
        if self._subscriber_thread:
            self._subscriber_thread.join(timeout=10.0)  # Allow time for GPU cleanup
        # Close main Redis connection
        self._redis.close()

    def _fetch_config(self) -> None:
        """Fetch config from Redis. Raises if not found."""
        data = self._redis.execute_command('JSON.GET', self._config_redis_key)
        if not data:
            raise RuntimeError(f"Global config not found at {self._config_redis_key}")

        config_data = json.loads(data) if isinstance(data, str) else data
        self._update_config(config_data)

    def _subscribe_loop(self) -> None:
        """Subscribe to config changes."""
        pubsub = None
        try:
            pubsub = self._redis.pubsub()
            pubsub.subscribe(self._config_change_channel)

            logger.info(f"Subscribed to {self._config_change_channel}")

            while self._running:
                message = pubsub.get_message(timeout=1.0)
                if message and message['type'] == 'message':
                    try:
                        data = json.loads(message['data'])
                        if data.get('action') == 'updated':
                            config_data = data.get('config', {})
                            self._update_config(config_data)
                    except Exception as e:
                        logger.error(f"Failed to process config message: {e}")

        except Exception as e:
            logger.error(f"Config subscriber loop error: {e}")
        finally:
            if pubsub:
                pubsub.close()

    def _update_config(self, config_data: dict) -> None:
        """Update config from Redis data."""
        new_config = GlobalObjectDetectionConfig(
            model=config_data['objectDetectionModel'],
            clip_pre_duration=int(config_data['clipPreDuration']),
            clip_post_duration=int(config_data['clipPostDuration']),
        )

        old_model = self._config.model if self._config else None

        with self._lock:
            self._config = new_config

        # Only notify if model changed
        if old_model and old_model != new_config.model:
            logger.info(f"Model changed: {old_model} -> {new_config.model}")
            if self._on_model_change:
                try:
                    self._on_model_change(old_model, new_config.model)
                except Exception as e:
                    logger.error(f"Model change callback error: {e}")

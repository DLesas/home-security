"""Application settings loaded from environment variables."""

import os
from dataclasses import dataclass


@dataclass
class Settings:
    """Application settings."""

    # Redis
    redis_host: str = os.getenv('REDIS_HOST', 'localhost')
    redis_port: int = int(os.getenv('REDIS_PORT', '6379'))

    # Global config key (must match backend CONFIG_ENTITY_ID)
    # Redis-OM stores as: {schema}:{entity_id} -> "config:default"
    config_redis_key: str = os.getenv('CONFIG_REDIS_KEY', 'config:default')

    # Global config change channel
    config_change_channel: str = os.getenv('CONFIG_CHANGE_CHANNEL', 'config:change')

    # Camera config channel
    camera_config_channel: str = os.getenv('CAMERA_CONFIG_CHANNEL', 'camera:config')

    # Detection channel prefix for publishing results
    detection_channel_prefix: str = os.getenv('DETECTION_CHANNEL_PREFIX', 'detection:')

    # Motion channel prefix for subscribing
    motion_channel_prefix: str = os.getenv('MOTION_CHANNEL_PREFIX', 'motion:')

    # Weights directory
    weights_dir: str = os.getenv('WEIGHTS_DIR', '/app/src/models/weights')

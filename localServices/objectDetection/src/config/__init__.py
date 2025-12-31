"""Configuration module for object detection service."""

from .settings import Settings
from .global_config_manager import GlobalConfigManager, GlobalObjectDetectionConfig
from .camera_config_manager import CameraConfigManager

__all__ = [
    'Settings',
    'GlobalConfigManager',
    'GlobalObjectDetectionConfig',
    'CameraConfigManager',
]

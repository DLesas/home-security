"""Configuration management for the motion detection service."""

from .config_validator import ConfigValidator
from .camera_config_manager import CameraConfigManager

__all__ = [
    "ConfigValidator",
    "CameraConfigManager",
]

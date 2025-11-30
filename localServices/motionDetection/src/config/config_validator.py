"""Validates and parses camera configuration from Redis using Pydantic."""

import logging
from typing import Optional

from pydantic import ValidationError

from models import RedisCameraConfig, MotionDetectionSettings, MOG2Settings

logger = logging.getLogger(__name__)


class ConfigValidator:
    """
    Validates and parses camera configuration using Pydantic.

    All motion detection settings must come from Redis - no defaults.
    Cameras missing required fields are rejected with clear error messages.
    """

    def parse_settings(
        self,
        camera_data: RedisCameraConfig,
        camera_name: str,
    ) -> Optional[MotionDetectionSettings]:
        """
        Parse and validate camera data into MotionDetectionSettings.

        Args:
            camera_data: Camera configuration from Redis
            camera_name: Camera name for error logging

        Returns:
            MotionDetectionSettings if valid, None otherwise
        """
        try:
            # Parse MOG2 settings from flat camera data
            mog2 = MOG2Settings.model_validate(camera_data)

            # Parse full settings (zones are nested)
            settings = MotionDetectionSettings(
                enabled=camera_data.get('motionDetectionEnabled', False),
                mog2=mog2,
                zones=camera_data.get('motionZones', []),
            )

            return settings

        except ValidationError as e:
            logger.warning(f"Invalid config for camera '{camera_name}': {e}")
            return None
        except Exception as e:
            logger.error(f"Error parsing config for camera '{camera_name}': {e}")
            return None

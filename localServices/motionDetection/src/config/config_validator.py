"""Validates and parses camera configuration from Redis using Pydantic."""

import json
import logging
from typing import Optional, List, Any

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

            # Parse motionZones - may be a JSON string from Redis-OM or a list from pub/sub
            zones = self._parse_motion_zones(camera_data.get('motionZones', []))

            # Parse full settings (zones are nested)
            settings = MotionDetectionSettings(
                enabled=camera_data.get('motionDetectionEnabled', False),
                mog2=mog2,
                zones=zones,
            )

            return settings

        except ValidationError as e:
            logger.warning(f"Invalid config for camera '{camera_name}': {e}")
            return None
        except Exception as e:
            logger.error(f"Error parsing config for camera '{camera_name}': {e}")
            return None

    def _parse_motion_zones(self, zones_data: Any) -> List[Any]:
        """
        Parse motion zones data, handling both JSON string and list formats.

        Redis-OM stores motionZones as a JSON string, but pub/sub events
        send them as a proper list. This method handles both cases.

        Args:
            zones_data: Motion zones as string or list

        Returns:
            List of motion zone dictionaries
        """
        if zones_data is None:
            return []

        # If already a list, return as-is
        if isinstance(zones_data, list):
            return zones_data

        # If it's a string, try to parse as JSON
        if isinstance(zones_data, str):
            try:
                parsed = json.loads(zones_data)
                if isinstance(parsed, list):
                    return parsed
                logger.warning(f"motionZones JSON is not a list: {type(parsed)}")
                return []
            except json.JSONDecodeError as e:
                logger.warning(f"Failed to parse motionZones JSON: {e}")
                return []

        logger.warning(f"Unexpected motionZones type: {type(zones_data)}")
        return []

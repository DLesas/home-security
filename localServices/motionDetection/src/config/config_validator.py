"""Validates and parses camera configuration from Redis using Pydantic."""

import json
import logging
from typing import Optional, List, Any

from pydantic import ValidationError

from models import (
    RedisCameraConfig,
    MotionDetectionSettings,
    DetectionModel,
    SimpleDiffSettings,
    KNNSettings,
    MOG2Settings,
    ModelSettings,
)

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
            # Get detection model (defaults to MOG2)
            detection_model_str = camera_data.get('detectionModel', 'mog2')
            detection_model = DetectionModel(detection_model_str)

            # Parse model settings - may be JSON string from Redis-OM or dict from pub/sub
            model_settings = self._parse_model_settings(
                camera_data.get('modelSettings'),
                detection_model,
                camera_name,
            )

            if model_settings is None:
                return None

            # Parse motionZones - may be a JSON string from Redis-OM or a list from pub/sub
            zones = self._parse_motion_zones(camera_data.get('motionZones', []))

            # Build full settings using Pydantic model
            # Use Python field names since we're passing already-parsed objects
            settings = MotionDetectionSettings(
                enabled=camera_data.get('motionDetectionEnabled', False),
                detection_model=detection_model,
                model_settings=model_settings,
                zones=zones,
            )

            return settings

        except ValidationError as e:
            logger.warning(f"Invalid config for camera '{camera_name}': {e}")
            return None
        except Exception as e:
            logger.error(f"Error parsing config for camera '{camera_name}': {e}")
            return None

    def _parse_model_settings(
        self,
        settings_data: Any,
        detection_model: DetectionModel,
        camera_name: str,
    ) -> Optional[ModelSettings]:
        """
        Parse model-specific settings based on detection model type.

        Args:
            settings_data: Model settings as string or dict
            detection_model: The detection model type
            camera_name: Camera name for error logging

        Returns:
            Parsed ModelSettings or None if invalid
        """
        if settings_data is None:
            logger.warning(f"Missing modelSettings for camera '{camera_name}'")
            return None

        # If it's a string, parse as JSON first
        if isinstance(settings_data, str):
            try:
                settings_data = json.loads(settings_data)
            except json.JSONDecodeError as e:
                logger.warning(f"Failed to parse modelSettings JSON for '{camera_name}': {e}")
                return None

        if not isinstance(settings_data, dict):
            logger.warning(f"modelSettings is not a dict for '{camera_name}': {type(settings_data)}")
            return None

        try:
            if detection_model == DetectionModel.SIMPLE_DIFF:
                return SimpleDiffSettings.model_validate(settings_data)
            elif detection_model == DetectionModel.KNN:
                return KNNSettings.model_validate(settings_data)
            else:  # MOG2 (default)
                return MOG2Settings.model_validate(settings_data)
        except ValidationError as e:
            logger.warning(f"Invalid {detection_model.value} settings for '{camera_name}': {e}")
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

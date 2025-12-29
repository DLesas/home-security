"""Dedicated logging for motion detection events."""

import logging
from typing import Optional

from models import MotionResult

logger = logging.getLogger('motion.events')


class MotionLogger:
    """
    Dedicated logging for motion detection events.

    Separates logging concerns from business logic.
    Injected as a dependency into the frame consumer.
    """

    def log_motion_detected(
        self,
        result: MotionResult,
        camera_name: str,
        detection_model: str = "unknown",
    ) -> None:
        """Log a motion detection event."""
        if not result.has_motion:
            return

        # Find zones that triggered
        triggered_zones = [z for z in result.zone_results if z.has_motion]
        zone_info = ', '.join(
            f"'{z.zone_name}' ({z.motion_percentage}%)"
            for z in triggered_zones
        )

        logger.info(
            f"Motion detected [{detection_model}]: '{camera_name}' - {zone_info} "
            f"({result.processing_time_ms:.1f}ms)"
        )

    def log_processing_error(self, result: MotionResult, camera_name: str) -> None:
        """Log a processing error."""
        if result.error:
            logger.error(f"Processing error for '{camera_name}': {result.error}")

    def log_camera_added(self, camera_name: str, zone_count: int) -> None:
        """Log camera addition."""
        logger.info(f"Camera added: '{camera_name}' with {zone_count} zone(s)")

    def log_camera_removed(self, camera_name: str) -> None:
        """Log camera removal."""
        logger.info(f"Camera removed: '{camera_name}'")

    def log_camera_updated(self, camera_name: str, mog2_reset: bool) -> None:
        """Log camera update."""
        if mog2_reset:
            logger.info(f"Camera updated: '{camera_name}' (MOG2 reset)")
        else:
            logger.info(f"Camera updated: '{camera_name}' (settings only)")

    def log_batch_stats(
        self,
        batch_size: int,
        camera_count: int,
        total_time_ms: float,
    ) -> None:
        """Log batch processing statistics."""
        logger.debug(
            f"Processed {batch_size} frame(s) from {camera_count} camera(s) "
            f"in {total_time_ms:.1f}ms"
        )

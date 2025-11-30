"""Mask analysis for motion detection with zone support."""

import logging
from typing import List, Optional

import cv2
import numpy as np

from models import (
    ForegroundMask,
    MotionResult,
    ZoneMotionResult,
    MotionZone,
    MotionDetectionSettings,
)

logger = logging.getLogger(__name__)


class MaskAnalyzer:
    """
    Analyzes foreground masks for motion detection.

    Supports zone-based detection:
    - Zone with empty points = analyze full frame
    - Zone with polygon points = analyze only that region

    Each zone has its own min_contour_area and threshold_percent settings.
    """

    def analyze(
        self,
        fg_mask: ForegroundMask,
        settings: MotionDetectionSettings,
        camera_name: str,
    ) -> MotionResult:
        """
        Analyze foreground mask for motion in all zones.

        Args:
            fg_mask: Foreground mask from MOG2
            settings: Motion detection settings with zones
            camera_name: Camera name for logging

        Returns:
            MotionResult with per-zone results
        """
        zones = settings.zones

        if not zones:
            logger.warning(f"No zones for '{camera_name}'")
            return MotionResult(
                camera_id=fg_mask.camera_id,
                has_motion=False,
                zone_results=[],
            )

        zone_results = []
        for zone in zones:
            zone_result = self._analyze_zone(fg_mask, zone)
            zone_results.append(zone_result)

        # has_motion is True if any zone detected motion
        has_motion = any(zr.has_motion for zr in zone_results)

        return MotionResult(
            camera_id=fg_mask.camera_id,
            has_motion=has_motion,
            zone_results=zone_results,
        )

    def _analyze_zone(
        self,
        fg_mask: ForegroundMask,
        zone: MotionZone,
    ) -> ZoneMotionResult:
        """
        Analyze a single zone for motion.

        Args:
            fg_mask: Full frame foreground mask
            zone: Zone configuration

        Returns:
            ZoneMotionResult for this zone
        """
        # Get zone mask (full frame or polygon)
        zone_mask = self._create_zone_mask(fg_mask.mask.shape, zone)

        # Apply zone mask to foreground mask
        if zone_mask is not None:
            masked_fg = cv2.bitwise_and(fg_mask.mask, zone_mask)
            zone_pixels = cv2.countNonZero(zone_mask)
        else:
            # Full frame mode
            masked_fg = fg_mask.mask
            zone_pixels = fg_mask.frame_shape[0] * fg_mask.frame_shape[1]

        # Find contours in the masked foreground
        contours, _ = cv2.findContours(
            masked_fg,
            cv2.RETR_EXTERNAL,
            cv2.CHAIN_APPROX_SIMPLE,
        )

        # Filter by minimum contour area
        significant = [
            c for c in contours
            if cv2.contourArea(c) > zone.min_contour_area
        ]

        # Calculate metrics
        motion_areas = [cv2.contourArea(c) for c in significant]
        total_motion_pixels = sum(motion_areas)
        percentage = (total_motion_pixels / zone_pixels) * 100 if zone_pixels > 0 else 0

        # Apply threshold
        has_motion = (
            len(significant) > 0 and
            percentage >= zone.threshold_percent
        )

        return ZoneMotionResult(
            id=zone.id,
            zone_name=zone.name,
            has_motion=has_motion,
            motion_percentage=round(percentage, 2),
            motion_regions=len(significant),
            total_motion_pixels=int(total_motion_pixels),
        )

    def _create_zone_mask(
        self,
        mask_shape: tuple,
        zone: MotionZone,
    ) -> Optional[np.ndarray]:
        """
        Create a binary mask for a zone.

        Args:
            mask_shape: Shape of the foreground mask (height, width)
            zone: Zone configuration

        Returns:
            Binary mask (255 inside zone, 0 outside) or None for full frame
        """
        if zone.is_full_frame():
            return None

        # Create empty mask
        zone_mask = np.zeros(mask_shape[:2], dtype=np.uint8)

        # Draw filled polygon
        points = np.array(zone.points, dtype=np.int32)
        cv2.fillPoly(zone_mask, [points], 255)

        return zone_mask

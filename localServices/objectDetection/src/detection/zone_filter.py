"""Filter detections by motion zones."""

import logging
from typing import List, Set, Tuple

import cv2
import numpy as np

from models import DetectionBox, MotionZone

logger = logging.getLogger(__name__)


def point_in_polygon(point: Tuple[float, float], polygon: List[Tuple[int, int]]) -> bool:
    """
    Check if a point is inside a polygon using cv2.pointPolygonTest.

    Args:
        point: (x, y) coordinates
        polygon: List of (x, y) vertices

    Returns:
        True if point is inside or on the edge of the polygon
    """
    if not polygon:
        return True  # Empty polygon = full frame

    contour = np.array(polygon, dtype=np.int32)
    result = cv2.pointPolygonTest(contour, point, measureDist=False)
    return result >= 0  # >= 0 means inside or on edge


def filter_detections_by_zones(
    boxes: List[DetectionBox],
    zones: List[MotionZone],
    zones_with_motion: Set[str],
) -> List[DetectionBox]:
    """
    Filter detection boxes to only include those inside zones with motion.

    A detection is included if its center point is inside any zone that:
    1. Has motion detected
    2. OR is a full-frame zone with motion

    Args:
        boxes: List of detection boxes
        zones: List of motion zone definitions
        zones_with_motion: Set of zone IDs that have motion

    Returns:
        Filtered list of detection boxes
    """
    if not boxes:
        return []

    if not zones:
        # No zones defined - shouldn't happen but return all boxes
        return boxes

    # Build zone lookup
    zone_map = {z.id: z for z in zones}

    # Filter boxes
    filtered = []
    for box in boxes:
        center = box.center

        # Check each zone with motion
        for zone_id in zones_with_motion:
            zone = zone_map.get(zone_id)
            if zone is None:
                continue

            # Full frame zone - include all detections
            if zone.is_full_frame():
                filtered.append(box)
                break

            # Polygon zone - check if center is inside
            if point_in_polygon(center, zone.points):
                filtered.append(box)
                break

    return filtered

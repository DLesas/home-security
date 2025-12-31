"""Detection module - YOLO inference."""

from .object_detector import ObjectDetector
from .zone_filter import filter_detections_by_zones

__all__ = ['ObjectDetector', 'filter_detections_by_zones']

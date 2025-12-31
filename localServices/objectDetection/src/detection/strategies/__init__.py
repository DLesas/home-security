"""Detection strategies."""

from .base_strategy import BaseDetectionStrategy
from .yolo_strategy import YOLOStrategy

__all__ = ['BaseDetectionStrategy', 'YOLOStrategy']

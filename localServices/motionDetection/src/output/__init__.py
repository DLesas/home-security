"""Output handlers for motion detection results."""

from .motion_logger import MotionLogger
from .motion_publisher import MotionPublisher

__all__ = [
    "MotionLogger",
    "MotionPublisher",
]

"""Motion detection module with strategy pattern for CPU/GPU processing."""

from .motion_detector import MotionDetector
from .mask_analyzer import MaskAnalyzer
from .strategies import (
    ProcessingStrategy,
    SimpleDiffStrategy,
    KNNStrategy,
    MOG2Strategy,
)

__all__ = [
    "MotionDetector",
    "MaskAnalyzer",
    "ProcessingStrategy",
    "SimpleDiffStrategy",
    "KNNStrategy",
    "MOG2Strategy",
]

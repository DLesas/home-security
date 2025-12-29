"""Processing strategies for motion detection."""

from .base_strategy import ProcessingStrategy
from .simple_diff_strategy import SimpleDiffStrategy
from .knn_strategy import KNNStrategy
from .mog2_strategy import MOG2Strategy

__all__ = [
    "ProcessingStrategy",
    "SimpleDiffStrategy",
    "KNNStrategy",
    "MOG2Strategy",
]

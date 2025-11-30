"""Processing strategies for motion detection."""

from .base_strategy import ProcessingStrategy
from .cpu_strategy import CPUProcessingStrategy
from .gpu_strategy import GPUProcessingStrategy
from .gpu_batch_strategy import GPUBatchProcessingStrategy

__all__ = [
    "ProcessingStrategy",
    "CPUProcessingStrategy",
    "GPUProcessingStrategy",
    "GPUBatchProcessingStrategy",
]

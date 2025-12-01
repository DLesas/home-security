"""Utility functions for the motion detection service."""

from .gpu_detection import detect_gpu_capabilities, GPUCapabilities
from .retry import (
    RetryConfig,
    REDIS_RETRY_CONFIG,
    calculate_backoff_delay,
    retry_with_backoff,
    sleep_with_check,
)

__all__ = [
    "detect_gpu_capabilities",
    "GPUCapabilities",
    "RetryConfig",
    "REDIS_RETRY_CONFIG",
    "calculate_backoff_delay",
    "retry_with_backoff",
    "sleep_with_check",
]

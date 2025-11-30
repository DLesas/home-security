"""Utility functions for the motion detection service."""

from .gpu_detection import detect_gpu_capabilities, GPUCapabilities

__all__ = [
    "detect_gpu_capabilities",
    "GPUCapabilities",
]

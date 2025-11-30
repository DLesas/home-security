"""GPU capability detection for OpenCV CUDA operations."""

import logging
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class GPUCapabilities:
    """GPU capability information."""
    gpu_available: bool
    cuda_streams_available: bool
    device_count: int
    device_id: Optional[int]
    device_name: Optional[str]

    @property
    def recommended_strategy(self) -> str:
        """Get the recommended processing strategy name."""
        if not self.gpu_available:
            return "cpu"
        elif self.cuda_streams_available:
            return "gpu_batch"
        else:
            return "gpu"


def detect_gpu_capabilities() -> GPUCapabilities:
    """
    Detect GPU and CUDA capabilities for OpenCV.

    Returns:
        GPUCapabilities with detection results
    """
    result = GPUCapabilities(
        gpu_available=False,
        cuda_streams_available=False,
        device_count=0,
        device_id=None,
        device_name=None,
    )

    try:
        import cv2

        # Check for CUDA-enabled devices
        cuda_count = cv2.cuda.getCudaEnabledDeviceCount()
        result.device_count = cuda_count

        if cuda_count > 0:
            result.gpu_available = True
            result.device_id = cv2.cuda.getDevice()

            # Try to get device name
            try:
                # OpenCV doesn't expose device name directly,
                # but we can log the device ID
                logger.info(
                    f"GPU detected: CUDA device {result.device_id} "
                    f"({cuda_count} device(s) available)"
                )
            except Exception:
                pass

            # Check for CUDA streams support
            try:
                test_stream = cv2.cuda_Stream()
                result.cuda_streams_available = True
                logger.info("CUDA streams available (parallel batch processing enabled)")
                del test_stream
            except Exception as e:
                logger.info(f"CUDA streams not available: {e}")
                logger.info("Using deferred downloads mode for GPU processing")

        else:
            logger.info("No CUDA GPU detected, using CPU processing")

    except AttributeError:
        logger.info("OpenCV not compiled with CUDA support, using CPU processing")
    except ImportError:
        logger.warning("OpenCV (cv2) not installed")
    except Exception as e:
        logger.warning(f"GPU detection error: {e}, falling back to CPU")

    return result

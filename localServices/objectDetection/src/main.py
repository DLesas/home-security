"""Object Detection Service - Entry Point.

Consumes motion events from Redis pub/sub and runs YOLO object detection
on frames where motion was detected. Results are published back to Redis
for the backend to handle DB writes and clip extraction.
"""

import logging
import os
import signal
import sys

import torch

from config import Settings, GlobalConfigManager, CameraConfigManager
from detection import ObjectDetector
from streaming import MotionEventConsumer
from output import DetectionPublisher

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stdout,
)
logger = logging.getLogger(__name__)


def log_gpu_info() -> None:
    """Log GPU availability and info."""
    logger.info("=" * 60)
    logger.info("GPU Information")
    logger.info("=" * 60)

    if torch.cuda.is_available():
        logger.info(f"CUDA available: True")
        logger.info(f"CUDA version: {torch.version.cuda}")
        logger.info(f"GPU count: {torch.cuda.device_count()}")
        for i in range(torch.cuda.device_count()):
            props = torch.cuda.get_device_properties(i)
            memory_gb = props.total_memory / (1024 ** 3)
            logger.info(f"  GPU {i}: {props.name} ({memory_gb:.1f} GB)")
    else:
        logger.warning("CUDA not available - running on CPU")
        logger.warning("Object detection will be slower without GPU acceleration")

    logger.info("=" * 60)


def main() -> None:
    """Main entry point."""
    logger.info("Starting Object Detection Service")

    # Log GPU info
    log_gpu_info()

    # Load settings
    settings = Settings()
    logger.info(f"Redis: {settings.redis_host}:{settings.redis_port}")

    # Initialize global config manager (watches global model/clip settings)
    logger.info("Initializing global config manager...")
    global_config = GlobalConfigManager(
        redis_host=settings.redis_host,
        redis_port=settings.redis_port,
        config_redis_key=settings.config_redis_key,
        config_change_channel=settings.config_change_channel,
    )
    global_config.start()

    # Initialize camera config manager (watches per-camera settings)
    logger.info("Initializing camera config manager...")
    camera_config = CameraConfigManager(
        redis_host=settings.redis_host,
        redis_port=settings.redis_port,
        config_channel=settings.camera_config_channel,
    )
    camera_config.start()

    # Initialize detector (uses global config for model)
    logger.info("Initializing object detector...")
    detector = ObjectDetector(
        global_config=global_config,
        weights_dir=settings.weights_dir,
    )
    detector.start()

    # Initialize publisher
    publisher = DetectionPublisher(
        redis_host=settings.redis_host,
        redis_port=settings.redis_port,
        channel_prefix=settings.detection_channel_prefix,
    )

    # Initialize and start consumer
    consumer = MotionEventConsumer(
        redis_host=settings.redis_host,
        redis_port=settings.redis_port,
        detector=detector,
        camera_config=camera_config,
        publisher=publisher,
        channel_prefix=settings.motion_channel_prefix,
    )

    # Graceful shutdown handler
    def shutdown_handler(signum, frame):
        logger.info(f"Received signal {signum}, initiating graceful shutdown...")
        consumer.stop()
        publisher.close()
        detector.stop()
        camera_config.stop()
        global_config.stop()
        logger.info("Object Detection Service stopped")
        sys.exit(0)

    # Register signal handlers for graceful shutdown
    signal.signal(signal.SIGTERM, shutdown_handler)
    signal.signal(signal.SIGINT, shutdown_handler)

    logger.info("Starting motion event consumer...")
    try:
        consumer.start()
    except Exception as e:
        logger.error(f"Consumer error: {e}")
    finally:
        logger.info("Shutting down...")
        consumer.stop()
        publisher.close()
        detector.stop()
        camera_config.stop()
        global_config.stop()
        logger.info("Object Detection Service stopped")


if __name__ == "__main__":
    main()

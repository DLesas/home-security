"""
Motion Detection Service - Main Entry Point

Event-driven motion detection service for home security cameras.
Subscribes to camera config changes via Redis pub/sub and processes
frames from Redis Streams using GPU-accelerated MOG2 background subtraction.

All configuration comes from Redis - no defaults in this service.
"""

import os
import sys
import logging

import redis

from config import CameraConfigManager
from detection import MotionDetector
from streaming import FrameStreamConsumer
from output import MotionLogger, MotionPublisher

# Configure logging
LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO').upper()
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

logger = logging.getLogger(__name__)


def main():
    """Initialize and start the motion detection service."""
    logger.info("=" * 60)
    logger.info("Motion Detection Service Starting")
    logger.info("=" * 60)

    # Configuration from environment
    redis_host = os.getenv('REDIS_HOST', 'localhost')
    redis_port = int(os.getenv('REDIS_PORT', '6379'))
    redis_db = int(os.getenv('REDIS_DB', '0'))
    consumer_group = os.getenv('CONSUMER_GROUP', 'motion-detectors')
    consumer_name = os.getenv('HOSTNAME', 'worker-1')
    block_timeout_ms = int(os.getenv('BLOCK_TIMEOUT_MS', '50'))

    logger.info("Configuration:")
    logger.info(f"  Redis: {redis_host}:{redis_port}/{redis_db}")
    logger.info(f"  Consumer group: {consumer_group}")
    logger.info(f"  Consumer name: {consumer_name}")
    logger.info(f"  Block timeout: {block_timeout_ms}ms")

    # Connect to Redis
    try:
        redis_client = redis.Redis(
            host=redis_host,
            port=redis_port,
            db=redis_db,
            decode_responses=False  # Binary mode for JPEG buffers
        )
        redis_client.ping()
        logger.info("Connected to Redis")
    except Exception as e:
        logger.error(f"Failed to connect to Redis: {e}")
        sys.exit(1)

    # Initialize components with dependency injection
    config_manager = None
    try:
        # 1. Motion detector (strategies created per-camera based on detection model)
        detector = MotionDetector()
        logger.info("Motion detector initialized (per-camera strategy pattern)")

        # 2. Camera config manager
        config_manager = CameraConfigManager(redis_client)
        logger.info("Camera config manager initialized")

        # 3. Output handlers (injected dependencies)
        motion_logger = MotionLogger()
        motion_publisher = MotionPublisher(redis_client)
        logger.info("Output handlers initialized")

        # 4. Frame stream consumer (orchestrates everything)
        consumer = FrameStreamConsumer(
            redis_client=redis_client,
            detector=detector,
            config_manager=config_manager,
            motion_logger=motion_logger,
            motion_publisher=motion_publisher,
            consumer_group=consumer_group,
            consumer_name=consumer_name,
            block_timeout_ms=block_timeout_ms,
        )
        logger.info("Frame stream consumer initialized")

    except Exception as e:
        logger.error(f"Failed to initialize components: {e}")
        sys.exit(1)

    # Start config manager (discovery + subscription)
    try:
        config_manager.start()
        logger.info("Camera config manager started")
    except Exception as e:
        logger.error(f"Failed to start config manager: {e}")
        sys.exit(1)

    logger.info("=" * 60)
    logger.info("Service ready - Starting consumer loop")
    logger.info("=" * 60)

    # Start consuming frames
    try:
        consumer.consume_and_process()
    except KeyboardInterrupt:
        logger.info("Shutting down gracefully...")
    except Exception as e:
        logger.error(f"Fatal error in consumer: {e}", exc_info=True)
        sys.exit(1)
    finally:
        # Cleanup
        if config_manager:
            config_manager.stop()
            logger.info("Camera config manager stopped")

        try:
            redis_client.close()
            logger.info("Redis connection closed")
        except Exception:
            pass

    logger.info("Motion Detection Service stopped")


if __name__ == '__main__':
    main()

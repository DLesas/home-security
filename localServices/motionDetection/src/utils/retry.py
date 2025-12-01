"""Retry utilities with exponential backoff."""

import logging
import time
from typing import Callable, Optional, TypeVar, Any

logger = logging.getLogger(__name__)

T = TypeVar('T')


class RetryConfig:
    """Configuration for retry behavior."""

    def __init__(
        self,
        max_retries: Optional[int] = None,  # None = infinite retries
        base_delay: float = 1.0,
        max_delay: float = 30.0,
        multiplier: float = 2.0,
        jitter: bool = True,
    ):
        """
        Initialize retry configuration.

        Args:
            max_retries: Maximum number of retries (None for infinite)
            base_delay: Initial delay in seconds
            max_delay: Maximum delay between retries in seconds
            multiplier: Exponential backoff multiplier
            jitter: Add randomness to delay to prevent thundering herd
        """
        self.max_retries = max_retries
        self.base_delay = base_delay
        self.max_delay = max_delay
        self.multiplier = multiplier
        self.jitter = jitter


# Default configuration for Redis reconnection
REDIS_RETRY_CONFIG = RetryConfig(
    max_retries=None,  # Keep retrying forever
    base_delay=1.0,
    max_delay=30.0,
    multiplier=2.0,
    jitter=True,
)


def calculate_backoff_delay(
    attempt: int,
    config: RetryConfig,
) -> float:
    """
    Calculate delay for a given retry attempt using exponential backoff.

    Args:
        attempt: Current attempt number (1-based)
        config: Retry configuration

    Returns:
        Delay in seconds
    """
    import random

    delay = config.base_delay * (config.multiplier ** (attempt - 1))
    delay = min(delay, config.max_delay)

    if config.jitter:
        # Add up to 25% jitter
        jitter_range = delay * 0.25
        delay += random.uniform(-jitter_range, jitter_range)
        delay = max(0.1, delay)  # Ensure minimum delay

    return delay


def retry_with_backoff(
    func: Callable[[], T],
    config: RetryConfig = REDIS_RETRY_CONFIG,
    on_retry: Optional[Callable[[int, Exception, float], None]] = None,
    should_stop: Optional[Callable[[], bool]] = None,
    operation_name: str = "operation",
) -> Optional[T]:
    """
    Execute a function with exponential backoff retry.

    Args:
        func: Function to execute
        config: Retry configuration
        on_retry: Optional callback called before each retry with (attempt, exception, delay)
        should_stop: Optional callback to check if retrying should stop
        operation_name: Name of operation for logging

    Returns:
        Result of func if successful, None if all retries exhausted or stopped
    """
    attempt = 0

    while True:
        attempt += 1

        # Check if we should stop
        if should_stop and should_stop():
            logger.info(f"Retry stopped for {operation_name}")
            return None

        # Check max retries
        if config.max_retries is not None and attempt > config.max_retries:
            logger.error(f"Max retries ({config.max_retries}) exhausted for {operation_name}")
            return None

        try:
            return func()
        except Exception as e:
            delay = calculate_backoff_delay(attempt, config)

            if on_retry:
                on_retry(attempt, e, delay)
            else:
                logger.warning(
                    f"{operation_name} failed (attempt {attempt}): {e}. "
                    f"Retrying in {delay:.1f}s..."
                )

            # Sleep with periodic checks for stop signal
            sleep_with_check(delay, should_stop)


def sleep_with_check(
    duration: float,
    should_stop: Optional[Callable[[], bool]] = None,
    check_interval: float = 0.5,
) -> bool:
    """
    Sleep for a duration, periodically checking if we should stop.

    Args:
        duration: Total sleep duration in seconds
        should_stop: Optional callback to check if we should stop early
        check_interval: How often to check should_stop

    Returns:
        True if sleep completed, False if stopped early
    """
    elapsed = 0.0

    while elapsed < duration:
        if should_stop and should_stop():
            return False

        sleep_time = min(check_interval, duration - elapsed)
        time.sleep(sleep_time)
        elapsed += sleep_time

    return True

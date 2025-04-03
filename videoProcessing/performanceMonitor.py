from dataclasses import dataclass, field
from typing import Dict, Any, Optional, Callable, DefaultDict, Literal
from contextlib import contextmanager
import time
import logging
from queue import Queue
import threading
from collections import defaultdict
import functools
import multiprocessing as mp


@dataclass
class TimingStats:
    """
    A dataclass for tracking timing statistics of operations.

    This class maintains running statistics for timing measurements including total time,
    count of measurements, maximum and minimum values.

    Attributes:
        total (float): The sum of all timing measurements.
        count (int): The number of measurements taken.
        max (float): The maximum timing value recorded.
        min (float): The minimum timing value recorded (initialized to infinity).
    """
    total: float = 0.0
    count: int = 0
    max: float = 0.0
    min: float = field(default=float("inf"))

    def update(self, value: float) -> None:
        """
        Update statistics with a new timing measurement.

        Args:
            value (float): The new timing value to incorporate into the statistics.
        """
        self.total += value
        self.count += 1
        self.max = max(self.max, value)
        self.min = min(self.min, value)

    def reset(self) -> None:
        """Reset all statistics to their initial values."""
        self.__init__()  # Simplified reset by using __init__

    @property
    def average(self) -> float:
        """
        Calculate the average timing value.

        Returns:
            float: The average timing value. Returns 0.0 if no measurements have been taken.
        """
        return self.total / self.count if self.count > 0 else 0.0


# def create_frame_counts() -> Dict[str, int]:
#     return {"processed": 0, "dropped": 0}


def create_timing_stats() -> Dict[str, TimingStats]:
    return defaultdict(TimingStats)


@contextmanager
def measure_operation(queue: mp.Queue, stream_id: str, operation: str):
    """Standalone context manager for measuring operation duration"""
    start = time.time()
    try:
        yield
    finally:
        duration = time.time() - start
        queue.put((stream_id, operation, duration))


class MultiProcessMonitor:
    """
    A monitoring system for tracking performance metrics across multiple processes.

    This class handles the collection and reporting of timing statistics and logging
    messages across different components of a multi-process system. It processes
    performance metrics and logging messages from queues and periodically reports
    the statistics.

    Attributes:
        log_interval (float): Time in seconds between logging reports.
        metrics (DefaultDict[str, Dict[str, TimingStats]]): Nested dictionary storing
            timing statistics for each stream and operation.
        logger (logging.Logger): Logger instance for output.
        _metrics_lock (threading.Lock): Thread lock for safe metrics access.
        performance_queue (mp.Queue): Queue for receiving performance metrics.
        logging_queue (mp.Queue): Queue for receiving logging messages.
        frame_counters (Dict): Dictionary containing all frame-related counters.
        last_log_time (float): Timestamp of the last logging event.
    """

    def __init__(
        self,
        performance_queue: mp.Queue,
        logging_queue: mp.Queue,
        grabber_processed_frames: mp.Value,
        grabber_drop_frames: mp.Value,
        processor_processed_frames: mp.Value,
        processor_drop_frames: mp.Value,
        log_interval: float = 5.0,
    ) -> None:
        """Initialize the MultiProcessMonitor."""
        self.log_interval = log_interval
        self.metrics = defaultdict(lambda: defaultdict(TimingStats))
        self.logger = logging.getLogger(__name__)
        self._metrics_lock = threading.Lock()
        
        # Store queues and counters
        self.performance_queue = performance_queue
        self.logging_queue = logging_queue
        self.frame_counters = {
            'grabber': {'processed': grabber_processed_frames, 'dropped': grabber_drop_frames},
            'processor': {'processed': processor_processed_frames, 'dropped': processor_drop_frames}
        }
        self.last_log_time = time.time()

    def process_queues(self) -> None:
        """
        Process all pending items in the performance and logging queues.

        This method processes performance metrics and logging messages from their
        respective queues in a non-blocking manner. Performance metrics are added
        to the running statistics, and logging messages are output through the
        logger.
        """
        # Process all items in the performance queue
        while not self.performance_queue.empty():
            try:
                stream_id, operation, duration = self.performance_queue.get_nowait()
                with self._metrics_lock:
                    self.metrics[stream_id][operation].update(duration)
            except Empty:
                break
            
        # Process all items in the logging queue
        while not self.logging_queue.empty():
            try:
                msg = self.logging_queue.get_nowait()
                self.logger.log(
                    logging.getLevelName(msg["severity"].upper()),
                    msg["message"]
                )
            except Empty:
                break

    def should_log(self) -> bool:
        """
        Check if enough time has elapsed to log metrics.

        Returns:
            bool: True if the log_interval has elapsed since the last log, False otherwise.
        """
        return time.time() - self.last_log_time >= self.log_interval

    def log_metrics(self) -> None:
        """
        Log the current performance metrics for all streams.

        Generates and logs a formatted report of all timing statistics, including
        average, minimum, and maximum times for each operation within each stream.
        The report is both printed to stdout and logged through the logger.
        """
        with self._metrics_lock:
            for stream_id, operations in self.metrics.items():
                report = [
                    "\n" + "=" * 50,
                    f"Stream: {stream_id}",
                    "=" * 50,
                    "\nOperation Timings (ms):",
                    f"{'Operation':<20} {'Average':>10} {'Min':>10} {'Max':>10}",
                    "-" * 50
                ]

                for op_name, stats in sorted(operations.items()):
                    if stats.count > 0:
                        report.append(
                            f"{op_name:<20} {stats.average*1000:>10.1f} "
                            f"{stats.min*1000:>10.1f} {stats.max*1000:>10.1f}"
                        )

                report = "\n".join(report)
                print(report)
                self.logger.info(report)

            self._reset_metrics()
            self.last_log_time = time.time()

    def _reset_metrics(self) -> None:
        """Reset all accumulated metrics to their initial values."""
        with self._metrics_lock:
            self.metrics.clear()

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
    total: float = 0.0
    count: int = 0
    max: float = 0.0
    min: float = field(default=float('inf'))
    
    def update(self, value: float) -> None:
        self.total += value
        self.count += 1
        self.max = max(self.max, value)
        self.min = min(self.min, value)
    
    def reset(self) -> None:
        self.total = 0.0
        self.count = 0
        self.max = 0.0
        self.min = float('inf')
    
    @property
    def average(self) -> float:
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
    def __init__(self, performance_queue: mp.Queue, logging_queue: mp.Queue, grabber_processed_frames: mp.Value, grabber_drop_frames: mp.Value, processor_processed_frames: mp.Value, processor_drop_frames: mp.Value, log_interval: float = 5.0) -> None:
        self.log_interval: float = log_interval
        self.metrics: DefaultDict[str, Dict[str, TimingStats]] = defaultdict(create_timing_stats)
        # self.frame_counts: DefaultDict[str, Dict[str, int]] = defaultdict(create_frame_counts)
        self.logger: logging.Logger = logging.getLogger(__name__)
        self.running: bool = False
        self.monitor_thread: Optional[threading.Thread] = None
        self._metrics_lock = threading.Lock()
        self.performance_queue: mp.Queue = performance_queue
        self.logging_queue: mp.Queue = logging_queue
        self.grabber_processed_frames: mp.Value = grabber_processed_frames
        self.grabber_drop_frames: mp.Value = grabber_drop_frames
        self.processor_processed_frames: mp.Value = processor_processed_frames
        self.processor_drop_frames: mp.Value = processor_drop_frames
        

    def start(self) -> None:
        """Start the monitoring thread"""
        self.running = True
        self.monitor_thread = threading.Thread(target=self._monitoring_loop)
        self.monitor_thread.start()
        self.logger.info("Centralized performance monitoring started")
        
    def stop(self) -> None:
        """Stop the monitoring thread"""
        self.running = False
        if self.monitor_thread:
            self.monitor_thread.join()
        self.logger.info("Centralized performance monitoring stopped")
        
    def _monitoring_loop(self) -> None:
        """Main monitoring loop that periodically logs metrics"""
        last_log_time = time.time()
        
        while self.running:
            current_time = time.time()
            
            # Process all items in the queue
            while not self.performance_queue.empty():
                try:
                    stream_id, operation, duration = self.performance_queue.get_nowait()
                    with self._metrics_lock:
                        self.metrics[stream_id][operation].update(duration)
                except Empty:
                    break
                
            while not self.logging_queue.empty():
                try:
                    message: dict = self.logging_queue.get_nowait()
                    severity: Literal["info", "error", "warning"] = message["severity"]
                    message: str = message["message"]
                    print(f"{severity.upper()}: {message}")
                    self.logger.log(logging.getLevelName(severity.upper()), message)
                except Empty:
                    break
            
            if current_time - last_log_time >= self.log_interval:
                self.log_metrics()
                self._reset_metrics()
                last_log_time = current_time
                
            time.sleep(0.1)
    
    def _reset_metrics(self) -> None:
        """Reset all metrics after logging"""
        with self._metrics_lock:
            for stream_metrics in self.metrics.values():
                for stats in stream_metrics.values():
                    stats.reset()
            
            # for counts in self.frame_counts.values():
            #     counts["processed"] = 0
            #     counts["dropped"] = 0
    
    def log_metrics(self) -> None:
        """Log current performance metrics"""
        with self._metrics_lock:
            for stream_id in self.metrics:
                # Build the complete report as a single string
                report = []
                report.append("\n" + "="*50)
                report.append(f"Stream: {stream_id}")
                report.append("="*50)
                
                # Frame statistics
                # frames = self.frame_counts[stream_id]
                # total_frames = frames["processed"] + frames["dropped"]
                # drop_rate = (frames["dropped"] / total_frames * 100) if total_frames > 0 else 0
                
                # report.append("\nFrame Statistics:")
                # report.append(f"  Processed: {frames['processed']:,d}")
                # report.append(f"  Dropped:   {frames['dropped']:,d}")
                # report.append(f"  Drop Rate: {drop_rate:.1f}%")
                
                # Operation timings table
                report.append("\nOperation Timings (ms):")
                report.append(f"{'Operation':<20} {'Average':>10} {'Min':>10} {'Max':>10}")
                report.append("-"*50)
                
                # Sort operations alphabetically for consistent output
                for op_name, stats in sorted(self.metrics[stream_id].items()):
                    if stats.count > 0:
                        report.append(
                            f"{op_name:<20} {stats.average*1000:>10.1f} "
                            f"{stats.min*1000:>10.1f} {stats.max*1000:>10.1f}"
                        )
                
                # Log everything as a single message
                print("\n".join(report))
                self.logger.info("\n".join(report))
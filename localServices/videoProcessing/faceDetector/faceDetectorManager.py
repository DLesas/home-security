import threading
from queue import Queue, Empty
from typing import List, Dict, Tuple
import multiprocessing as mp
from concurrent.futures import ThreadPoolExecutor, Future
import numpy as np
from numpy.typing import NDArray
import time
from dataclasses import dataclass
from .faceDetector import FaceDetector
from yoloProcessor import Detection, ProcessedFrame


@dataclass
class WorkerThread:
    """
    Represents a worker thread and its state.

    Attributes:
        detector (FaceDetector): The face detector instance for this worker
        future (Future): The thread's future object
        is_processing (bool): Flag indicating if the worker is currently processing frames
        last_active (float): Timestamp of last activity
    """

    detector: FaceDetector
    future: Future
    is_processing: bool = False
    last_active: float = time.time()


class FaceDetectorManager:
    """
    Manages a dynamic pool of face detector workers.

    Supports dynamic scaling of workers and ensures models are pre-loaded
    before they're needed.
    """

    def __init__(
        self,
        model_path: str,
        initial_workers: int,
        device: str,
        performance_queue: mp.Queue,
        min_workers: int = 1,
        max_workers: int = 8,
    ) -> None:
        """
        Initialize the FaceDetectorManager.

        Args:
            model_path: Path to the model file
            initial_workers: Initial number of worker threads
            device: Device to run inference on ('cpu' or 'cuda')
            performance_queue: Queue for performance metrics
            min_workers: Minimum number of workers to maintain
            max_workers: Maximum number of workers allowed
        """
        self.model_path = model_path
        self.device = device
        self.performance_queue = performance_queue
        self.min_workers = min_workers
        self.max_workers = max_workers

        # Thread-safe collections
        self.frame_queue: Queue[Tuple[List[ProcessedFrame], int]] = Queue()
        self.results_lock = threading.Lock()
        self.workers_lock = threading.Lock()
        self.results: List = []

        # Worker management
        self.executor = ThreadPoolExecutor(max_workers=max_workers)
        self.active_workers: Dict[int, WorkerThread] = {}
        self.worker_id_counter = 0

        # Initialize workers
        self._scale_workers(initial_workers)

    def _create_worker(self) -> int:
        """
        Create a new worker thread with pre-loaded model.

        Returns:
            int: ID of the new worker
        """
        with self.workers_lock:
            worker_id = self.worker_id_counter
            self.worker_id_counter += 1

            detector = FaceDetector(
                self.model_path, self.device, self.performance_queue, worker_id
            )
            future = self.executor.submit(self._worker_loop, detector, worker_id)

            self.active_workers[worker_id] = WorkerThread(detector, future)
            return worker_id

    def _remove_worker(self, worker_id: int) -> None:
        """
        Safely remove a worker thread and cleanup its resources.

        Args:
            worker_id: ID of the worker to remove
        """
        with self.workers_lock:
            if worker_id in self.active_workers:
                worker = self.active_workers[worker_id]
                if not worker.is_processing:
                    self.frame_queue.put((None, worker_id))  # Poison pill
                    worker.future.result()  # Wait for thread to finish
                    worker.detector.cleanup()  # Clean up detector resources
                    del self.active_workers[worker_id]

    def _worker_loop(self, detector: FaceDetector, worker_id: int) -> None:
        """
        Main worker thread loop.

        Args:
            detector: FaceDetector instance for this worker
            worker_id: ID of this worker
        """
        while True:
            try:
                frames, target_worker: Tuple[List[ProcessedFrame], int] = self.frame_queue.get(
                    timeout=1.0
                )
                if frames is None and target_worker == worker_id:
                    self.frame_queue.task_done()
                    break

                if target_worker != worker_id:
                    # Put back if not for this worker
                    self.frame_queue.put((frames, target_worker))
                    continue

                with self.workers_lock:
                    worker = self.active_workers[worker_id]
                    worker.is_processing = True
                    worker.last_active = time.time()

                batch_results = detector.detect(frames)

                with self.results_lock:
                    self.results.extend(batch_results)

                with self.workers_lock:
                    worker = self.active_workers[worker_id]
                    worker.is_processing = False

                self.frame_queue.task_done()

            except Empty:
                continue
            except Exception as e:
                print(f"Error in worker {worker_id}: {e}")
                continue

    def get_idle_workers(self) -> List[int]:
        """
        Get list of idle worker IDs.

        Returns:
            List[int]: IDs of idle workers
        """
        with self.workers_lock:
            return [
                worker_id
                for worker_id, worker in self.active_workers.items()
                if not worker.is_processing
            ]

    def get_worker_count(self) -> int:
        """
        Get current number of workers.

        Returns:
            int: Number of active workers
        """
        with self.workers_lock:
            return len(self.active_workers)

    def scale_workers(self, target_workers: int) -> None:
        """
        Scale the number of workers to the target amount.

        Args:
            target_workers: Desired number of workers
        """
        target_workers = max(self.min_workers, min(target_workers, self.max_workers))
        self._scale_workers(target_workers)

    def _scale_workers(self, target_workers: int) -> None:
        """
        Internal method to scale workers to target amount.

        Args:
            target_workers: Desired number of workers
        """
        with self.workers_lock:
            current_workers = len(self.active_workers)

            if target_workers > current_workers:
                # Scale up
                for _ in range(target_workers - current_workers):
                    self._create_worker()
            elif target_workers < current_workers:
                # Scale down
                workers_to_remove = sorted(
                    self.active_workers.keys(),
                    key=lambda k: self.active_workers[k].last_active,
                )[: current_workers - target_workers]

                for worker_id in workers_to_remove:
                    self._remove_worker(worker_id)

    def add_frames(self, frames: List[ProcessedFrame]) -> None:
        """
        Add frames to the processing queue.

        Args:
            frames: List of frames to process
        """
        # Round-robin assignment to workers
        with self.workers_lock:
            available_workers = [
                worker_id
                for worker_id, worker in self.active_workers.items()
                if not worker.is_processing
            ]
            if available_workers:
                worker_id = available_workers[0]
                self.frame_queue.put((frames, worker_id))

    def get_results(self) -> List:
        """
        Get all available results and clear the results list.

        Returns:
            List of detection results
        """
        with self.results_lock:
            current_results = self.results.copy()
            self.results.clear()
        return current_results

    def shutdown(self) -> None:
        """Shutdown the manager and cleanup all workers."""
        with self.workers_lock:
            worker_ids = list(self.active_workers.keys())
            for worker_id in worker_ids:
                self._remove_worker(worker_id)

        self.executor.shutdown(wait=True)

    @classmethod
    def process_frames_sync(cls, frames: List[ProcessedFrame]) -> List[ProcessedFrame]:
        """
        Process frames synchronously and wait for results.

        Args:
            frames: List of frames to process

        Returns:
            List of detection results for the batch
        """
        cls.add_frames(frames)
        # Wait until these specific frames are processed
        while True:
            results = cls.get_results()  # thankfully we process in batches, so the returned amount should be the same as the input
            if results:  # Once we have results, return them
                return results
            time.sleep(0.01)  # Small sleep to prevent busy waiting

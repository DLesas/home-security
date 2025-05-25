import subprocess
import logging
import multiprocessing as mp
from typing import Optional, Tuple
from ultralytics import YOLO
import torch

class ResourceManager:
    """Manages system resources and provides optimal processing configurations"""

    @staticmethod
    def get_gpu_memory() -> Optional[Tuple[int, int]]:
        """
        Get GPU memory information using nvidia-smi

        Returns:
            Tuple of (total_memory, used_memory) in MB, or None if GPU info unavailable
        """
        try:
            output = subprocess.check_output(
                [
                    "nvidia-smi",
                    "--query-gpu=memory.total,memory.used",
                    "--format=csv,nounits,noheader",
                ]
            )
            total_memory, used_memory = map(int, output.decode().split(","))
            return total_memory, used_memory
        except Exception as e:
            logging.warning(f"Failed to get GPU memory info: {e}")
            return None

    @staticmethod
    def get_optimal_process_count(min_cores_available: int = 4, logging_queue: mp.Queue = None) -> int:
        """
        Calculate optimal number of processes based on CPU considerations

        Args:
            min_cores_available: Minimum number of CPU cores to leave available for system

        Returns:
            int: Recommended number of processes
        """
        cpu_count = mp.cpu_count()

        # Calculate available cores for workers
        available_cores = max(1, cpu_count - min_cores_available)

        # Cap at 4 workers (diminishing returns beyond this)
        recommended = min(available_cores, 2)

        logs = [
            f"CPU Configuration:",
            f"\n\tTotal Cores: {cpu_count}",
            f"\n\tReserved Cores: {min_cores_available}",
            f"\n\tAvailable Cores: {available_cores}",
            f"\n\tRecommended Workers: {recommended}"
        ]
        if logging_queue:
            for log in logs:
                logging_queue.put({
                    "severity": "info",
                    "message": log
                })
        logging.info(
            f"CPU Configuration:"
            f"\n\tTotal Cores: {cpu_count}"
            f"\n\tReserved Cores: {min_cores_available}"
            f"\n\tAvailable Cores: {available_cores}"
            f"\n\tRecommended Workers: {recommended}"
        )

        return recommended

    @staticmethod
    def calculate_optimal_batch_size(
        model: YOLO,
        image_width: int = 640,
        image_height: int = 480,
        memory_fraction: float = 0.5,
        num_workers: int = 1,
        min_batch_size: int = 1,
        max_batch_size: int = 16,
        logging_queue: mp.Queue = None,
    ) -> int:
        """
        Calculate optimal batch size based on available GPU memory

        Args:
            model: YOLO model
            image_width: Width of input images, default 640
            image_height: Height of input images, default 480
            memory_fraction: Fraction of GPU memory to use, default 0.5
            num_workers: Number of workers (for memory division), default 1
            min_batch_size: Minimum batch size per worker, default 1
            max_batch_size: Maximum batch size per worker, default 16
            logging_queue: Queue for logging messages, default None

        Returns:
            int: Optimal batch size per worker
        """
        gpu_info = ResourceManager.get_gpu_memory()

        if gpu_info is None:
            return min_batch_size

        total_memory, used_memory = gpu_info
        torch.cuda.empty_cache()
        torch.cuda.reset_peak_memory_stats()

        # Test with both batch size 1 and 2 to estimate scaling
        batch_1_input = torch.zeros((1, 3, image_height, image_width)).cuda()
        batch_2_input = torch.zeros((2, 3, image_height, image_width)).cuda()

        # Measure memory for batch size 1
        with torch.no_grad():
            model(batch_1_input)
        memory_batch_1 = torch.cuda.max_memory_allocated() / (1024 * 1024)  # MB

        torch.cuda.empty_cache()
        torch.cuda.reset_peak_memory_stats()

        # Measure memory for batch size 2
        with torch.no_grad():
            model(batch_2_input)
        memory_batch_2 = torch.cuda.max_memory_allocated() / (1024 * 1024)  # MB

        # Calculate memory scaling factor
        memory_per_additional_image = memory_batch_2 - memory_batch_1

        # Available memory for processing
        available_memory = (total_memory - used_memory) * memory_fraction
        memory_per_worker = available_memory / num_workers

        # Calculate maximum possible batch size based on memory scaling
        max_possible_batch = min(
            int((memory_per_worker - memory_batch_1) / memory_per_additional_image + 1),
            max_batch_size
        )

        batch_size = max(min_batch_size, max_possible_batch)
        logs = [
            f"GPU Memory Estimation:", f"\n\tBase Memory (batch=1): {memory_batch_1:.2f}MB",
            f"\n\tMemory per additional image: {memory_per_additional_image:.2f}MB",
            f"\n\tBatch size: {batch_size}",
            f"\n\tGPU Memory - Total: {total_memory}MB",
            f"\n\tAvailable: {memory_per_worker:.0f}MB per worker with {num_workers} workers",
        ]
        if logging_queue:
            for log in logs:
                logging_queue.put({
                    "severity": "info",
                    "message": log
                })
        logging.info(
            f"GPU Memory Estimation:"
            f"\n\tBase Memory (batch=1): {memory_batch_1:.2f}MB"
            f"\n\tMemory per additional image: {memory_per_additional_image:.2f}MB"
            f"\n\tBatch size: {batch_size}"
            f"\n\tGPU Memory - Total: {total_memory}MB"
            f"\n\tAvailable: {memory_per_worker:.0f}MB per worker with {num_workers} workers"
        )

        return batch_size

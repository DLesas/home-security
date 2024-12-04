import psutil
import subprocess
import logging
import multiprocessing as mp
from typing import Optional, Tuple

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
    def get_optimal_process_count(min_cores_available: int = 4) -> int:
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
        memory_fraction: float = 0.8,
        num_workers: int = 1,
        min_batch_size: int = 1,
        max_batch_size: int = 16,
    ) -> int:
        """
        Calculate optimal batch size based on available GPU memory

        Args:
            memory_fraction: Fraction of GPU memory to use
            num_workers: Number of workers (for memory division)
            min_batch_size: Minimum batch size per worker
            max_batch_size: Maximum batch size per worker

        Returns:
            int: Optimal batch size per worker
        """
        gpu_info = ResourceManager.get_gpu_memory()

        if gpu_info is None:
            return min_batch_size

        total_memory, used_memory = gpu_info
        available_memory = (total_memory - used_memory) * memory_fraction

        # Estimate memory per image (adjust based on your model)
        estimated_memory_per_image = 500  # MB

        memory_per_worker = available_memory / num_workers
        max_possible_batch = min(
            int(memory_per_worker / estimated_memory_per_image), max_batch_size
        )

        batch_size = max(min_batch_size, max_possible_batch)

        logging.info(
            f"Batch size: {batch_size} "
            f"(GPU Memory - Total: {total_memory}MB, "
            f"Available: {available_memory:.0f}MB per worker)"
        )

        return batch_size

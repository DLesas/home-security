import os
import time
import gc
import supervisor
from microcontroller import cpu

class microDevice:
    def __init__(self):
        self.read_only = self.check_serial_connection()
    
    @staticmethod
    def collect_garbage():
        """
        Collect garbage and print the amount of free memory.
        """
        gc.collect()
        print(f"Free memory: {gc.mem_free()} bytes")
        
    @staticmethod
    def check_serial_connection(timeout=5):
        start_time = time.monotonic()
        while time.monotonic() - start_time < timeout:
            if supervisor.runtime.serial_connected:
                return True
            time.sleep(0.1)  # Small delay to prevent busy-waiting
        return False
    
    @staticmethod
    def get_file_size(path_to_file: str) -> int:
        """
        Get the size of a file.

        Args:
            path_to_file (str): The path to the file.

        Returns:
            int: The size of the file in bytes. Returns -1 if there's an error accessing the file.
        """
        try:
            return os.stat(path_to_file)[6]
        except OSError as e:
            print(f"Error getting file size: {e}")
            return -1
        
    @staticmethod
    def read_temperature():
        return cpu.temperature
        
    @staticmethod
    def read_voltage():
        return cpu.voltage
        
    @staticmethod
    def read_frequency():
        return cpu.frequency
import os
import time
import gc
import adafruit_hashlib as hashlib
from collections import deque
from typing import Union, Literal

def inject_function_name(func):
    """
    Decorator to inject the function name into the function's keyword arguments.

    Args:
        func (function): The function to be decorated.

    Returns:
        function: The wrapped function with the function name injected.
    """
    def wrapper(self, *args, **kwargs):
        # Use getattr to safely get the function name or provide a fallback
        func_name = getattr(func, '__name__', str(func))
        return func(self, *args, **kwargs, func_name=func_name)
    return wrapper

class LogType:
    Error = 'Error'
    Warning = 'Warning'
    Info = 'Info'
    Debug = 'Debug'
    Critical = 'Critical'

class Logger:
    def __init__(self, microDevice, led, max_logs=100, memory_threshold_percent=20):
        """
        Initialize the Logger class with in-memory storage.
        
        Args:
            microDevice: The microDevice instance
            led: The LED instance for visual feedback
            max_logs: Maximum number of log entries to keep in memory
            memory_threshold_percent: Minimum free memory percentage to maintain
        """
        self.Device = microDevice
        self.Led = led
        self.max_logs = max_logs
        self.memory_threshold_percent = memory_threshold_percent
        
        # In-memory storage for logs
        self.logs = deque([], max_logs)  # CircuitPython deque: (iterable, maxlen)
        self.log_counts = {}  # Track duplicate counts by hash
        
        # Track memory usage
        self.last_memory_check = time.monotonic()
        self.memory_check_interval = 10  # seconds
        
        print(f"Logger initialized with in-memory storage (max {max_logs} entries)")
        self._check_memory_usage()

    def _check_memory_usage(self):
        """Check current memory usage and adjust if needed."""
        try:
            gc.collect()
            free_memory = gc.mem_free()
            total_memory = free_memory + gc.mem_alloc()
            free_percent = (free_memory / total_memory) * 100
            
            if free_percent < self.memory_threshold_percent:
                # Remove oldest logs to free memory
                remove_count = min(20, len(self.logs) // 4)  # Remove 25% or 20 logs, whichever is less
                for _ in range(remove_count):
                    if self.logs:
                        removed = self.logs.popleft()  # Remove from front (oldest)
                        # Clean up count tracking for removed log
                        if 'hash' in removed:
                            hash_key = removed['hash']
                            if hash_key in self.log_counts:
                                del self.log_counts[hash_key]
                
                gc.collect()
                new_free = gc.mem_free()
                print(f"Memory low ({free_percent:.1f}%), removed {remove_count} logs, freed {new_free - free_memory} bytes")
            
            return free_percent
        except Exception as e:
            print(f"Error checking memory: {e}")
            return 100  # Assume enough memory on error

    def log_issue(self, type: LogType, class_name: str, function_name: str, error_message: str):
        """
        Log an issue to memory.

        Args:
            type: The type of issue (LogType.Error, LogType.Warning, LogType.Info, LogType.Debug, LogType.Critical)
            class_name: The name of the class
            function_name: The name of the function  
            error_message: The error message to log
        """
        # Periodically check memory
        if time.monotonic() - self.last_memory_check > self.memory_check_interval:
            self._check_memory_usage()
            self.last_memory_check = time.monotonic()
        
        # Generate hash for deduplication
        hash_input = f"{type}{class_name}{function_name}{error_message}"
        hash_obj = hashlib.sha256(hash_input.encode())
        hashTxt = "".join(["{:02x}".format(b) for b in hash_obj.digest()])
        
        # Create the formatted text output (original format)
        text = f"""
*** New Log ***
Type: {type}
Class: {class_name}
Function: {function_name}
Message: {error_message}
Hash: {hashTxt}
        """
        
        # Get timestamp
        try:
            timestamp = time.localtime()
            date_time = "{:04d}-{:02d}-{:02d} {:02d}:{:02d}:{:02d}".format(
                timestamp[0], timestamp[1], timestamp[2],
                timestamp[3], timestamp[4], timestamp[5]
            )
        except:
            date_time = str(time.monotonic())  # Fallback to monotonic time
        
        # Check if this is a duplicate
        if hashTxt in self.log_counts:
            self.log_counts[hashTxt] += 1
            # Update the existing log entry
            for log in reversed(self.logs):
                if log.get('hash') == hashTxt:
                    log['count'] = self.log_counts[hashTxt]
                    log['last_seen'] = date_time
                    break
        else:
            # Create new log entry
            self.log_counts[hashTxt] = 1
            log_entry = {
                'timestamp': date_time,
                'type': type,
                'class': class_name,
                'function': function_name,
                'message': error_message,
                'hash': hashTxt,
                'count': 1,
                'last_seen': date_time
            }
            
            # Add to logs (deque will automatically remove oldest if at max)
            self.logs.append(log_entry)
            
            # If we're at max capacity, clean up orphaned hash counts
            if len(self.logs) >= self.max_logs:
                # Clean up any orphaned hash counts (from automatically removed logs)
                active_hashes = {log.get('hash') for log in self.logs if 'hash' in log}
                self.log_counts = {k: v for k, v in self.log_counts.items() if k in active_hashes}
        
        # Print to console (using original formatted text)
        print(text)
        if hashTxt in self.log_counts and self.log_counts[hashTxt] > 1:
            print(f"This log has occurred {self.log_counts[hashTxt]} times")
        
        # Visual feedback
        self.Led.blink(3, 0.5)
        
        # Collect garbage after logging
        self.Device.collect_garbage()
    
    def get_logs_for_sending(self):
        """
        Get all logs formatted for sending to the server.
        
        Returns:
            list: List of log dictionaries ready for JSON serialization
        """
        # Convert deque to list and format for sending
        logs_to_send = []
        for log in self.logs:
            # Create a clean copy without internal fields
            clean_log = {
                'Timestamp': log.get('timestamp', ''),
                'Type': log.get('type', ''),
                'Class': log.get('class', ''),
                'Function': log.get('function', ''),
                'Error_Message': log.get('message', ''),
                'Hash': log.get('hash', ''),
                'Count': log.get('count', 1)
            }
            logs_to_send.append(clean_log)
        
        return logs_to_send
    
    def clear_logs(self):
        """Clear all logs from memory after successful send."""
        # CircuitPython deque doesn't have clear(), so remove all items manually
        while self.logs:
            self.logs.popleft()
        self.log_counts.clear()  # dict.clear() should still work
        print("Logs cleared from memory")
        self.Device.collect_garbage()
    
    def check_log_files(self):
        """
        Check if logs need to be sent (compatibility method).
        
        Returns:
            bool: True if there are logs to send, False otherwise
        """
        # Check if we have logs and if memory is getting low
        if len(self.logs) > 0:
            free_percent = self._check_memory_usage()
            # Send logs if we have more than 50 or memory is below 30%
            return len(self.logs) > 50 or free_percent < 30
        return False
    
    def truncate_log_file(self, path: str, rows_to_keep: int = 0):
        """
        Compatibility method - clears logs when rows_to_keep is 0.
        
        Args:
            path (str): Ignored (for compatibility)
            rows_to_keep (int): If 0, clears all logs
        """
        if rows_to_keep == 0:
            self.clear_logs()
        else:
            # Keep only the most recent logs
            if len(self.logs) > rows_to_keep:
                # Remove logs from the left (oldest) until we have the right count
                while len(self.logs) > rows_to_keep:
                    removed = self.logs.popleft()
                    # Clean up hash count for removed log
                    if 'hash' in removed:
                        removed_hash = removed['hash']
                        if removed_hash in self.log_counts:
                            del self.log_counts[removed_hash]
        
        self.Device.collect_garbage()
    
    def get_memory_stats(self):
        """Get current memory statistics."""
        gc.collect()
        free = gc.mem_free()
        used = gc.mem_alloc()
        total = free + used
        return {
            'free': free,
            'used': used,
            'total': total,
            'free_percent': (free / total) * 100,
            'log_count': len(self.logs),
            'unique_logs': len(self.log_counts)
        }
    
    def print_stats(self):
        """Print current logger statistics."""
        stats = self.get_memory_stats()
        print("Logger Statistics:")
        print(f"  Logs in memory: {stats['log_count']}/{self.max_logs}")
        print(f"  Unique log types: {stats['unique_logs']}")
        print(f"  Memory: {stats['used']}/{stats['total']} bytes used ({100-stats['free_percent']:.1f}%)")
        print(f"  Free memory: {stats['free']} bytes ({stats['free_percent']:.1f}%)")
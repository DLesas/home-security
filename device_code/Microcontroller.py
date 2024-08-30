from machine import Pin, Timer # type: ignore
import gc # type: ignore
import utime # type: ignore
import os
import uhashlib # type: ignore

class MicroController:
    """
    A class to manage the MicroController's operations including LED control, logging, and file management.
    """

    def __init__(self, led: Pin = Pin(25, Pin.OUT)):
        """
        Initialize the MicroController object.

        Args:
            led (Pin): The LED pin object. Defaults to the onboard LED (Pin 25).
        """
        self.log_dir = 'logs'
        self.issue_file = 'issue_logs.csv'
        self.led = led
        self.fatal_error = False

    @staticmethod
    def collect_garbage():
        """
        Collect garbage and print the amount of free memory.
        """
        gc.collect()
        print(f"Free memory: {gc.mem_free()} bytes")
    
    # the optinal total_blinks argument has a code smell but I'm unsure how to correct it for micropython
    def blink(self, times_per_second: int, indefinite: bool = False, total_blinks: 'int | None' = None):
        """
        Blink the LED at a specified rate.

        Args:
            times_per_second (int): Number of blinks per second.
            indefinite (bool): If True, blink indefinitely. Defaults to False.
            total_blinks (int | None): Total number of blinks if not indefinite. Defaults to None.

        Returns:
            Timer: The initialized timer object for blinking.
        """
        timer = Timer()
        count = 0
        
        def blink_led(blink_timer):
            nonlocal count
            self.led.toggle()
            count += 1
            if not indefinite and count >= total_blinks:
                self.stop_blinking(blink_timer)
        
        blink_timer = timer.init(freq=times_per_second, mode=Timer.PERIODIC, callback=blink_led)
        return blink_timer
    
    def stop_blinking(self, blink_timer: Timer):
        """
        Stop the LED from blinking.

        Args:
            blink_timer (Timer): The timer object controlling the blinking.
        """
        blink_timer.deinit()
        self.led.off()
        if self.fatal_error:
            self.led.on()
    
    def log_issue(self, type: str, className: str, functionName: str, error_message: str):
        """
        Log an issue to a CSV file.

        Args:
            type (str): The type of issue.
            className (str): The name of the class where the issue occurred.
            functionName (str): The name of the function where the issue occurred.
            error_message (str): The error message to log.
        """
        file_path = f'{self.log_dir}/{self.issue_file}'
        # Create hash of classname + functionname + error_message
        hash_input = f"{className}{functionName}{error_message}"
        hash_obj = uhashlib.md5(hash_input.encode())
        hashTxt = ''.join(['{:02x}'.format(b) for b in hash_obj.digest()])
        # Create logs directory if it doesn't exist
        try:
            os.mkdir(self.log_dir)
        except OSError:
            # Directory already exists or creation failed
            pass
        try:
            last_line = ''
            file_exists = file_path in os.listdir(self.log_dir)
            
            if file_exists:
                with open(file_path, 'r+b') as f:
                    f.seek(-2, 2)  # Jump to the second last byte
                    while f.read(1) != b'\n':  # Until EOL is found...
                        f.seek(-2, 1)  # ...jump back the read byte plus one more
                    last_line = f.readline().decode().strip()

                timestamp = utime.localtime()
                date_time = "{:04d}-{:02d}-{:02d} {:02d}:{:02d}:{:02d}".format(
                    timestamp[0], timestamp[1], timestamp[2],
                    timestamp[3], timestamp[4], timestamp[5]
                )

                if last_line:
                    last_hash = last_line.split(',')[-2]  # Get the hash from the last line
                    if last_hash == hashTxt:
                        # If hash matches, increment the count and overwrite the last line
                        count = int(last_line.split(',')[-1]) + 1
                        new_line = f"{date_time},{className},{functionName},{error_message},{hashTxt},{count}\n"
                        f.seek(-len(last_line)-1, 2)  # Move cursor to the start of the last line
                        f.write(new_line.encode())  # Overwrite the last line
                    else:
                        # If hash doesn't match, append a new entry with count 1
                        new_line = f"{date_time},{className},{functionName},{error_message},{hashTxt},1\n"
                        f.write(new_line.encode())
                else:
                    # If it's the first entry, start with count 1
                    new_line = f"{date_time},{className},{functionName},{error_message},{hashTxt},1\n"
                    f.write(new_line.encode())
            else:
                # If file doesn't exist, create it and write the header and first entry
                with open(file_path, 'w') as f:
                    f.write("Timestamp,Class,Function,Error_Message,Hash,Count\n")
                    new_line = f"{date_time},{className},{functionName},{error_message},{hashTxt},1\n"
                    f.write(new_line)
            print(f"Error logged: {type} - {error_message}")
            if last_line:
                print(f"Previous log entry: {last_line}")
            print(f"New log entry: {new_line.strip()}")
        except Exception as e:
            print(f"Failed to log error: {e}")
    
    @staticmethod        
    def get_file_size(path_to_file: str) -> int:
        """
        Get the size of a file.

        Args:
            path_to_file (str): The path to the file.

        Returns:
            int: The size of the file in bytes.

        Raises:
            OSError: If there's an error accessing the file.
        """
        try:
            return os.stat(path_to_file)[6]
        except OSError as e:
            print(f"Error getting file size: {e}")
            return -1
         
    def check_delete_rows_csv(self, path: str, max_size: int = 1024 * 1024, rows_to_keep: int = 1000):
        """
        Check the size of a CSV file and delete rows if it exceeds the maximum size.

        Args:
            path (str): The path to the CSV file.
            max_size (int): The maximum allowed file size in bytes. Defaults to 1MB.
            rows_to_keep (int): The number of rows to keep if trimming is needed. Defaults to 1000.

        Returns:
            bool: True if the file was trimmed, False otherwise.
        """
        try:
            if os.stat(path)[6] > max_size:  # Check file size efficiently
                with open(path, 'r+') as f:
                    header = f.readline()  # Preserve original header
                    lines = f.readlines()
                    if len(lines) > rows_to_keep:
                        f.seek(0)
                        f.write(header)
                        f.writelines(lines[-rows_to_keep:])
                        f.truncate()
                return True  # File was trimmed
            return False  # No action needed
        except OSError as e:
            self.fatal_error = True
            print(f"Error: {e}")
            return False

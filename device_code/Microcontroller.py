from machine import Pin, Timer# type: ignore
import gc # type: ignore
import utime # type: ignore
import os
import uhashlib # type: ignore
import ujson # type: ignore
import urequests # type: ignore
import network # type: ignore
import functools

def inject_function_name(func):
    """
    Decorator to inject the function name into the function's keyword arguments.

    Args:
        func (function): The function to be decorated.

    Returns:
        function: The wrapped function with the function name injected.
    """
    @functools.wraps(func)
    def wrapper(self, *args, **kwargs):
        return func(self, *args, **kwargs, func_name=func.__name__)
    return wrapper

def log_errors(func=None, *, logger=None):
    """
    Decorator to log errors that occur in the decorated function.

    Args:
        func (function, optional): The function to be decorated. Defaults to None.
        logger (object, optional): The logger object to use for logging errors. Defaults to None.

    Returns:
        function: The wrapped function with error logging.
    """
    def decorator(f):
        @functools.wraps(f)
        def wrapper(*args, **kwargs):
            try:
                return f(*args, **kwargs)
            except Exception as e:
                class_name = args[0].__class__.__name__ if args else ''
                function_name = f.__name__
                log_method = logger or (args[0].logger.log_issue if hasattr(args[0], 'logger') else None)
                if log_method:
                    log_method("Error", class_name, function_name, str(e))
                else:
                    print(f"Error in {class_name}.{function_name}: {str(e)}")
                raise
        return wrapper
    return decorator if func is None else decorator(func)

class MicroController:
    """
    A class to manage the MicroController's operations including LED control, logging, and file management.
    """

    def __init__(self, log_endpoint: str, led: Pin = Pin(25, Pin.OUT), max_log_file_size: int = 512 * 1024):
        """
        Initialize the MicroController object.

        Args:
            log_endpoint (str): The endpoint to send logs to.
            led (Pin): The LED pin object. Defaults to the onboard LED (Pin 25).
            max_log_file_size (int): The maximum size of log files in bytes. Defaults to 512KB.
        """
        self.log_dir = 'logs'
        self.issue_file = 'issue_logs.csv'
        self.led = led
        self.max_log_file_size = max_log_file_size
        self.log_endpoint = log_endpoint
        self.fatal_error = False
        self.name = None

    @staticmethod
    def collect_garbage():
        """
        Collect garbage and print the amount of free memory.
        """
        gc.collect()
        print(f"Free memory: {gc.mem_free()} bytes")

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
            
    def set_fatal_error(self):
        """
        Set the fatal error flag and turn on the LED.
        """
        self.fatal_error = True
        self.led.on()

    def log_issue(self, type: str, class_name: str, function_name: str, error_message: str, level: str = 'ERROR'):
        """
        Log an issue to a CSV file.

        Args:
            type (str): The type of issue.
            class_name (str): The name of the class where the issue occurred.
            function_name (str): The name of the function where the issue occurred.
            error_message (str): The error message to log.
            level (str): The logging level. Defaults to 'ERROR'.
        """
        file_path = f'{self.log_dir}/{self.issue_file}'
        hash_input = f"{class_name}{function_name}{error_message}"
        hash_obj = uhashlib.md5(hash_input.encode())
        hashTxt = ''.join(['{:02x}'.format(b) for b in hash_obj.digest()])
        try:
            os.mkdir(self.log_dir)
        except OSError:
            pass
        try:
            last_line = ''
            file_exists = file_path in os.listdir(self.log_dir)
            if file_exists:
                with open(file_path, 'r+b') as f:
                    f.seek(-2, 2)
                    while f.read(1) != b'\n':
                        f.seek(-2, 1)
                    last_line = f.readline().decode().strip()

                timestamp = utime.localtime()
                date_time = "{:04d}-{:02d}-{:02d} {:02d}:{:02d}:{:02d}".format(
                    timestamp[0], timestamp[1], timestamp[2],
                    timestamp[3], timestamp[4], timestamp[5]
                )

                if last_line:
                    last_hash = last_line.split(',')[-2]
                    if last_hash == hashTxt:
                        count = int(last_line.split(',')[-1]) + 1
                        new_line = f"{date_time},{class_name},{function_name},{error_message},{hashTxt},{count}\n"
                        f.seek(-len(last_line)-1, 2)
                        f.write(new_line.encode())
                    else:
                        new_line = f"{date_time},{class_name},{function_name},{error_message},{hashTxt},1\n"
                        f.write(new_line.encode())
                else:
                    new_line = f"{date_time},{class_name},{function_name},{error_message},{hashTxt},1\n"
                    f.write(new_line.encode())
            else:
                with open(file_path, 'w') as f:
                    f.write("Timestamp,Class,Function,Error_Message,Hash,Count\n")
                    new_line = f"{date_time},{class_name},{function_name},{error_message},{hashTxt},1\n"
                    f.write(new_line)
            print(f"{level}: {type} - {error_message}")
            if last_line:
                print(f"Previous log entry: {last_line}")
            print(f"New log entry: {new_line.strip()}")
        except Exception as e:
            print(f"Failed to log error: {e}")
        self.collect_garbage()



    # might wantto consider changing this so it works with the camera and its recordings, i.e. check size of the entire dir first then send/truncate after instead of checking each file
    @inject_function_name
    def check_all_files(self, func_name: str):
        """
        Check the size of all files in the log directory and delete rows if they exceed the maximum size.

        Args:
            func_name (str): The name of the function (injected by the decorator).
        """
        for file in os.listdir(self.log_dir):
            file_dir = f'{self.log_dir}/{file}'
            size = self.get_file_size(file_dir)
            if size > self.max_log_file_size or size == -1:
                try:
                    self.send_log(file_dir)
                except Exception as e:
                    self.log_issue('error', self.__class__.__name__, func_name, f'received error: {e} whilst trying to send logs, falling back to checking file size and potentially truncating csv file {file_dir}')
                    if self.get_file_size(file_dir) > self.max_log_file_size:
                        self.truncate_csv(file_dir)

    # might want to consider changing this so it works with the camera and its recordings, i.e. check the file format first and then send to different endpoint depending on the file type
    @inject_function_name
    def send_log(self, file_path: str, func_name: str):
        """
        Parse a CSV log file, convert it to JSON, and send it to the specified endpoint.

        Args:
            file_path (str): The path to the log file.
        """
        if not network.WLAN(network.STA_IF).isconnected():
            self.log_issue('error', self.__class__.__name__, func_name, 'Wi-Fi not connected')
            raise Exception('Wi-Fi not connected')

        try:
            with open(file_path, 'r') as f:
                header = f.readline().strip().split(',')
                data = {column: [] for column in header}
                for line in f:
                    values = line.strip().split(',')
                    for column, value in zip(header, values):
                        data[column].append(value)

            json_data = ujson.dumps(data)
            response = urequests.post(self.log_endpoint, headers={'Content-Type': 'application/json'}, data=json_data)
            if response.status_code == 200:
                print(f"Log data sent successfully to {self.log_endpoint}")
                self.truncate_csv(file_path, 50)
            else:
                raise Exception(f"Failed to send log data. Status code: {response.status_code}")
        except Exception as e:
            self.log_issue('error', self.__class__.__name__, func_name, str(e))
            raise(e)
        finally:
            if 'response' in locals():
                response.close()
            self.collect_garbage()

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

    def truncate_csv(self, path: str, rows_to_keep: int = 1000):
        """
        Check the size of a CSV file and delete rows if it exceeds the maximum size.

        Args:
            path (str): The path to the CSV file.
            rows_to_keep (int): The number of rows to keep if trimming is needed. Defaults to 1000.
        """
        try:
            with open(path, 'r+') as f:
                header = f.readline()
                lines = f.readlines()
                if len(lines) > rows_to_keep:
                    f.seek(0)
                    f.write(header)
                    f.writelines(lines[-rows_to_keep:])
                    f.truncate()
        except OSError as e:
            self.set_fatal_error()
            print(f"Error: {e}")
        self.collect_garbage()

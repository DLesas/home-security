import os
import time
import adafruit_hashlib as hashlib

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

class Logger:
    def __init__(self, microDevice):
        self.Device = microDevice
        self.log_dir = "logs"
        self.issue_file = "issue_logs.csv"
        self.max_log_file_size = 512 * 1024

    def log_issue(
        self, type: str, class_name: str, function_name: str, error_message: str
    ):
        """
        Log an issue to a CSV file or if the device is in read only mode, print the issue to the console.

        Args:
            type (str): The type of issue.
            class_name (str): The name of the class where the issue occurred.
            function_name (str): The name of the function where the issue occurred.
            error_message (str): The error message to log.
        """
        file_path = f"{self.log_dir}/{self.issue_file}"
        hash_input = f"{type}{class_name}{function_name}{error_message}"
        hash_obj = hashlib.sha256(hash_input.encode())
        hashTxt = "".join(["{:02x}".format(b) for b in hash_obj.digest()])
        text = f"""
*** New Log ***
Type: {type}
Class: {class_name}
Function: {function_name}
Message: {error_message}
Hash: {hashTxt}
        """
        if not self.Device.read_only:
            try:
                # Check if directory already exists
                if self.log_dir not in os.listdir():
                    os.mkdir(self.log_dir)
            except OSError as e:
                print('failed to make dir in log_issue: ',e)
                pass
            try:
                last_line = ""
                file_exists = file_path in os.listdir(self.log_dir)
                timestamp = time.localtime()
                date_time = "{:04d}-{:02d}-{:02d} {:02d}:{:02d}:{:02d}".format(
                    timestamp[0],
                    timestamp[1],
                    timestamp[2],
                    timestamp[3],
                    timestamp[4],
                    timestamp[5],
                )
                if file_exists:
                    with open(file_path, "r+") as f:
                        f.seek(0, 2)  # Move to the end of the file
                        if f.tell() > 0:
                            f.seek(-2, 2)
                            while f.read(1) != b"\n":
                                f.seek(-2, 1)
                            last_line = f.readline().decode().strip()
                        if last_line:
                            last_hash = last_line.split(",")[-2]
                            if last_hash == hashTxt:
                                count = int(last_line.split(",")[-1]) + 1
                                new_line = f"{date_time},{type},{class_name},{function_name},{error_message},{hashTxt},{count}\n"
                                f.seek(-len(last_line) - 1, 2)
                                f.write(new_line.encode())
                            else:
                                new_line = f"{date_time},{type},{class_name},{function_name},{error_message},{hashTxt},1\n"
                                f.write(new_line.encode())
                        else:
                            new_line = f"{date_time},{type},{class_name},{function_name},{error_message},{hashTxt},1\n"
                            f.write(new_line.encode())
                else:
                    with open(file_path, "w") as f:
                        f.write("Timestamp,Type,Class,Function,Error_Message,Hash,Count\n")
                        new_line = f"{date_time},{type},{class_name},{function_name},{error_message},{hashTxt},1\n"
                        f.write(new_line)
                print(f"{type} - {error_message}")
                if last_line:
                    print(f"Previous log entry: {last_line}")
                print(f"New log entry: {new_line.strip()}")
            except Exception as e:
                print(f"Failed to log error: {e}")
        else:
            print(text)
        self.Device.collect_garbage()
        
        
    def check_log_files(self):
        if not self.Device.read_only:
            try:
                for file in os.listdir(self.log_dir):
                    file_dir = f"{self.log_dir}/{file}"
                    size = self.Device.get_file_size(file_dir)
                    if size > self.max_log_file_size or size == -1:
                        return True
            except OSError:
                # Directory doesn't exist, no logs to check
                pass
        return False
        
    def truncate_log_file(self, path: str, rows_to_keep: int = 1000):
        """
        Check the size of a CSV file and delete rows if it exceeds the maximum size.
        This does not include/delete the header row.

        Args:
            path (str): The path to the CSV file.
            rows_to_keep (int): The number of rows to keep if trimming is needed. Defaults to 1000.
        """
        if not self.Device.read_only:
            with open(path, "r+") as f:
                header = f.readline()
                lines = f.readlines()
                if len(lines) > rows_to_keep:
                    f.seek(0)
                    f.write(header)
                    f.writelines(lines[-rows_to_keep:])
                    f.truncate()
        else:
            print(f"attempted to truncuate log at {path} but currently can't as filesystem is currently in read only")
        self.Device.collect_garbage()
    


import time
import json
import os
from deviceWifi import require_connection
from logging import inject_function_name



class Networking:
    def __init__(
        self,
        deviceWifi,
        microDevice,
        Logger,
        Led,
        server_finder,
        max_attempts,
        blink_frequency,
        server_ip,
        server_port,
        server_ssl,
        api_version,
        deviceType,
        user_agent,
    ):
        """
        Initializes the Networking class with the given parameters.

        Args:
            pico (MicroController): The microcontroller instance. This instance must implement the following methods:
                - blink(frequency: int, continuous: bool) -> Any: Starts blinking an LED at the given frequency.
                - stop_blinking(timer: Any) -> None: Stops the blinking LED.
                - log_issue(level: str, class_name: str, function_name: str, message: str) -> None: Logs an issue with a given level, class name, function name, and message.
                - set_fatal_error() -> None: Sets the device to a fatal error state.
            ssid (str): The SSID of the WiFi network.
            password (str): The password of the WiFi network.
            server_ip (str): The server ip address to interact with.
            server_port (int): The server port to interact with.
            server_service_name (str): The service name to use for the Bonjour/Avahi discovery.
            user_agent (str): The user agent to use for the handshake.
            max_attempts (int, optional): Maximum number of connection attempts. Defaults to 50.
            blink_frequency (int, optional): Frequency of the LED blink during connection attempts. Defaults to 2.
        """
        self.deviceWifi = deviceWifi
        self.Device = microDevice
        self.Logger = Logger
        self.Led = Led
        self.server_finder = server_finder
        self.max_attempts = int(max_attempts)
        self.blinks = int(blink_frequency)
        self.server_ip = server_ip
        self.server_port = int(server_port)
        self.server_protocol = 'https' if bool(int(server_ssl)) else 'http'
        self.api_version = api_version
        self.deviceType = deviceType
        self.user_agent = user_agent
        self.log_dir = "logs"  # Add log directory for send_logs method


        
    def find_server(self, func_name: str = "find_server"):
        res = self.server_finder.find_server()
        if res is not None:
            self.server_ip = res["ip"]
            #self.server_port = int(res["port"])
            #print(f"Server found: {self.server_ip} % {self.server_port}")


    @require_connection
    @inject_function_name
    def handshake_with_server(self, func_name: str = "handshake_with_server"):
        """
        Attempts to complete a handshake with the server.

        This method attempts to establish a connection with the server by sending a handshake request.
        It retries the handshake up to the class's maximum number of attempts. If the handshake fails after
        the maximum attempts, the device is set to a fatal error state.
        """
        handshake_endpoint = f"{self.server_protocol}://" + f"{self.server_ip}:{str(self.server_port)}/" + "api/" + f"v{str(self.api_version)}/" + f"{self.deviceType}s/" + str(self.deviceWifi.ID) + "/handshake"
        print("Handshaking with server...")
        attempt = 0
        success = False
        self.Led.blink(self.blinks)
        self.Led.turn_on_led()
        
        response = None  # Initialize response variable
        
        while attempt < self.max_attempts:
            try:
                # CircuitPython: Collect garbage before network operations
                self.Device.collect_garbage()
                
                data = {"macAddress": self.deviceWifi.mac}
                data = json.dumps(data)
                headers = {
                    "User-Agent": self.user_agent,
                    "Content-Type": "application/json",
                }
                response = self.deviceWifi.requests.post(
                    handshake_endpoint, headers=headers, data=data
                )
                if response.status_code == 200:
                    print("Handshake complete")
                    self.Logger.log_issue(
                        "Info",
                        self.__class__.__name__,
                        func_name,
                        f"successfully completed handshake with server {self.server_ip}",
                    )
                    success = True
                    break
                else:
                    self.Logger.log_issue(
                        "Error",
                        self.__class__.__name__,
                        func_name,
                        f"Handshake failed, got the following status code: {response.status_code} and response: {response.text}",
                    )
            except Exception as e:
                self.Logger.log_issue(
                    "Error",
                    self.__class__.__name__,
                    func_name,
                    f"Handshake error: {e}, retrying...",
                )
            finally:
                # CircuitPython: Always clean up response object
                if response is not None:
                    try:
                        response.close()
                    except:
                        pass
                    response = None
                    
            attempt += 1
            print(f"Retrying handshake... Attempt {attempt}/{self.max_attempts}")
            time.sleep(0.3)  # Optional: Add a delay between retries
            
        if not success:
            self.Logger.log_issue(
                "Error",
                self.__class__.__name__,
                func_name,
                f"Failed to complete handshake after {self.max_attempts} attempts",
            )
            self.Led.set_fatal_error()
        if "response" in locals():
            response.close()
        self.Led.turn_off_led()
      
        
    @require_connection
    @inject_function_name
    def send_logs(self, func_name: str = 'send_logs'):
        """
        Parse a CSV log file, convert it to JSON in record format, and send it to the specified endpoint.

        Args:
            file_path (str): The path to the log file.
        """
        self.Led.blink(self.blinks)
        self.Led.turn_on_led()
        for file in os.listdir(self.log_dir):
            file_path = f"{self.log_dir}/{file}"
            try:
                with open(file_path, "r") as f:
                    header = f.readline().strip().split(",")
                    records = []
                    for line in f:
                        values = line.strip().split(",")
                        record = {column: value for column, value in zip(header, values)}
                        records.append(record)
                data = records
                data = json.dumps(data)
                headers = {
                    "User-Agent": self.user_agent,
                    "Content-Type": "application/json",
                }   
                endpoint = (
                    f"{self.server_protocol}://"
                    + f"{self.server_ip}:{str(self.server_port)}/"
                    + "api/"
                    + f"v{str(self.api_version)}/"
                    + f"{self.deviceType}s/"
                    + f"logs")
                response = self.deviceWifi.requests.post(endpoint, headers=headers, data=data)
                if response.status_code == 200:
                    print(f"Log data sent successfully to {endpoint}")
                    self.Logger.truncate_log_file(file_path, 0)
                else:
                    self.Logger.truncate_log_file(file_path)
                    self.Logger.log_issue("Error", self.__class__.__name__, func_name, f"Failed to send log data. Status code: {response.status_code}, response: {response.text}")
            except Exception as e:
                self.Logger.truncate_log_file(file_path)
                self.log_issue("error", self.__class__.__name__, func_name, str(e))
            finally:
                if "response" in locals():
                    response.close()
        self.Led.turn_off_led()
        self.Device.collect_garbage()
        

    


    # def open_socket(self, server_ip: str, port: int = 80):
    #     """
    #     Opens a non-blocking socket and binds it to the specified IP address.

    #     This function creates a socket, binds it to the given IP address on port 80,
    #     sets it to listen for incoming connections, and configures it as non-blocking.

    #     Args:
    #         server_ip (str): The IP address to bind the socket to.
    #         port (int, optional): The port to bind the socket to. Defaults to 80.
    #     """
    #     address = (server_ip, port)
    #     connection = socket.socket()
    #     connection.bind(address)
    #     connection.listen()
    #     connection.setblocking(False)
    #     print(f"Listening on {server_ip}:{port}")
    #     self.connection = connection

    # @inject_function_name
    # def accept_client(self, func_name: str = "accept_client") -> tuple[socket.socket, tuple]:
    #     """
    #     Accepts a client connection from a non-blocking socket.

    #     This function attempts to accept a client connection from the given non-blocking socket.
    #     If no client is immediately available, it will retry until a connection is established.

    #     Returns:
    #         tuple[socket.socket, tuple]: A tuple containing:
    #             - socket.socket: The client socket object.
    #             - tuple: The address of the connected client.

    #     Raises:
    #         OSError: If an error occurs during the accept operation, except for EAGAIN (errno 11).
    #     """
    #     try:
    #         client, addr = self.connection.accept()
    #         return client, addr
    #     except OSError as e:
    #         if e.errno == 11:
    #             pass
    #             # EAGAIN error (Resource temporarily unavailable)
    #             # EAGAIN (Error Again) occurs when a non-blocking operation
    #             # cannot be completed immediately. In this case, it means
    #             # no client is ready to be accepted at the moment.
    #         else:
    #             self.pico.log_issue("Error", self.__class__.__name__, func_name, f"Error accepting client: {e}")
    #             print(f"Error accepting client: {e}")# Write your code here :-)

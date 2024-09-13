import network # type: ignore
import uasyncio as asyncio # type: ignore
from picozero import pico_temp_sensor, pico_led # type: ignore
import machine # type: ignore
import ujson # type: ignore
import urequests # type: ignore
import time
import socket
from Microcontroller import MicroController, inject_function_name

class Networking:
    def __init__(self, pico: MicroController, ssid: str, password: str, server_address: str, ID: int, max_attempts: int = 50, blink_frequency: int = 2):
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
            server_address (str): The server address to connect to.
            max_attempts (int, optional): Maximum number of connection attempts. Defaults to 50.
            blink_frequency (int, optional): Frequency of the LED blink during connection attempts. Defaults to 5.
        """
        self.pico = pico
        self.ssid = ssid
        self.password = password
        self.max_attempts = max_attempts
        self.wlan = network.WLAN(network.STA_IF)
        self.blink_frequency = blink_frequency
        self.server_address = server_address
        self.ID = ID
        self.connection = None
        self.ip = None
        self.mac = None
        
    def connect(self):
        """
        Connects to the WiFi network using the provided SSID and password.

        This method attempts to connect to the WiFi network and blinks an LED during the process.
        If the connection is successful, it retrieves and prints the IP and MAC address.
        """
        print("Connecting to network...")
        self.wlan.active(True)
        self.wlan.connect(self.ssid, self.password)
        retry_count = 0
        timer = self.pico.blink(self.blink_frequency, True)
        while not self.wlan.isconnected() and retry_count < self.max_attempts:
            time.sleep(3)
            retry_count += 1
        self.pico.stop_blinking(timer)
        config = self.wlan.ifconfig()
        self.ip = config[0]
        rawMac = self.wlan.config("mac")
        self.mac = "-".join("%02x" % b for b in rawMac).upper()
        print(f'Connected. IP: {self.ip}, MAC: {self.mac}')
        self.handshake_with_server()

    @inject_function_name
    def reconnect(self, func_name: str = "reconnect"):
        """
        Reconnects to the WiFi network.

        This method disconnects from the current network, performs a network cleanup, and attempts to reconnect.
        If the reconnection fails after the maximum number of attempts, the device is restarted.
        """
        print('Reconnecting to WiFi...')
        print("Disconnecting from current network...")
        self.wlan.disconnect()
        time.sleep(1)
        print("Performing network cleanup...")
        self.wlan.active(False)
        time.sleep(1)
        self.wlan.active(True)
        time.sleep(1)

        print("Attempting to reconnect...")
        self.wlan.connect(self.ssid, self.password)
    
        retry_count = 0
        timer = self.pico.blink(self.blink_frequency, True)
        while not self.wlan.isconnected() and retry_count < self.max_attempts:
            print(f"Reconnecting... Attempt {retry_count + 1}/{self.max_attempts}")
            time.sleep(3)
            retry_count += 1
        self.pico.stop_blinking(timer)
        if not self.wlan.isconnected():
            self.pico.log_issue("Error", self.__class__.__name__, func_name, f"Failed to reconnect after {self.max_attempts} attempts")
            print(f"Failed to reconnect after {self.max_attempts} attempts. Restarting the device...")
            machine.reset()
        ip = self.wlan.ifconfig()[0]
        print(f"Reconnected on {ip}")
        self.ip = ip
        print(f'Reconnected. New IP: {self.ip}')
        self.handshake_with_server()

    @inject_function_name
    def check_connection(self, func_name: str = "check_connection"):
        """
        Checks the current WiFi connection status.

        This method performs a keep-alive check by retrieving the network configuration.
        If the check fails or the WLAN is not connected, it attempts to reconnect.
        """
        if self.wlan.isconnected():
            try:
                print('Performing keep-alive check')
                self.wlan.ifconfig()
                print('Keep-alive check successful')
            except Exception as e:
                error_message = f"Keep-alive operation failed: {e}"
                self.pico.log_issue("Error", self.__class__.__name__, func_name, error_message)
                print(error_message)
                self.reconnect()
        else:
            self.pico.log_issue("Warning", self.__class__.__name__, func_name, "WLAN is not connected")
            print("WLAN is not connected")
            self.reconnect()
            
    @inject_function_name
    def handshake_with_server(self, func_name: str = "handshake_with_server"):
        """
        Attempts to complete a handshake with the server.

        This method attempts to establish a connection with the server by sending a handshake request.
        It retries the handshake up to a maximum number of attempts. If the handshake fails after
        the maximum attempts, the device is set to a fatal error state.
        """
        print("Handshaking with server...")
        attempt = 0
        success = False
        timer = self.pico.blink(10, True)
        while attempt < self.max_attempts:
            try:
                url = f"{self.server_address}/handshake"
                data = {
                    "alarmId": str(self.ID),
                    "macAddress": self.mac
                }
                json_data = ujson.dumps(data)
                response = urequests.post(url, headers={'Content-Type': 'application/json'}, data=json_data)
                if response.status_code == 200:
                    print("Handshake complete")
                    self.pico.log_issue("Info", self.__class__.__name__, func_name, f"successfully completed handshake with server {self.server_address}")
                    success = True
                    break
                else:
                    self.pico.log_issue("Error", self.__class__.__name__, func_name, f"Handshake failed, got the following status code: {response.status_code}")
                    print(f"Handshake failed, got the following status code: {response.status_code}")
            except Exception as e:
                print(f"Handshake error: {e}")
                self.pico.log_issue("Error", self.__class__.__name__, func_name, f"Handshake error: {e}, retrying...")
            attempt += 1
            print(f"Retrying handshake... Attempt {attempt}/{self.max_attempts}")
            time.sleep(1)  # Optional: Add a delay between retries
        if not success:
            self.pico.log_issue("Error", self.__class__.__name__, func_name, f"Failed to complete handshake after {self.max_attempts} attempts")
            self.pico.set_fatal_error()
        self.pico.stop_blinking(timer)
        
    def open_socket(self, server_ip: str, port: int = 80):
        """
        Opens a non-blocking socket and binds it to the specified IP address.

        This function creates a socket, binds it to the given IP address on port 80,
        sets it to listen for incoming connections, and configures it as non-blocking.

        Args:
            server_ip (str): The IP address to bind the socket to.
            port (int, optional): The port to bind the socket to. Defaults to 80.
        """
        address = (server_ip, port)
        connection = socket.socket()
        connection.bind(address)
        connection.listen()
        connection.setblocking(False)
        print(f"Listening on {server_ip}:{port}")
        self.connection = connection

    @inject_function_name
    def accept_client(self, func_name: str = "accept_client") -> tuple[socket.socket, tuple]:
        """
        Accepts a client connection from a non-blocking socket.

        This function attempts to accept a client connection from the given non-blocking socket.
        If no client is immediately available, it will retry until a connection is established.

        Returns:
            tuple[socket.socket, tuple]: A tuple containing:
                - socket.socket: The client socket object.
                - tuple: The address of the connected client.

        Raises:
            OSError: If an error occurs during the accept operation, except for EAGAIN (errno 11).
        """
        try:    
            client, addr = self.connection.accept()
            return client, addr
        except OSError as e:
            if e.errno == 11: 
                pass
                # EAGAIN error (Resource temporarily unavailable)
                # EAGAIN (Error Again) occurs when a non-blocking operation
                # cannot be completed immediately. In this case, it means
                # no client is ready to be accepted at the moment.
            else:
                self.pico.log_issue("Error", self.__class__.__name__, func_name, f"Error accepting client: {e}")
                print(f"Error accepting client: {e}")
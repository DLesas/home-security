import time
import wifi
import ipaddress
import binascii
from microController import MicroController, inject_function_name
import adafruit_ntp
import rtc
import json


class Networking:
    def __init__(
        self,
        pico: MicroController,
        ssid: str,
        password: str,
        server_ip: str,
        server_port: int,
        max_attempts: int = 50,
        blinks: int = 3,
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
            ID (int): The unique identifier for the device.
            user_agent (str): The user agent to use for the handshake.
            max_attempts (int, optional): Maximum number of connection attempts. Defaults to 50.
            blink_frequency (int, optional): Frequency of the LED blink during connection attempts. Defaults to 2.
        """
        self.pico = pico
        self.ssid = ssid
        self.password = password
        self.max_attempts = max_attempts
        self.wlan = None
        self.blinks = blinks
        self.server_ip = server_ip
        self.server_port = server_port
        self.handshake_endpoint = (
            "http://"
            + f"{server_ip}:{str(server_port)}/"
            + "api/"
            + f"v{str(self.pico.api_version)}/"
            + f"{self.pico.type}s/"
            + str(self.pico.ID)
            + "/handshake"
        )
        self.connection = None
        self.ip = None
        self.mac = None

    def connect(self):
        """
        Connects to the WiFi network using the provided SSID and password.

        This method attempts to connect to the WiFi network and blinks an LED during the process.
        If the connection is successful, it retrieves and prints the IP and MAC address.
        After a successful connection, it automatically performs a handshake with the server.
        """
        print("Connecting to network...")
        wifi.radio.enabled = True
        self.pico.blink(self.blinks)
        retry_count = 0
        while not wifi.radio.connected and retry_count < self.max_attempts:
            try:
                wifi.radio.connect(self.ssid, self.password)
            except Exception as e:
                self.pico.log_issue(
                    "Error",
                    self.__class__.__name__,
                    "connect",
                    f"Failed to connect to WiFi: {e}",
                )
                time.sleep(1)
            retry_count += 1
        if not wifi.radio.connected:
            self.pico.log_issue(
                "Error",
                self.__class__.__name__,
                func_name,
                f"Failed to connect to WiFi after {self.max_attempts} attempts",
            )
            self.pico.set_fatal_error()
        self.ip = wifi.radio.ipv4_address
        self.mac = binascii.hexlify(bytearray(wifi.radio.mac_address))
        print(f"Connected. IP: {self.ip}, MAC: {self.mac}")
        ntp = adafruit_ntp.NTP(pool, tz_offset=0, cache_seconds=3600)
        rtc.RTC().datetime = ntp.datetime
        self.handshake_with_server()

    def disconnect(self):
        """
        Disconnects from the WiFi network.
        """
        wifi.radio.enabled = False

    @inject_function_name
    def reconnect(self, func_name: str = "reconnect"):
        """
        Reconnects to the WiFi network.

        This method disconnects from the current network, performs a network cleanup, and attempts to reconnect.
        If the reconnection fails after the maximum number of attempts, the device is set to a fatal error state.
        After a successful reconnection, it automatically performs a handshake with the server.
        """
        self.connect()

    @inject_function_name
    def check_connection(self, func_name: str = "check_connection"):
        """
        Checks the current WiFi connection status.

        This method performs a keep-alive check by retrieving the network configuration.
        If the check fails or the WLAN is not connected, it attempts to reconnect.
        After a successful reconnection, it automatically performs a handshake with the server.
        """
        if wifi.radio.connected:
            try:
                ip1 = ipaddress.ip_address(self.server_ip)
                print("ping:", wifi.radio.ping(ip1))
                if wifi.radio.ping(ip1) == None or wifi.radio.ping(ip1) > 1000:
                    self.pico.log_issue(
                        "Warning",
                        self.__class__.__name__,
                        func_name,
                        "Failed to Ping to server, reconnecting...",
                    )
                    self.reconnect()
            except Exception as e:
                error_message = f"Keep-alive operation failed: {e}"
                self.pico.log_issue(
                    "Error", self.__class__.__name__, func_name, error_message
                )
                self.reconnect()
        else:
            self.pico.log_issue(
                "Warning", self.__class__.__name__, func_name, "WLAN is not connected"
            )
            print("WLAN is not connected")
            self.reconnect()

    @inject_function_name
    def handshake_with_server(self, func_name: str = "handshake_with_server"):
        """
        Attempts to complete a handshake with the server.

        This method attempts to establish a connection with the server by sending a handshake request.
        It retries the handshake up to the class's maximum number of attempts. If the handshake fails after
        the maximum attempts, the device is set to a fatal error state.
        """
        print("Handshaking with server...")
        attempt = 0
        success = False
        self.pico.blink(self.blinks)
        self.pico.turn_on_led()
        while attempt < self.max_attempts:
            try:
                data = {"macAddress": self.mac}
                data = json.dumps(data)
                headers = {
                    "User-Agent": self.pico.user_agent,
                    "Content-Type": "application/json",
                }
                # TODO: move this into a wifi class, as this should not be tied to a specific transmission protocol (e.g. HTTP, nrf24, etc.)
                response = self.pico.requests.post(
                    self.handshake_endpoint, headers=headers, data=data
                )
                if response.status_code == 200:
                    print("Handshake complete")
                    self.pico.log_issue(
                        "Info",
                        self.__class__.__name__,
                        func_name,
                        f"successfully completed handshake with server {self.server_ip}",
                    )
                    success = True
                    break
                else:
                    self.pico.log_issue(
                        "Error",
                        self.__class__.__name__,
                        func_name,
                        f"Handshake failed, got the following status code: {response.status_code} and response: {response.text}",
                    )
                    print(
                        f"Handshake failed, got the following status code: {response.status_code} and response: {response.text}"
                    )
            except Exception as e:
                print(f"Handshake error: {e}")
                self.pico.log_issue(
                    "Error",
                    self.__class__.__name__,
                    func_name,
                    f"Handshake error: {e}, retrying...",
                )
            attempt += 1
            print(f"Retrying handshake... Attempt {attempt}/{self.max_attempts}")
            time.sleep(1)  # Optional: Add a delay between retries
        if not success:
            self.pico.log_issue(
                "Error",
                self.__class__.__name__,
                func_name,
                f"Failed to complete handshake after {self.max_attempts} attempts",
            )
            self.pico.set_fatal_error()
        if "response" in locals():
            response.close()
        self.pico.turn_off_led()

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

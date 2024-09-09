import network # type: ignore
import uasyncio as asyncio # type: ignore
from picozero import pico_temp_sensor, pico_led # type: ignore
import machine # type: ignore
import time
import socket
from device_code.Microcontroller import MicroController

class Networking:
    def __init__(self, pico: MicroController, ssid: str, password: str, server_address: str, max_attempts: int = 50, blink_frequency: int = 5):
        self.pico = pico
        self.ssid = ssid
        self.password = password
        self.max_attempts = max_attempts
        self.wlan = network.WLAN(network.STA_IF)
        self.blink_frequency = blink_frequency
        self.server_address = server_address
        self.connection = None
        self.ip = None
        self.mac = None
        
    def connect(self):
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

    def reconnect(self):
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
            self.pico.log_issue("Error", f"Failed to reconnect after {self.max_attempts} attempts")
            print(f"Failed to reconnect after {self.max_attempts} attempts. Restarting the device...")
            machine.reset()
        ip = self.wlan.ifconfig()[0]
        print(f"Reconnected on {ip}")
        self.ip = ip
        print(f'Reconnected. New IP: {self.ip}')
        self.check_connection()

    def check_connection(self):
        if self.wlan.isconnected():
            try:
                print('Performing keep-alive check')
                self.wlan.ifconfig()
                print('Keep-alive check successful')
            except Exception as e:
                error_message = f"Keep-alive operation failed: {e}"
                self.pico.log_issue("Error", error_message)
                print(error_message)
                self.reconnect()
        else:
            self.pico.log_issue("Warning", "WLAN is not connected")
            print("WLAN is not connected")
            self.reconnect()
            
    def open_socket(self, server_ip: str, port: int = 80):
        """
        opens a non-blocking socket and binds it to the specified IP address.

        This function creates a socket, binds it to the given IP address on port 80,
        sets it to listen for incoming connections, and configures it as non-blocking.

        Args:
            server_ip (str): The IP address to bind the socket to.

        Note:
            This function requires the 'socket' module to be imported.
            The socket is set to listen on port 80 by default.
            The socket is configured as non-blocking to work with asynchronous operations.
        """
        address = (server_ip, port)
        connection = socket.socket()
        connection.bind(address)
        connection.listen()
        connection.setblocking(False)
        print(f"Listening on {server_ip}:{port}")
        self.connection = connection

    def accept_client(self) -> tuple[socket.socket, tuple]:
        """
        Accepts a client connection from a non-blocking socket.

        This function attempts to accept a client connection from the given non-blocking socket.
        If no client is immediately available, it will retry until a connection is established.

        Args:
            connection (socket.socket): The non-blocking socket listening for connections.

        Returns:
            tuple[socket.socket, tuple]: A tuple containing:
                - socket.socket: The client socket object.
                - tuple: The address of the connected client.

        Raises:
            OSError: If an error occurs during the accept operation, except for EAGAIN (errno 11).

        Note:
            This function is designed to work with non-blocking sockets. It handles the EAGAIN error
            (errno 11) by introducing a small delay and retrying. For any other errors, it will raise
            the exception.

        Example:
            client, addr = accept_client(server_socket)
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
                self.pico.log_issue("Error", f"Error accepting client: {e}")

    def send_logs(self):
        pass
    
    def send_update(self):
        pass
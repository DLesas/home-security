from logging import inject_function_name
import wifi
import adafruit_connection_manager
import adafruit_requests
import time
import binascii
import ipaddress

def require_connection(func):
    """
    Decorator to ensure WiFi is connected before executing the function.
    If not connected, it logs an error and sets a fatal error flag.
    Requires that the function being wrapped parent class has a Logger and Led instance.

    Args:
        func (function): The function to be decorated.

    Returns:
        function: The wrapped function that checks for WiFi connection.
    """
    def wrapper(self, *args, **kwargs):
        if not wifi.radio.connected:
            class_name = self.__class__.__name__
            func_name = func.__name__
            self.__class__.Logger.log_issue("Error", class_name, func_name, "WiFi is not connected")
            self.__class__.deviceWifi.reconnect()
        return func(self, *args, **kwargs)
    return wrapper

class deviceWifi:
    def __init__(self, Logger, Led, ssid, password, server_ip, server_port, max_attempts, blinks, ID):
        self.Logger = Logger
        self.Led = Led
        self.pool = adafruit_connection_manager.get_radio_socketpool(wifi.radio)
        self.ssl_context = adafruit_connection_manager.get_radio_ssl_context(wifi.radio)
        self.requests = adafruit_requests.Session(self.pool, self.ssl_context)
        self.ssid = ssid
        self.password = password
        self.max_attempts = int(max_attempts)
        self.blinks = int(blinks)
        self.wlan = None
        self.ip = None
        self.mac = None
        self.ID = ID
        
    @inject_function_name
    def connect(self, func_name: str = "connect"):
        """
        Connects to the WiFi network using the provided SSID and password.

        This method attempts to connect to the WiFi network and blinks an LED during the process.
        If the connection is successful, it retrieves and prints the IP and MAC address.
        After a successful connection, it automatically performs a handshake with the server.
        """
        print("Connecting to network...")
        wifi.radio.enabled = True
        self.Led.blink(self.blinks)
        retry_count = 0
        while not wifi.radio.connected and retry_count < self.max_attempts:
            try:
                wifi.radio.connect(self.ssid, self.password)
            except Exception as e:
                self.Logger.log_issue(
                    "Error",
                    self.__class__.__name__,
                    func_name,
                    f"Failed to connect to WiFi: {e}",
                )
                time.sleep(0.5)
            retry_count = retry_count + 1
        if not wifi.radio.connected:
            self.Logger.log_issue(
                "Error",
                self.__class__.__name__,
                func_name,
                f"Failed to connect to WiFi after {self.max_attempts} attempts",
            )
            self.Led.set_fatal_error()
        self.ip = wifi.radio.ipv4_address
        self.mac = binascii.hexlify(bytearray(wifi.radio.mac_address))
        print(f"Connected. IP: {self.ip}, MAC: {self.mac}")
        
    def disconnect(self):
        """
        Disconnects from the WiFi network.
        """
        wifi.radio.enabled = False
        
    def reconnect(self):
        """
        Reconnects to the WiFi network.

        This method disconnects from the current network, performs a network cleanup, and attempts to reconnect.
        If the reconnection fails after the maximum number of attempts, the device is set to a fatal error state.
        After a successful reconnection, it automatically performs a handshake with the server.
        """
        self.disconnect()
        self.connect()

    @require_connection
    @inject_function_name
    def check_connection(self, func_name: str = "check_connection"):
        """
        Checks the current WiFi connection status.

        This method performs a keep-alive check by pinging Google's public DNS server.
        If the check fails or the WiFi is not connected, it attempts to reconnect.
        """
        try:
            # Use Google's public DNS server (8.8.8.8) for the ping test
            google_dns = ipaddress.ip_address("8.8.8.8")
            ping = wifi.radio.ping(google_dns)
            print("ping:", ping)
            if ping is None or ping > 1000:
                self.Logger.log_issue(
                    "Warning",
                    self.__class__.__name__,
                    func_name,
                    "Failed to ping Google DNS, reconnecting...",
                )
                self.reconnect()
        except Exception as e:
            error_message = f"Failed to ping Google DNS: {e}"
            self.Logger.log_issue(
                "Error", self.__class__.__name__, func_name, error_message
            )
            self.reconnect()


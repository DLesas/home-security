from logging import inject_function_name
from logging import Logger
from led import Led
from microDevice import microDevice
from deviceWifi import deviceWifi, require_connection
from networking import Networking
from digitalio import DigitalInOut, Direction, Pull
import json
import board
import alarm
import time
import socketpool
import wifi

from adafruit_httpserver import (
    Server,
    REQUEST_HANDLED_RESPONSE_SENT,
    Request,
    JSONResponse
)

class alarmRelay:
    def __init__(
        self,
        Logger: Logger,
        Led: Led,
        Device: microDevice,
        deviceWifi: deviceWifi, 
        Networking: Networking,
        relay_pin: str,
        auto_turn_off_seconds: int = 0,
        port: int = 8000,
        debug: bool = True,
    ):
        self.Logger = Logger
        self.Led = Led
        self.Device = Device
        self.deviceWifi = deviceWifi
        self.Networking = Networking
        self.relay = getattr(board, relay_pin)
        self.pool = socketpool.SocketPool(wifi.radio)
        self.server = Server(self.pool, debug=debug)
        
        # Create a persistent DigitalInOut object for the relay
        self.switch = DigitalInOut(self.relay)
        self.switch.direction = Direction.OUTPUT
        
        self.state = "off"
        self.temperature = None
        self.voltage = None
        self.frequency = None
        self.auto_turn_off_seconds = auto_turn_off_seconds
        self.alarm_activated_time = None  # Track when alarm was turned on
        self.register_routes()
        self.port = int(port)
        self.headers = self.Networking.headers

    def change_relay_state(self, state: bool):
        self.switch.value = bool(state)
        self.state = "on" if state else "off"
        
        if state:
            self.Led.turn_on_led()
            # Record when alarm was turned on
            self.alarm_activated_time = time.monotonic()
            print(f"Alarm activated at {self.alarm_activated_time}, auto turn-off in {self.auto_turn_off_seconds}s")
        else:
            self.Led.turn_off_led()
            # Clear activation time when turned off
            self.alarm_activated_time = None
            print("Alarm deactivated, auto turn-off timer cleared")

    def read_all_stats(self):
        self.temperature = self.Device.read_temperature()
        self.voltage = self.Device.read_voltage()
        self.frequency = self.Device.read_frequency()
    
    @require_connection    
    def send_ping(self):
        self.read_all_stats()
        data = {"state": self.state, "temperature": self.temperature, "voltage": self.voltage, "frequency": self.frequency}
        data = json.dumps(data)
        url = f"{self.Networking.server_protocol}://{self.Networking.server_ip}:{self.Networking.server_port}/api/v{self.Networking.api_version}/{self.Networking.device_module}s/update"
        response = self.deviceWifi.requests.post(url, headers=self.headers, data=data)
        if response.status_code == 200:
            print(f"Successfully sent alarm state: {self.state}")
        else:
            self.Logger.log_issue("Error", self.__class__.__name__, "send_ping", f"Failed to send alarm state, status code: {response.status_code}, response: {response.text}")
        if "response" in locals():
            response.close()
    
    def check_auto_timeout(self):
        """
        Check if alarm should be automatically turned off based on timeout.
        Returns True if alarm was auto-turned off, False otherwise.
        """
        if (self.state == "on" and 
            self.auto_turn_off_seconds > 0 and 
            self.alarm_activated_time is not None):
            
            elapsed_time = time.monotonic() - self.alarm_activated_time
            
            if elapsed_time >= self.auto_turn_off_seconds:
                print(f"Auto turn-off triggered after {elapsed_time:.1f}s (timeout: {self.auto_turn_off_seconds}s)")
                self.change_relay_state(False)
                self.Logger.log_issue("Critical", self.__class__.__name__, "check_auto_timeout", 
                                    f"Alarm auto-turned off after {self.auto_turn_off_seconds}s timeout locally rather than via server")
                return True
        
        return False

    def register_routes(self):
        @self.server.route("/on", "POST")    
        def alarm_on(request: Request):
            """
            Turn the alarm on.
            """
            ip = request.client_address
            user_agent = request.headers.get("User-Agent", "Unknown")
            self.change_relay_state(True)
            self.read_all_stats()
            self.Logger.log_issue("Info", self.__class__.__name__, "alarm_on", f"Alarm turned on at {time.monotonic()} by {ip} with {user_agent}")
            data = {"state": self.state, "temperature": self.temperature, "voltage": self.voltage, "frequency": self.frequency}
            return JSONResponse(request, data)

        @self.server.route("/off", "POST")
        def alarm_off(request: Request):
            """
            Turn the alarm off.
            """
            ip = request.client_address
            user_agent = request.headers.get("User-Agent", "Unknown")
            self.change_relay_state(False)
            self.read_all_stats()
            self.Logger.log_issue("Info", self.__class__.__name__, "alarm_off", f"Alarm turned off at {time.monotonic()} by {ip} with {user_agent}")
            data = {"state": self.state, "temperature": self.temperature, "voltage": self.voltage, "frequency": self.frequency}
            return JSONResponse(request, data)
        
    def start_server(self):
        self.server.start(str(wifi.radio.ipv4_address), self.port)
        return self.server

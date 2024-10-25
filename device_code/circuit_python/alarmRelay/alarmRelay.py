from logging import inject_function_name
from logging import Logger
from led import Led
from microDevice import microDevice
from deviceWifi import deviceWifi
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
        self.server = Server(self.pool, debug=True)
        self.state = "off"
        self.temperature = None
        self.voltage = None
        self.frequency = None
        self.register_routes()
        self.port = int(port)
        self.server.headers = {
            "User-Agent": self.Networking.user_agent,
            "Content-Type": "application/json",
        }

    def change_relay_state(self, state: bool):
        switch = DigitalInOut(self.relay)
        switch.direction = Direction.OUTPUT
        switch.value = bool(state)
        self.state = "on" if state else "off"
        self.Led.turn_on_led() if state else self.pico.turn_off_led()
        switch.deinit()

    def read_all_stats(self):
        self.temperature = self.Device.read_temperature()
        self.voltage = self.Device.read_voltage()
        self.frequency = self.Device.read_frequency()
    
    @require_connection    
    def send_ping(self):
        self.read_all_stats()
        data = {"state": self.state, "temperature": self.temperature, "voltage": self.voltage, "frequency": self.frequency}
        data = json.dumps(data)
        url = f"{self.Networking.server_protocol}://{self.Networking.server_ip}:{self.Networking.server_port}/api/v{self.Networking.api_version}/{self.Networking.deviceType}s/update"
        headers = self.server.headers
        response = self.deviceWifi.requests.post(url, headers=headers, data=data)
        if response.status_code == 200:
            print(f"Successfully sent alarm state: {self.state}")
        else:
            self.Logger.log_issue("Error", self.__class__.__name__, "send_ping", f"Failed to send alarm state, status code: {response.status_code}, response: {response.text}")
        if "response" in locals():
            response.close()

    def register_routes(self):
        @self.server.route("/on", method="POST")    
        def alarm_on(request: Request):
            """
            Turn the alarm on.
            """
            ip = request.client_address
            userAgent =requests.header.sget("User-Agent")
            self.change_relay_state(True)
            self.read_all_stats()
            self.Logger.log_issue("Info", self.__class__.__name__, "alarm_on", f"Alarm turned on at {time.monotonic()} by {ip} with {userAgent}")
            data = {"state": self.state, "temperature": self.temperature, "voltage": self.voltage, "frequency": self.frequency}
            return JSONResponse(data)

        @self.server.route("/off", method="POST")
        def alarm_off(request: Request):
            """
            Turn the alarm off.
            """
            ip = request.client_address
            userAgent =requests.header.sget("User-Agent")
            self.change_relay_state(False)
            self.read_all_stats()
            self.Logger.log_issue("Info", self.__class__.__name__, "alarm_off", f"Alarm turned off at {time.monotonic()} by {ip} with {userAgent}")
            data = {"state": self.state, "temperature": self.temperature, "voltage": self.voltage, "frequency": self.frequency}
            return JSONResponse(data)
        
    def start_server(self):
        self.server.start(str(wifi.radio.ipv4_address), self.port)
        return self.server

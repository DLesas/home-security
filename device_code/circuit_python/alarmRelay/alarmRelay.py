from microController import MicroController
from microcontroller import cpu
from digitalio import DigitalInOut, Direction, Pull
from networking import Networking
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
        pico: MicroController,
        network: Networking,
        relay_pin: str,
        debug: bool = True,
    ):
        self.pico = pico
        self.network = network
        self.relay = getattr(board, relay_pin)
        self.state = "off"
        self.temperature = None
        self.voltage = None
        self.frequency = None
        self.pool = socketpool.SocketPool(wifi.radio)
        self.server = Server(socketpool.SocketPool(wifi.radio), debug=True)
        self.register_routes()
        self.server.headers = {
            "User-Agent": self.pico.user_agent,
            "Content-Type": "application/json",
        }

    def change_relay_state(self, state: bool):
        switch = DigitalInOut(self.relay)
        switch.direction = Direction.OUTPUT
        switch.value = bool(state)
        self.state = "on" if state else "off"
        self.pico.turn_on_led() if state else self.pico.turn_off_led()
        switch.deinit()

    def read_temperature(self):
        self.temperature = cpu.temperature
        
    def read_voltage(self):
        self.voltage = cpu.voltage
        
    def read_frequency(self):
        self.frequency = cpu.frequency
        
    def send_ping(self):
        self.read_frequency()
        self.read_voltage()
        self.read_temperature()
        data = {"state": self.state, "temperature": self.temperature, "voltage": self.voltage, "frequency": self.frequency}
        data = json.dumps(data)
        url = f"http://{self.network.server_ip}:{self.network.server_port}/api/v{self.pico.api_version}/alarms/update"
        headers = {
            "User-Agent": self.pico.user_agent,
            "Content-Type": "application/json",
        }
        response = self.pico.requests.post(url, headers=headers, data=data)
        if response.status_code == 200:
            print(f"Successfully sent alarm state: {self.state}")
        else:
            self.pico.log_issue("Error", "alarmRelay", "send_ping", f"Failed to send alarm state, status code: {response.status_code}, response: {response.text}")
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
            self.read_temperature()
            self.read_voltage()
            self.read_frequency()
            self.pico.log_issue("Info", "alarmRelay", "alarm_on", f"Alarm turned on at {time.monotonic()} by {ip} with {userAgent}")
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
            self.read_temperature()
            self.read_voltage()
            self.read_frequency()
            self.pico.log_issue("Info", "alarmRelay", "alarm_off", f"Alarm turned off at {time.monotonic()} by {ip} with {userAgent}")
            data = {"state": self.state, "temperature": self.temperature, "voltage": self.voltage, "frequency": self.frequency}
            return JSONResponse(data)
        
    def start_server(self):
        self.server.start(str(wifi.radio.ipv4_address))
        return self.server

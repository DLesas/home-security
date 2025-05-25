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


class DoorSensor:
    def __init__(
        self,
        Logger: Logger,
        Led: Led,
        Device: microDevice,
        deviceWifi: deviceWifi, 
        Networking: Networking,
        door_switch_pin: str,
        max_time_to_sleep_s: int = 1800,
    ):
        self.Logger = Logger
        self.Led = Led
        self.Device = Device
        self.deviceWifi = deviceWifi
        self.Networking = Networking
        self.switch = getattr(board, door_switch_pin)
        self.max_time_to_sleep_s = int(max_time_to_sleep_s)
        self.state = None
        self.temperature = None
        self.voltage = None
        self.frequency = None

    def read_switch(self):
        switch = DigitalInOut(self.switch)
        switch.direction = Direction.INPUT
        switch.pull = Pull.UP
        self.state = "open" if switch.value else "closed"
        switch.deinit()
        
    def read_all_stats(self):
        self.temperature = self.Device.read_temperature()
        self.voltage = self.Device.read_voltage()
        self.frequency = self.Device.read_frequency()
        self.read_switch()


    def deep_sleep(self):
        print(
            f"Entering deep sleep mode for {self.max_time_to_sleep_s}s or until pin {self.switch} changes"
        )
        pin_alarm_rising = alarm.pin.PinAlarm(pin=self.switch, value=True, edge=True)
        pin_alarm_falling = alarm.pin.PinAlarm(pin=self.switch, value=False, edge=True, pull=True)
        timeout_alarm = alarm.time.TimeAlarm(
            monotonic_time=time.monotonic() + self.max_time_to_sleep_s
        )
        alarm.exit_and_deep_sleep_until_alarms(
            pin_alarm_rising, pin_alarm_falling, timeout_alarm
        )
        
    def light_sleep(self):
        print(
            f"Entering light sleep mode for {self.max_time_to_sleep_s}s or until pin {self.switch} changes"
        )
        pin_alarm_rising = alarm.pin.PinAlarm(pin=self.switch, value=True, edge=True)
        pin_alarm_falling = alarm.pin.PinAlarm(pin=self.switch, value=False, edge=True, pull=True)
        timeout_alarm = alarm.time.TimeAlarm(
            monotonic_time=time.monotonic() + self.max_time_to_sleep_s
        )
        alarm.light_sleep_until_alarms(
            pin_alarm_rising, pin_alarm_falling, timeout_alarm
        )

    def send_data(self):
        if self.state is None or self.temperature is None:
            return
        self.Led.blink(3, delay=0.05)
        self.Led.turn_on_led()
        original_state = self.state
        data = {"status": self.state, "temperature": self.temperature, "voltage": self.voltage, "frequency": self.frequency}
        data = json.dumps(data)
        url = f"{self.Networking.server_protocol}://{self.Networking.server_ip}:{self.Networking.server_port}/api/v{self.Networking.api_version}/{self.Networking.deviceType}s/update"
        headers = {
            "User-Agent": self.Networking.user_agent,
            "Content-Type": "application/json",
        }
        response = self.deviceWifi.requests.post(url, headers=headers, data=data)
        if response.status_code == 200:
            print(f"Successfully sent door state: {self.state}")
        else:
            print(
                f"Failed to send door state, status code: {response.status_code}, response: {response.text}"
            )
            # TODO: if failure to send data, should broadcast via udp to get server ip address again
        if "response" in locals():
            response.close()
        self.Led.turn_off_led()
        self.read_switch()
        if self.state != original_state:
            self.Logger.log_issue("info", self.__class__.__name__, "send_data", f"Door state changed from {original_state} to {self.state} whilst sending data, resending.....")
            self.send_data()

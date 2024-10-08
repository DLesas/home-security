from microController import MicroController
from microcontroller import cpu
from digitalio import DigitalInOut, Direction, Pull
from networking import Networking
import json
import board
import alarm
import time


class DoorSensor:
    def __init__(
        self,
        pico: MicroController,
        network: Networking,
        door_switch_pin: str,
        max_time_to_sleep_s: int = 1800,
    ):
        self.pico = pico
        self.network = network
        self.switch = getattr(board, door_switch_pin)
        self.state = None
        self.temperature = None
        self.voltage = None
        self.frequency = None
        self.max_time_to_sleep_s = int(max_time_to_sleep_s)

    def read_switch(self):
        switch = DigitalInOut(self.switch)
        switch.direction = Direction.INPUT
        switch.pull = Pull.UP
        self.state = "open" if switch.value else "closed"
        switch.deinit()

    def read_temperature(self):
        self.temperature = cpu.temperature
        
    def read_voltage(self):
        self.voltage = cpu.voltage
        
    def read_frequency(self):
        self.frequency = cpu.frequency

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
        self.pico.blink(3, delay=0.05)
        self.pico.turn_on_led()
        data = {"status": self.state, "temperature": self.temperature, "voltage": self.voltage, "frequency": self.frequency}
        data = json.dumps(data)
        # TODO: move this into a wifi class, as this should not be tied to a specific transmission protocol (e.g. HTTP, nrf24, etc.)
        url = f"http://{self.network.server_ip}:{self.network.server_port}/api/v1/sensors/update"
        headers = {
            "User-Agent": self.pico.user_agent,
            "Content-Type": "application/json",
        }
        response = self.pico.requests.post(url, headers=headers, data=data)
        if response.status_code == 200:
            print(f"Successfully sent door state: {self.state}")
        else:
            print(
                f"Failed to send door state, status code: {response.status_code}, response: {response.text}"
            )
        if "response" in locals():
            response.close()
        self.pico.turn_off_led()

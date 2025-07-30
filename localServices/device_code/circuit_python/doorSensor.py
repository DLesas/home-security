from logging import Logger
from led import Led
from persistentState import PersistentState
from microDevice import microDevice
from deviceWifi import deviceWifi
from networking import Networking
from digitalio import DigitalInOut, Direction, Pull
import json
import board
import alarm
import time
from localAlarm import LocalAlarm


class DoorSensor:
    def __init__(
        self,
        Logger: Logger,
        Led: Led,
        Device: microDevice,
        deviceWifi: deviceWifi, 
        Networking: Networking,
        LocalAlarm: LocalAlarm,
        PersistentState: PersistentState,
        door_switch_pin: str,
        max_time_to_sleep_s: int = 120,
    ):
        self.Logger = Logger
        self.Led = Led
        self.Device = Device
        self.deviceWifi = deviceWifi
        self.Networking = Networking
        self.LocalAlarm = LocalAlarm
        self.PersistentState = PersistentState
        self.switch_pin = getattr(board, door_switch_pin)
        self.max_time_to_sleep_s = int(max_time_to_sleep_s)
        self.state = None
        self.temperature = None
        self.voltage = None
        self.frequency = None

        # Create a persistent DigitalInOut object for the switch
        self.switch = DigitalInOut(self.switch_pin)
        self.switch.direction = Direction.INPUT
        self.switch.pull = Pull.UP

    def read_switch(self):
        new_state = "open" if self.switch.value else "closed"

        # If the door is now closed and the local alarm was sounding, stop it.
        if new_state == "closed" and self.LocalAlarm.is_sounding:
            self.LocalAlarm.stop()
        
        self.state = new_state
        
    def read_all_stats(self):
        self.temperature = self.Device.read_temperature()
        self.voltage = self.Device.read_voltage()
        self.frequency = self.Device.read_frequency()
        self.read_switch()


    def deep_sleep(self):
        print(f"Entering deep sleep mode...")
        
        # Base alarms for pin changes and max sleep time
        pin_alarm_rising = alarm.pin.PinAlarm(pin=self.switch_pin, value=True, edge=True)
        pin_alarm_falling = alarm.pin.PinAlarm(pin=self.switch_pin, value=False, edge=True, pull=True)
        timeout_alarm = alarm.time.TimeAlarm(monotonic_time=time.monotonic() + self.max_time_to_sleep_s)
        
        alarms_to_wait_for = [pin_alarm_rising, pin_alarm_falling, timeout_alarm]
        
        # Add the local alarm timeout if it's currently active
        local_alarm_timeout = self.LocalAlarm.get_timeout_alarm()
        if local_alarm_timeout:
            alarms_to_wait_for.append(local_alarm_timeout)

        alarm.exit_and_deep_sleep_until_alarms(*alarms_to_wait_for)
        
    def light_sleep(self):
        print(f"Entering light sleep mode...")

        # Base alarms for pin changes and max sleep time
        pin_alarm_rising = alarm.pin.PinAlarm(pin=self.switch_pin, value=True, edge=True)
        pin_alarm_falling = alarm.pin.PinAlarm(pin=self.switch_pin, value=False, edge=True, pull=True)
        timeout_alarm = alarm.time.TimeAlarm(monotonic_time=time.monotonic() + self.max_time_to_sleep_s)

        alarms_to_wait_for = [pin_alarm_rising, pin_alarm_falling, timeout_alarm]

        # Add the local alarm timeout if it's currently active
        local_alarm_timeout = self.LocalAlarm.get_timeout_alarm()
        if local_alarm_timeout:
            alarms_to_wait_for.append(local_alarm_timeout)

        alarm.light_sleep_until_alarms(*alarms_to_wait_for)

    def smart_sleep(self):
        """
        Choose sleep mode based on armed status and check armed status periodically.
        Light sleep when armed (fast response), deep sleep when disarmed (power saving).
        """
        armed = self.PersistentState.get_state("armed")
        
        if armed:
            print("System ARMED - using light sleep for fast response")
            self.light_sleep()
        else:
            print("System DISARMED - using deep sleep for power saving")
            self.deep_sleep()

    def send_data(self):
        if self.state is None or self.temperature is None:
            return

        def check_if_local_alarm_should_be_triggered():
            if self.state == "open" and self.PersistentState.get_state("armed"):
                self.LocalAlarm.start()
            elif self.LocalAlarm.is_sounding:
                self.LocalAlarm.stop()
            
        self.Led.blink(3, delay=0.05)
        self.Led.turn_on_led()
        original_state = self.state
        data = {"status": self.state, "temperature": self.temperature, "voltage": self.voltage, "frequency": self.frequency}
        data = json.dumps(data)
        url = f"{self.Networking.server_protocol}://{self.Networking.server_ip}:{self.Networking.server_port}/api/v{self.Networking.api_version}/{self.Networking.device_module}s/update"
        
        try:
            response = self.deviceWifi.requests.post(url, headers=self.Networking.headers, data=data)
            if response.status_code == 200:
                print(f"Successfully sent door state: {self.state}")
                try:
                    response_data = json.loads(response.text)
                    if "armed" in response_data:
                        armed_status = bool(response_data["armed"])
                        self.PersistentState.add_persistent_state("armed", armed_status)
                        check_if_local_alarm_should_be_triggered()
                    else:
                        self.Logger.log_issue("info", self.__class__.__name__, "send_data", "No armed status in the response we got back from the server!")
                        check_if_local_alarm_should_be_triggered()
                            
                except (ValueError, KeyError) as e:
                    self.Logger.log_issue("info", self.__class__.__name__, "send_data", f"Error parsing response JSON: {e}")
                    check_if_local_alarm_should_be_triggered()
            else:
                self.Logger.log_issue("info", self.__class__.__name__, "send_data", f"Failed to send door state {data}, status code: {response.status_code}, response: {response.text}")
                check_if_local_alarm_should_be_triggered()
            if "response" in locals():
                response.close()
        except Exception as e:
            self.Logger.log_issue("Error", self.__class__.__name__, "send_data", f"Failed to send data to server: {e}")
            check_if_local_alarm_should_be_triggered()
        finally:
            self.Led.turn_off_led()
        self.read_switch()
        if self.state != original_state:
            self.Logger.log_issue("info", self.__class__.__name__, "send_data", f"Door state changed from {original_state} to {self.state} whilst sending data, resending.....")
            self.send_data()
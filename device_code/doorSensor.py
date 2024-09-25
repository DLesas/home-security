from microController import MicroController
from utils import read_env_file
from networking import Networking
import ujson # type: ignore
import urequests # type: ignore
import machine # type: ignore
  
    
class DoorSensor:
    def __init__(self, pico: MicroController, network: Networking, door_swith_pin: int, max_time_to_sleep_ms: int = 300000):
        self.pico = pico
        self.network = network
        self.switch = machine.Pin(door_swith_pin, machine.Pin.IN, machine.Pin.PULL_UP)
        self.state = None
        self.temperature = None
        self.max_time_to_sleep_ms = max_time_to_sleep_ms
        
    def read_switch(self):
        if self.switch.value() == 0:
            self.state = "open"
        else:
            self.state = "closed"
            
    def read_temperature(self):
        adcpin = 4
        sensor = machine.ADC(adcpin)
        adc_value = sensor.read_u16()
        volt = (3.3/65535) * adc_value
        temperature = 27 - (volt - 0.706)/0.001721
        self.temperature = round(temperature, 1)
        
    def setup_wake_up(self):
        self.switch.irq(trigger=machine.Pin.IRQ_FALLING | machine.Pin.IRQ_RISING, wake=machine.LIGHTSLEEP)
    
    def enter_light_sleep(self):
        print("Entering deep sleep mode for 5 minutes or until pin change...")
        machine.lightsleep(self.max_time_to_sleep_ms)

    
    def send_data(self):
        if self.state is None or self.temperature is None:
            return
        data = {"status": self.state, "temperature": self.temperature}
        json_data = ujson.dumps(data)
        #TODO: move this into a wifi class, as this should not be tied to a specific transmission protocol (e.g. HTTP, nrf24, etc.)
        url = f"{self.network.server_address}/api/v1/sensors/{self.network.ID}/update"
        response = urequests.post(url, headers={'Content-Type': 'application/json'}, data=json_data)
        if response.status_code == 200:
            response.close()
            print(f"Successfully sent door state: {self.state}")
        else:
            response.close()
            print(f"Failed to send door state, status code: {response.status_code}")
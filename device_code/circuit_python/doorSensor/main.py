from doorSensor import DoorSensor
from microController import MicroController
from networking import Networking
from utils import read_env_file
import time

# from lowPower import dormant_until_pin_or_timeout




def main_light_sleep():
    env = read_env_file()
    pico = MicroController(env["log_endpoint"], env["user_agent"], env["server_ip"], env["server_port"], env["id"], env["type"], env["api_version"])
    network = Networking(
        pico, env["ssid"], env["password"], env["server_ip"], env["server_port"], env["server_service_name"]
    )
    network.connect()
    door_sensor = DoorSensor(
        pico, network, env["door_switch_pin"], env["time_to_sleep_s"]
    )
    while True:
        door_sensor.read_switch()
        door_sensor.read_voltage()
        door_sensor.read_frequency()
        door_sensor.read_temperature()
        door_sensor.send_data()
        door_sensor.pico.check_all_files(ip=network.server_ip, port=network.server_port)
        door_sensor.light_sleep()


def main_deep_sleep():
    env = read_env_file()
    pico = MicroController(env["log_endpoint"], env["user_agent"], env["server_ip"], env["server_port"], env["id"], env["type"], env["api_version"])
    network = Networking(
        pico, env["ssid"], env["password"], env["server_ip"], env["server_port"], env["server_service_name"]
    )
    door_sensor = DoorSensor(
        pico, network, env["door_switch_pin"], env["time_to_sleep_s"]
    )
    door_sensor.read_switch()
    door_sensor.read_temperature()
    door_sensor.read_voltage()
    door_sensor.read_frequency()
    network.connect()
    door_sensor.send_data()
    door_sensor.pico.check_all_files(ip=network.server_ip, port=network.server_port)
    network.disconnect()
    door_sensor.deep_sleep()


if __name__ == "__main__":
    main_light_sleep()
# Write your code here :-)

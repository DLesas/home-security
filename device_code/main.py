from device_code.doorSensor import DoorSensor
from device_code.microController import MicroController
from device_code.networking import Networking
from device_code.utils import read_env_file


def main():
    env = read_env_file()
    pico = MicroController(env.log_endpoint)
    network = Networking(pico, env.ssid, env.password, env.server_address, env.ID, env.handshake_endpoint)
    network.connect()
    door_sensor = DoorSensor(pico, network, env.door_swith_pin, env.time_to_sleep_ms)
    door_sensor.setup_wake_up()
    while True:
        door_sensor.read_switch()
        door_sensor.read_temperature()
        door_sensor.network.check_connection()
        door_sensor.send_data()
        door_sensor.pico.check_all_files()
        door_sensor.enter_light_sleep()
        
if __name__ == "__main__":
    main()

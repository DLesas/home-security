from doorSensor import DoorSensor
from microDevice import microDevice
from led import Led
from logging import Logger
from timeClock import TimeClock
from udp import Udp
from networking import Networking
from deviceWifi import deviceWifi
from utils import read_env_file
import time

# from lowPower import dormant_until_pin_or_timeout



def main_light_sleep():
    env = read_env_file()
    Device = microDevice()
    led = Led()
    logger = Logger(Device)
    DeviceWifi = deviceWifi(logger, led, env["ssid"], env["password"], env["server_ip"], env["server_port"], env["max_wifi_attempts"], env["wifi_blinks"], env["id"])
    DeviceWifi.connect()
    timeclock = TimeClock(logger, led, DeviceWifi)
    timeclock.set_time_ntp()
    udp = Udp(DeviceWifi, logger, led, env["server_udp_port"], env["server_service_name"], env["server_password"], env["tcp_timeout"], env["tcp_port"])
    networking = Networking(DeviceWifi, Device, logger, led, udp, env["max_networking_attempts"], env["networking_blinks"], env["server_ip"], env["server_port"], env["server_ssl"], env["api_version"], env["deviceType"], env["user_agent"], env["id"])
    networking.find_server()
    networking.handshake_with_server()
    doorSensor = DoorSensor(logger, led, Device, DeviceWifi, networking, env["door_switch_pin"], env["time_to_sleep_s"])
    while True:
        DeviceWifi.check_connection()
        doorSensor.read_all_stats()
        doorSensor.send_data()
        needsClearing = logger.check_log_files()
        if needsClearing:
            networking.send_logs()
        doorSensor.light_sleep()
    
    

def main_deep_sleep():
    env = read_env_file()
    Device = microDevice()
    led = Led()
    logger = Logger(Device)
    DeviceWifi = deviceWifi(logger, led, env["ssid"], env["password"], env["server_ip"], env["server_port"], env["max_wifi_attempts"], env["wifi_blinks"], env["id"])
    DeviceWifi.connect()
    timeclock = TimeClock(logger, led, DeviceWifi)
    timeclock.set_time_ntp()
    udp = Udp(DeviceWifi, logger, led, env["server_udp_port"], env["server_service_name"], env["server_password"], env["tcp_timeout"], env["tcp_port"])
    networking = Networking(DeviceWifi, Device, logger, led, udp, env["max_networking_attempts"], env["networking_blinks"], env["server_ip"], env["server_port"], env["server_ssl"], env["api_version"], env["deviceType"], env["user_agent"])
    networking.find_server()
    networking.handshake_with_server()
    doorSensor = DoorSensor(logger, led, Device, DeviceWifi, networking, env["door_switch_pin"], env["time_to_sleep_s"])
    DeviceWifi.check_connection()
    doorSensor.read_all_stats()
    doorSensor.send_data()
    needsClearing = logger.check_log_files()
    if needsClearing:
        networking.send_logs()
    doorSensor.deep_sleep()


if __name__ == "__main__":
    main_light_sleep()
# Write your code here :-)

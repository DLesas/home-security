from doorSensor import DoorSensor
from device import Device
from led import Led
from logger import Logger
from timeClock import TimeClock
from udp import Udp
from networking import Networking
from wifi import Wifi
from utils import read_env_file
import time

# from lowPower import dormant_until_pin_or_timeout



def main_light_sleep():
    env = read_env_file()
    Device = Device()
    Led = Led()
    Logger = Logger(Device)
    Wifi = Wifi(Logger, Led, env["ssid"], env["password"], env["server_ip"], env["server_port"], env["max_wifi_attempts"], env["wifi_blinks"], env["id"])
    Wifi.connect()
    RTC = TimeClock(Wifi, Logger, Led)
    RTC.set_time_ntp()
    Udp = Udp(Wifi, Logger, Led, env["server_udp_port"], env["server_service_name"], env["server_password"], env["tcp_timeout"], env["tcp_port"])
    Networking = Networking(Wifi, Logger, Led, Udp, env["max_networking_attempts"], env["networking_blinks"], env["server_ip"], env["server_port"], env["server_ssl"], env["api_version"], env["deviceType"], env["user_agent"])
    Networking.find_server()
    Networking.handshake_with_server()
    DoorSensor = DoorSensor(Logger, Led, Device, Wifi, Networking, env["door_switch_pin"], env["time_to_sleep_s"])
    while True:
        Wifi.check_connection()
        DoorSensor.read_all_stats()
        DoorSensor.send_data()
        needsClearing = Logger.check_log_files()
        if needsClearing:
            Networking.send_logs()
        DoorSensor.light_sleep()
    
    

def main_deep_sleep():
    env = read_env_file()
    Device = Device()
    Led = Led()
    Logger = Logger(Device)
    Wifi = Wifi(Logger, Led, env["ssid"], env["password"], env["server_ip"], env["server_port"], env["max_wifi_attempts"], env["wifi_blinks"], env["id"])
    Wifi.connect()
    RTC = TimeClock(Wifi, Logger, Led)
    RTC.set_time_ntp()
    Udp = Udp(Wifi, Logger, Led, env["server_udp_port"], env["server_service_name"], env["server_password"], env["tcp_timeout"], env["tcp_port"])
    Networking = Networking(Wifi, Logger, Led, Udp, env["max_networking_attempts"], env["networking_blinks"], env["server_ip"], env["server_port"], env["server_ssl"], env["api_version"], env["deviceType"], env["user_agent"])
    Networking.find_server()
    Networking.handshake_with_server()
    DoorSensor = DoorSensor(Logger, Led, Device, Wifi, Networking, env["door_switch_pin"], env["time_to_sleep_s"])
    Wifi.check_connection()
    DoorSensor.read_all_stats()
    DoorSensor.send_data()
    needsClearing = Logger.check_log_files()
    if needsClearing:
        Networking.send_logs()
    DoorSensor.deep_sleep()


if __name__ == "__main__":
    main_light_sleep()
# Write your code here :-)

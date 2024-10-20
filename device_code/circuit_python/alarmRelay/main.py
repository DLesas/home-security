from alarmRelay import alarmRelay
from device import Device
from led import Led
from logger import Logger
from timeClock import TimeClock
from udp import Udp
from networking import Networking
from wifi import Wifi
from utils import read_env_file
from adafruit_httpserver import (
    REQUEST_HANDLED_RESPONSE_SENT,
)
import time

# from lowPower import dormant_until_pin_or_timeout


def main():
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
    alarm_relay = alarmRelay(Logger, Led, Device, Wifi, Networking, env["relay_pin"], env["port"])
    server = alarm_relay.start_server()
    start = time.time()
    ping_interval_s = int(env["ping_interval_s"])
    while True:
        try:
            if time.time() - start > ping_interval_s:
                alarm_relay.send_ping()
                start = time.time()
            pool_result = server.poll()
            if pool_result == REQUEST_HANDLED_RESPONSE_SENT:
                Device.collect_garbage()
            needsClearing = Logger.check_log_files()
            if needsClearing:
                Networking.send_logs()
        except Exception as e:
            Logger.log_issue("Error", "alarmRelayMain", "main", str(e))
            continue


if __name__ == "__main__":
    main()
# Write your code here :-)

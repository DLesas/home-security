from alarmRelay import alarmRelay
from microDevice import microDevice
from led import Led
from logging import Logger
from timeClock import TimeClock
from udp import Udp
from networking import Networking
from deviceWifi import deviceWifi
from utils import read_env_file
from adafruit_httpserver import (
    REQUEST_HANDLED_RESPONSE_SENT,
)
import time

# from lowPower import dormant_until_pin_or_timeout


def main():
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
    alarm_relay = alarmRelay(logger, led, Device, DeviceWifi, networking, env["relay_pin"], env["port"])
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
            needsClearing = logger.check_log_files()
            if needsClearing:
                networking.send_logs()
        except Exception as e:
            logger.log_issue("Error", "alarmRelayMain", "main", str(e))
            continue


if __name__ == "__main__":
    main()
# Write your code here :-)

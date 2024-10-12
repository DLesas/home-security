from microController import MicroController
from alarmRelay import alarmRelay
from networking import Networking
from utils import read_env_file
from adafruit_httpserver import (
    REQUEST_HANDLED_RESPONSE_SENT,
)
import time

# from lowPower import dormant_until_pin_or_timeout


def main():
    env = read_env_file()
    pico = MicroController(env["log_endpoint"], env["user_agent"], env["server_ip"], env["server_port"], env["id"], env["type"], env["api_version"])
    network = Networking(
        pico, env["ssid"], env["password"], env["server_ip"], env["server_port"], env["server_service_name"]
    )
    network.connect()
    alarm_relay = alarmRelay(pico, network, env["relay_pin"])
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
                pico.collect_garbage()
            pico.check_all_files(ip=network.server_ip, port=network.server_port)
        except Exception as e:
            pico.log_issue("Error", "alarmRelayMain", "main", str(e))
            continue


if __name__ == "__main__":
    main()
# Write your code here :-)

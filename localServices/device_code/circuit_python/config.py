
def read_env_file(file_path='config.env'):
    env_vars = {}
    try:
        with open(file_path, 'r') as file:
            for line in file:
                line = line.strip()
                if line and not line.startswith('#'):
                    key, value = line.split('=', 1)
                    env_vars[key.strip()] = value.strip()
    except OSError as e:
        print(f"Error reading env file: {e}")
    return env_vars

class Config:
    """
    A centralized class to manage device configuration from a file.
    Handles reading, parsing, and type-casting of all config variables.
    """
    def __init__(self, path='config.env'):
        env = read_env_file(path)

        # WiFi Settings
        self.ssid = env.get("ssid")
        self.password = env.get("password")
        self.max_wifi_attempts = int(env.get("max_wifi_attempts", 50))
        self.wifi_blinks = int(env.get("wifi_blinks", 5))

        # Server Settings
        self.server_ip = env.get("server_ip", "192.168.0.116")
        self.server_port = int(env.get("server_port", 80))
        self.server_ssl = bool(int(env.get("server_ssl", 0)))
        self.api_version = int(env.get("api_version", 1))

        # Networking & Discovery
        self.max_networking_attempts = int(env.get("max_networking_attempts", 50))
        self.networking_blinks = int(env.get("networking_blinks", 2))
        self.fatal_error_reboot_delay_s = int(env.get("fatal_error_reboot_delay_s", 300))
        self.server_udp_port = int(env.get("server_udp_port", 41234))
        self.server_service_name = env.get("server_service_name")
        self.server_password = env.get("server_password")
        self.tcp_timeout = int(env.get("tcp_timeout", 5))
        self.client_tcp_port = int(env.get("client_tcp_port", 31337))

        # Device Identity
        self.device_module = env.get("DEVICE_MODULE")
        self.id = env.get("id")
        self.user_agent = env.get("user_agent")
        
        # Door Sensor Specific
        self.door_switch_pin = env.get("door_switch_pin")
        self.buzzer_pin = env.get("buzzer_pin")
        self.time_to_sleep_s = int(env.get("time_to_sleep_s", 300))
        self.local_alarm_timeout_s = int(env.get("local_alarm_timeout_s", 60))
        self.should_deep_sleep = bool(int(env.get("should_deep_sleep", 0)))

        # Alarm Relay Specific
        self.relay_pin = env.get("relay_pin")
        self.ping_interval_s = int(env.get("ping_interval_s", 1800))
        self.server_listen_port = int(env.get("port", 8000))

        if not self.ssid or not self.password or not self.id or not self.device_module:
            raise ValueError("SSID, PASSWORD, ID, and DEVICE_MODULE must be set in the config file.")
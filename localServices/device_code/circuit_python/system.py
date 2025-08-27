from persistentState import PersistentState
from microDevice import microDevice
from led import Led
from logging import Logger
from timeClock import TimeClock
from udp import Udp
from networking import Networking
from deviceWifi import deviceWifi
from config import Config
import time
class DeviceManager:
    """
    Handles the common bootstrapping process for all devices.
    Initializes and wires up all the core services needed for operation.
    """
    def __init__(self, config_path='config.env'):
        """
        Args:
            config_path (str): The path to the configuration file for the device.
        """
        print("--- Starting Device Initialization ---")
        
        # Core components that have no dependencies
        self.config = Config(config_path)
        self.device = microDevice()
        self.led = Led()
        # Use NVM for persistent state instead of JSON files
        self.persistent_state = PersistentState(device=self.device, use_nvm=True)
        self.logger = Logger(self.device, self.led)

        # Initialize persistent states
        self._init_persistent_states()

        # Add 60 seconds to the auto turn off seconds to wait for the server to update the alarm state itself 
        self.auto_turn_off_seconds = self.config.auto_turn_off_seconds + 60

        # Networking components that depend on the core components
        self.device_wifi = deviceWifi(
            self.logger, self.led, self.config.ssid, self.config.password, 
            self.config.server_ip, self.config.server_port, 
            self.config.max_wifi_attempts, self.config.wifi_blinks, self.config.id
        )
        self.time_clock = TimeClock(self.logger, self.led, self.device_wifi)
        
        # Server discovery and networking layer
        self.udp = Udp(
            self.device_wifi, self.logger, self.led, self.config.server_udp_port,
            self.config.server_service_name, self.config.server_password,
            self.config.tcp_timeout, self.config.client_tcp_port
        )
        self.networking = Networking(
            self.device_wifi, self.device, self.logger, self.led, self.udp,
            self.config.max_networking_attempts, self.config.networking_blinks,
            self.config.server_ip, self.config.server_port, self.config.server_ssl,
            self.config.api_version, self.config.device_module, self.config.user_agent,
            self.config.id
        )

        print("--- Core Services Initialized ---")

    def bootstrap(self):
        """
        Connects to the network, syncs time, and handshakes with the server.
        """
        print("--- Bootstrapping Network ---")

        self.device_wifi.connect()
        self.networking.update_mac_address()  # Update MAC address after WiFi connection
        self.time_clock.set_time_ntp()
        self.networking.find_server()
        self.networking.handshake_with_server()
        print("--- Bootstrap Complete ---")
        self.led.blink(10, delay=0.5)

    def _init_persistent_states(self):
        """Initialize persistent states for the device."""
        try:

            # Initialize last boot time (current time)
            
            self.persistent_state.add_persistent_state("last_boot_time", time.time())

            print("Persistent states initialized")
            
            # Print NVM usage if using NVM
            if self.persistent_state.use_nvm:
                usage = self.persistent_state.get_nvm_usage()
                if usage:
                    print(f"NVM status: {usage['items']} items, {usage['percent']:.1f}% used")

        except Exception as e:
            print(f"Error initializing persistent states: {e}")
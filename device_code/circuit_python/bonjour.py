from devicewifi import require_connection
import mdns
import wifi

class Bonjour:
    """
    A class for discovering servers using the Bonjour protocol.

    This class provides functionality to find a specific server on the network
    using mDNS (multicast DNS) service discovery.
    """

    def __init__(self, deviceWifi, logger, Led, server_name: str, server_password: str, udp_port: int, udp_timeout: int):
        """
        Initialize the Bonjour instance.

        Args:
            logger: The logger object for logging messages.
            Led: The LED object for visual feedback.
            server_name (str): The name of the server to look for.
            server_password (str): The password for the server.
            udp_port (int): The UDP port for server communication.
            udp_timeout (int): The timeout for UDP operations in seconds.
        """
        self.deviceWifi = deviceWifi
        self.Logger = logger
        self.Led = Led
        self.server_password = server_password
        self.service_type = service_type
        self.udp_port = udp_port
        self.udp_timeout = udp_timeout
    
    @require_connection
    def find_server(self):
        """
        Attempt to find the server using Bonjour/mDNS.

        Returns:
            Optional[Dict[str, str]]: A dictionary containing the server's IP and port
                                      if found, or None if not found.
        """
        mdnss = mdns.Server(wifi.radio)
        services = mdnss.find(service_type="_http", protocol="_tcp")
        for service in services:
            if service.instance_name == self.server_name:
                server_ip = str(service.ipv4_address)
                server_port = str(service.port)
                print(f"Server found via bonjour at {server_ip}:{server_port}")
                self.Logger.log_issue(
                    "Info",
                    self.__class__.__name__,
                    "find_server_bonjour",
                    f"Server found via bonjour at {server_ip}:{server_port}",
                )
                return {"ip": server_ip, "port": server_port}
        return None

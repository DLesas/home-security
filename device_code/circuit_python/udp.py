from typing import Optional, Dict
from .logging import inject_function_name
from .wifi import require_connection
import wifi
import socketpool

class Udp:
    """
    A class for discovering servers using UDP broadcasting and TCP connection.

    This class provides functionality to find a specific server on the network
    by emitting UDP broadcasts and waiting for a TCP connection from the server.
    """

    def __init__(self, Wifi, logger, Led, udp_port: int, server_service_name: str, server_password: str, client_tcp_timeout: int, client_tcp_port: int):
        """
        Initialize the Udp instance.

        Args:
            Wifi: The WiFi object for network operations.
            logger: The logger object for logging messages.
            Led: The LED object for visual feedback.
            udp_port (int): The UDP port to broadcast to for server discovery.
            server_service_name (str): The name of the server service to look for.
            server_password (str): The password for the server.
            client_tcp_timeout (int): The timeout for TCP connection attempts in seconds.
            client_tcp_port (int): The TCP port on which to listen for server connections.
        """
        self.Wifi = Wifi
        self.Logger = logger
        self.Led = Led
        self.udp_port = int(udp_port)
        self.server_service_name = server_service_name
        self.server_password = server_password
        self.client_tcp_timeout = int(client_tcp_timeout)
        self.client_tcp_port = int(client_tcp_port)
    
    @inject_function_name
    @require_connection
    def find_server(self, func_name: str = "find_server") -> Optional[Dict[str, str]]:
        """
        Attempt to find the server by emitting a UDP broadcast and waiting for a TCP connection.

        Args:
            func_name (str): The name of the function, injected by the decorator.

        Returns:
            Optional[Dict[str, str]]: A dictionary containing the server's IP and port
                                      if found, or None if not found.
        """
        pool = socketpool.SocketPool(wifi.radio)
        udp_sock = pool.socket(pool.AF_INET, pool.SOCK_DGRAM)
        tcp_sock = pool.socket(pool.AF_INET, pool.SOCK_STREAM)
        
        try:
            # Set up UDP socket for broadcasting
            udp_sock.setsockopt(pool.SOL_SOCKET, pool.SO_BROADCAST, 1)
            
            # Set up TCP socket for listening on the predefined port
            tcp_sock.bind(("0.0.0.0", self.client_tcp_port))
            tcp_sock.listen(1)
            
            # Prepare broadcast message
            broadcast_message = f"{self.server_service_name}"
            
            # Emit UDP broadcast
            udp_sock.sendto(broadcast_message.encode(), ("255.255.255.255", self.udp_port))
            
            # Wait for TCP connection
            tcp_sock.settimeout(self.client_tcp_timeout) # in seconds
            try:
                client_sock, addr = tcp_sock.accept()
                try:
                    client_message = self.Wifi.ID
                    client_sock.send(client_message.encode())
                    server_message = client_sock.recv(1024).decode().strip()
                    if server_message == self.server_password:
                        print(f"Received from server: {server_message}")
                        server_info = {"ip": addr[0], "port": str(addr[1])}
                        self._log_server_found(func_name, server_info)
                        return server_info
                    else:
                        print(f"Received from server: {server_message}")
                        self.Logger.log_issue(
                            "Warning",
                            self.__class__.__name__,
                            func_name,
                            f"Received incorrect password from server: {server_message}",
                        )
                        return None
                finally:
                    client_sock.close()
            except OSError as e:
                print(f"Timeout waiting for TCP connection: {e}")
                return None
        
        finally:
            udp_sock.close()
            tcp_sock.close()

    def _log_server_found(self, func_name: str, server_info: Dict[str, str]) -> None:
        """
        Log that the server has been found.

        Args:
            func_name (str): The name of the calling function.
            server_info (Dict[str, str]): A dictionary containing the server's IP and port.
        """
        message = f"Server connected via TCP from {server_info['ip']}:{server_info['port']}"
        print(message)
        self.Logger.log_issue(
            "Info",
            self.__class__.__name__,
            func_name,
            message,
        )
import network
import socket
import time
from picozero import pico_led
import uasyncio as asyncio
import machine

async def connect(ssid: str, password: str) -> tuple[str, str, network.WLAN]:
    """
    Asynchronously connects to a Wi-Fi network.

    This function attempts to connect to a specified Wi-Fi network using the provided SSID and password.
    It will continuously attempt to connect until successful, blinking the Pico's LED during the process.

    Args:
        ssid (str): The SSID (name) of the Wi-Fi network to connect to.
        password (str): The password for the Wi-Fi network.

    Returns:
        tuple[str, str, network.WLAN]: A tuple containing:
            - The IP address assigned to the Pico (str)
            - The MAC address of the Pico's Wi-Fi interface (str)
            - The WLAN object representing the network connection (network.WLAN)

    Raises:
        No specific exceptions are raised, but the function will not return until a connection is established.

    Note:
        This function requires the 'network', 'uasyncio', and 'picozero' modules to be imported.
        It also assumes that 'pico_led' is available from the 'picozero' module.
    """
    print("Connecting to network...")
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    wlan.config(pm=0xA11140)
    wlan.connect(ssid, password)
    while not wlan.isconnected():
        pico_led.on()
        print("Waiting for connection...")
        await asyncio.sleep(1)
        pico_led.off()
    config = wlan.ifconfig()
    ip = config[0]
    mac = wlan.config("mac")
    mac_address = "-".join("%02x" % b for b in mac).upper()
    print(f"Connected to {ip} with MAC {mac_address}")
    return ip, mac_address, wlan


async def reconnect(wlan: network.WLAN, ssid: str, password: str) -> tuple[str, network.WLAN]:
    """
    Asynchronously reconnects to a Wi-Fi network.

    This function attempts to reconnect to a specified Wi-Fi network using the provided WLAN object, SSID, and password.
    It performs cleanup before attempting to reconnect and will continuously attempt to reconnect until successful,
    blinking the Pico's LED during the process.

    Args:
        wlan (network.WLAN): The WLAN object representing the network interface.
        ssid (str): The SSID (name) of the Wi-Fi network to reconnect to.
        password (str): The password for the Wi-Fi network.

    Returns:
        tuple[str, network.WLAN]: A tuple containing:
            - The IP address assigned to the Pico after reconnection (str)
            - The WLAN object representing the network connection (network.WLAN)

    Raises:
        No specific exceptions are raised, but the function will not return until a connection is re-established.

    Note:
        This function requires the 'network', 'uasyncio', and 'picozero' modules to be imported.
        It also assumes that 'pico_led' is available from the 'picozero' module.
    """
    print("Disconnecting from current network...")
    wlan.disconnect()
    await asyncio.sleep(1)  # Wait for disconnection to complete

    print("Performing network cleanup...")
    wlan.active(False)
    await asyncio.sleep(1)  # Allow time for the interface to fully deactivate
    wlan.active(True)
    await asyncio.sleep(1)  # Allow time for the interface to fully activate
    wlan.config(pm=0xA11140)

    print("Attempting to reconnect...")
    wlan.connect(ssid, password)
    
    retry_count = 0
    max_retries = 10
    while not wlan.isconnected() and retry_count < max_retries:
        pico_led.on()
        print(f"Reconnecting... Attempt {retry_count + 1}/{max_retries}")
        await asyncio.sleep(1)
        pico_led.off()
        await asyncio.sleep(1)
        retry_count += 1

    if not wlan.isconnected():
        print("Failed to reconnect after multiple attempts. Restarting the device...")
        machine.reset()

    ip = wlan.ifconfig()[0]
    print(f"Reconnected on {ip}")
    return ip, wlan




def open_socket(ip: str) -> socket.socket:
    """
    opens a non-blocking socket and binds it to the specified IP address.

    This function creates a socket, binds it to the given IP address on port 80,
    sets it to listen for incoming connections, and configures it as non-blocking.

    Args:
        ip (str): The IP address to bind the socket to.

    Returns:
        socket.socket: A non-blocking socket object bound to the specified IP address and port 80.

    Note:
        This function requires the 'socket' module to be imported.
        The socket is set to listen on port 80 by default.
        The socket is configured as non-blocking to work with asynchronous operations.
    """
    address = (ip, 80)
    connection = socket.socket()
    connection.bind(address)
    connection.listen()
    connection.setblocking(False)
    print(f"Listening on {ip}:80")
    return connection



def accept_client(connection: socket.socket) -> tuple[socket.socket, tuple]:
    """
    Accepts a client connection from a non-blocking socket.

    This function attempts to accept a client connection from the given non-blocking socket.
    If no client is immediately available, it will retry until a connection is established.

    Args:
        connection (socket.socket): The non-blocking socket listening for connections.

    Returns:
        tuple[socket.socket, tuple]: A tuple containing:
            - socket.socket: The client socket object.
            - tuple: The address of the connected client.

    Raises:
        OSError: If an error occurs during the accept operation, except for EAGAIN (errno 11).

    Note:
        This function is designed to work with non-blocking sockets. It handles the EAGAIN error
        (errno 11) by introducing a small delay and retrying. For any other errors, it will raise
        the exception.

    Example:
        client, addr = accept_client(server_socket)
    """
    while True:
        try:
            client, addr = connection.accept()
            return client, addr
        except OSError as e:
            if e.errno == 11: 
                # EAGAIN error (Resource temporarily unavailable)
                # EAGAIN (Error Again) occurs when a non-blocking operation
                # cannot be completed immediately. In this case, it means
                # no client is ready to be accepted at the moment.
                time.sleep(0.3)
            else:
                raise


async def keep_alive(wlan: network.WLAN):
    """
    Asynchronous function to maintain the network connection.

    This function runs indefinitely, periodically checking and refreshing
    the network connection to prevent timeouts.

    Args:
        wlan (network.WLAN): The WLAN object representing the network interface.

    The function performs the following actions in a loop:
    1. Checks if the WLAN is connected.
    2. If connected, it attempts to refresh the connection by calling wlan.ifconfig().
    3. If an exception occurs during the refresh, it prints an error message.
    4. Waits for 30 seconds before the next iteration.

    Note:
        This function is designed to be run as a background task using asyncio.

    Example:
        wlan = network.WLAN(network.STA_IF)
        asyncio.create_task(keep_alive(wlan))
    """
    while True: 
        if wlan.isconnected():
            try:
                print('keeping alive')
                wlan.ifconfig()
            except Exception as e:
                print(f"Keep-alive operation failed: {e}")
        await asyncio.sleep(30)
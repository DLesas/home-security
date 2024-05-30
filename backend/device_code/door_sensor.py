import network
import socket
from time import sleep
from picozero import pico_temp_sensor, pico_led
import machine
import json
import _thread
import select

switch = machine.Pin(22, machine.Pin.IN, machine.Pin.PULL_UP)

defaultPIs = [
    {
        "name": "[Pico] Dining room",
        "delay": 0.0,
        "mac": "28-CD-C1-0F-33-3A",
        "potentialIP": "192.168.1.111",
        "location": "House",
    },
    {
        "name": "[Pico] Living room",
        "delay": 0.0,
        "mac": "28-CD-C1-0F-31-62",
        "potentialIP": "192.168.1.241",
        "location": "House",
    },
    {
        "name": "[Pico] Back door",
        "delay": 0.0,
        "mac": "28-CD-C1-0F-34-5E",
        "potentialIP": "192.168.1.191",
        "location": "House",
    },
    {
        "name": "[Pico] Front door",
        "delay": 0.0,
        "mac": "28-CD-C1-0F-2B-25",
        "potentialIP": "192.168.1.75",
        "location": "House",
    },
    # {
    #     "name": "[Pico] Claude's door",
    #     "delay": 0.3,
    #     "mac": "28-CD-C1-0F-2B-26",
    #     "potentialIP": "192.168.1.76",
    #     'location': 'Stables',
    # },
    {
        "name": "[Pico] ront door",
        "delay": 0.0,
        "mac": "28-CD-C1-0F-2B-79",
        "potentialIP": "192.168.0.195",
        "location": "Stables",
    },
    {
        "name": "[Pico] Back door",
        "delay": 0.3,
        "mac": "28-CD-C1-0F-34-CE",
        "potentialIP": "192.168.0.235",
        'location': 'Stables',
    },
    {
        "name": "[Pico] Shed door",
        "delay": 0.3,
        "mac": "28-CD-C1-0F-2B-42",
        "potentialIP": "192.168.1.120",
        'location': 'Shed',
    },
    {
        "name": "[Pico] Garage door",
        "delay": 0.3,
        "mac": "28-CD-C1-0F-33-F4",
        "potentialIP": "192.168.1.105",
        'location': 'Garage',
    },
]


relays = [
    {
        "name": "[Pico] Shed alarm",
        "mac": "28-CD-C1-0F-34-B1",
        "potentialIP": "192.168.1.84",
        "location": "Shed",
    },
]

# ssid = "***REMOVED_SSID***"
# password = "***REMOVED_PASSWORD***"
ssid = "***REMOVED_SSID***"
password = "***REMOVED_PASSWORD***"


def find_device(mac_address, devices):
    for device in devices:
        if device["mac"] == mac_address:
            return device
    return None


def connect():
    print("connecting")
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    wlan.config(pm=0xA11140)
    wlan.connect(ssid, password)
    while not wlan.isconnected():
        sleep(0.2)
        pico_led.on()
        print("Waiting for connection...")
        sleep(1)
        pico_led.off()
    # Retrieve network configuration
    config = wlan.ifconfig()
    gateway = config[2]  # Gateway is the third element in the tuple
    mac = wlan.config("mac")
    # Format MAC address
    mac_address = "-".join("%02x" % b for b in mac).upper()
    print("my mac : ", mac_address)
    deviceInfo = find_device(mac_address, defaultPIs)
    if deviceInfo:
        print("found my mac")
        # Configure with static IP, subnet mask, gateway, and gateway (DNS)
        wlan.ifconfig((deviceInfo["potentialIP"], config[1], config[2], config[3]))
    ip = wlan.ifconfig()[0]
    print(f"Connected on {ip}")
    return ip


def open_socket(ip):
    address = (ip, 80)
    connection = socket.socket()
    connection.bind(address)
    connection.listen(5)
    print(f"Listening on {ip}:80")
    return connection


def serve(connection):
    blink_light_range(20)
    print("ready")
    while True:
        try:
            client, addr = connection.accept()
            print("Connection from", addr)
            handle_client(client)
        except KeyboardInterrupt:
            print("Server stopped by user")
            break
        except Exception as e:
            print("Error in serve:", e)


def handle_client(client):
    try:
        request = client.recv(1024)
        print ("handling request")
        temperature = pico_temp_sensor.temp
        door_state = "open" if switch.value() else "closed"
        data = {"door_state": door_state, "temperature": temperature}
        response = json.dumps(data)
        print("sending response")
        # Set a timeout for sending data
        # Adjust the timeout value as needed
        client.send("HTTP/1.1 200 OK\r\n")
        client.send("Content-Type: application/json\r\n\r\n")
        client.send(response)
        print("closing connection")
    except Exception as e:
        print("Error handling client:", e)
    finally:
        client.close()
    return True


def light_control():
    print("started light control")
    while True:
        val = switch.value()
        if val == 1:
            pico_led.on()
        else:
            pico_led.off()
        sleep(0.1)


def blink_light():
    while True:
        pico_led.on()
        sleep(0.3)
        pico_led.off()
        sleep(0.3)


def blink_light_range(ran):
    for i in range(ran):
        pico_led.on()
        sleep(0.3)
        pico_led.off()
        sleep(0.3)


def main():
    ip = connect()
    connection = open_socket(ip)
    serve(connection)
    # _thread.start_new_thread(serve, (connection,))
    # light_control()


try:
    main()
except Exception as e:
    print("Error:", e)
    blink_light()

import network
import socket
from time import sleep
from picozero import pico_temp_sensor, pico_led
import machine
import json
import _thread
from network_functions import get_local_ip, get_broadcast_address, get_network_mask

switch = machine.Pin(22, machine.Pin.IN, machine.Pin.PULL_UP)

ssid = "BT-P8A5PT"
password = "hARMLTPd7caeHf"
keep_alive_interval = 60

static_ip = "xxxxxxx"


def connect():
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    wlan.connect(ssid, password)
    gateway = wlan.config("gateway")
    while not wlan.isconnected():
        print("Waiting for connection...")
        sleep(1)
    wlan.ifconfig((static_ip, "255.255.255.0", gateway, gateway))
    ip = wlan.ifconfig()[0]
    print(f"Connected on {ip}")
    return ip


def open_socket(ip):
    address = (ip, 80)
    connection = socket.socket()
    connection.bind(address)
    connection.listen(1)
    print(f"Listening on {ip}:80")
    return connection


def serve(connection):
    while True:
        try:
            client, addr = connection.accept()
            print("Connection from", addr)
            _thread.start_new_thread(handle_client, (client,))
        except KeyboardInterrupt:
            print("Server stopped by user")
            break


def handle_client(client):
    try:
        request = client.recv(1024)
        request = str(request)
        request = request.split()[1]
        temperature = pico_temp_sensor.temp
        door_state = "open" if switch.value() else "closed"
        data = {"door_state": door_state, "temperature": temperature}
        response = json.dumps(data)
        client.send("HTTP/1.1 200 OK\r\n")
        client.send("Content-Type: application/json\r\n\r\n")
        client.send(response)
    finally:
        client.close()


def light_control():
    while True:
        val = switch.value()
        if val == 1:
            pico_led.on()
        else:
            pico_led.off()
        sleep(0.5)


def send_keep_alive():
    ip = get_local_ip()
    mask = get_network_mask(ip)
    broadcastAddress = get_broadcast_address(ip, mask)
    udp_socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    while True:
        try:
            udp_socket.sendto(
                b"Keep alive", (broadcastAddress, 60000)
            )  # Change IP and port as needed
            sleep(keep_alive_interval)
        except Exception as e:
            print("Error:", e)


try:
    ip = connect()
    connection = open_socket(ip)
    _thread.start_new_thread(serve, (connection,))
    _thread.start_new_thread(light_control, ())
    _thread.start_new_thread(send_keep_alive, ())
except Exception as e:
    print("Error:", e)
    machine.reset()

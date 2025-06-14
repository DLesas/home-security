import network
import socket
from time import sleep
from picozero import pico_temp_sensor, pico_led
import machine
import json
import _thread
import select

#switch = machine.Pin(22, machine.Pin.IN, machine.Pin.PULL_UP)
relay = machine.Pin(22, machine.Pin.OUT)

#ssid = "[Redacted]"
#password = "[Redacted]"
ssid = "[Redacted]"
password = "[Redacted]"

def find_device(mac_address, devices):
    for device in devices:
        if device["mac"] == mac_address:
            return device
    return None


def connect():
    print('connecting')
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    wlan.config(pm = 0xa11140)
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
    mac = wlan.config('mac')
    # Format MAC address
    mac_address = '-'.join('%02x' % b for b in mac).upper()
    print('my mac : ', mac_address)
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
    print('ready')
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
        print('handling request')
        print(request)
        request = request.decode("utf-8")
        print(request)
        temperature = pico_temp_sensor.temp
        alarm_on = request.find('/alarm/on')
        alarm_off = request.find('/alarm/off')
        print(alarm_on)
        print(alarm_off)
        state = 0
        if alarm_on > 0:
            pico_led.on()
            relay.value(1)
            state = 1
        if alarm_off > 0:
            pico_led.off()
            relay.value(0)
            state = 0
        data = {"state": state, "temperature": temperature}
        response = json.dumps(data)
        print('sending response')
        # Set a timeout for sending data
        # Adjust the timeout value as needed
        client.send("HTTP/1.1 200 OK\r\n")
        client.send("Content-Type: application/json\r\n\r\n")
        client.send(response)
        print('closing connection')
    except Exception as e:
        print("Error handling client:", e)
    finally:
        client.close()
    return True


# def light_control():
#     print('started light control')
#     while True:
#         val = switch.value()
#         if val == 1:
#             pico_led.on()
#         else:
#             pico_led.off()
#         sleep(0.1)


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
    #_thread.start_new_thread(serve, (connection,))
    #light_control()


try:
    main()
except Exception as e:
    print("Error:", e)
    blink_light()







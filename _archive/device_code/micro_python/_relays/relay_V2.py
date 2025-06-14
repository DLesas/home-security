import network
import socket
import uasyncio as asyncio
from time import sleep
from picozero import pico_temp_sensor, pico_led
import machine
import json

relay = machine.Pin(22, machine.Pin.OUT)

# ssid = "[Redacted]"
# password = "[Redacted]"
ssid = "[Redacted]"
password = "[Redacted]"

async def connect():
    print('Connecting to network...')
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    wlan.config(pm=0xa11140)  # Disable power management
    wlan.connect(ssid, password)
    while not wlan.isconnected():
        pico_led.on()
        print("Waiting for connection...")
        await asyncio.sleep(1)
        pico_led.off()
    config = wlan.ifconfig()
    ip = config[0]
    mac = wlan.config('mac')
    mac_address = '-'.join('%02x' % b for b in mac).upper()
    print(f"Connected to {ip} with MAC {mac_address}")
    return ip, wlan

async def open_socket(ip):
    address = (ip, 80)
    connection = socket.socket()
    connection.bind(address)
    connection.listen(5)
    connection.setblocking(False)
    print(f"Listening on {ip}:80")
    return connection

async def serve(connection, wlan):
    blink_light_range(20)
    print('Server is ready')
    keep_alive_task = asyncio.create_task(keep_alive(wlan))
    while True:
        if not wlan.isconnected():
            print("Disconnected from network, attempting to reconnect...")
            connection.close()
            ip, wlan = await reconnect(wlan)
            connection = await open_socket(ip)
            keep_alive_task.cancel()
            keep_alive_task = asyncio.create_task(keep_alive(wlan))
            continue

        try:
            client, addr = await asyncio.wait_for(accept_client(connection), timeout=1)
            print(f"Connection from {addr}")
            asyncio.create_task(handle_client(client))
        except asyncio.TimeoutError:
            pass
        except OSError as e:
            if e.errno == 11:  # EAGAIN error
                continue
            else:
                print(f"Error in serve: {e}")

async def accept_client(connection):
    while True:
        try:
            client, addr = connection.accept()
            return client, addr
        except OSError as e:
            if e.errno == 11:  # EAGAIN error
                await asyncio.sleep(0.1)
            else:
                raise

async def handle_client(client):
    try:
        client.settimeout(3.0)
        request = await asyncio.wait_for(read_request(client), timeout=3)
        print('Handling request')
        print(request)
        request = request.decode("utf-8")
        temperature = pico_temp_sensor.temp
        alarm_on = request.find('/alarm/on')
        alarm_off = request.find('/alarm/off')
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
        print('Sending response')
        client.send("HTTP/1.1 200 OK\r\n")
        client.send("Content-Type: application/json\r\n\r\n")
        client.send(response)
        print('Closing connection')
    except asyncio.TimeoutError:
        print("Client request timed out")
    except Exception as e:
        print(f"Error handling client: {e}")
    finally:
        client.close()

async def read_request(client):
    while True:
        try:
            return client.recv(1024)
        except OSError as e:
            if e.errno == 11:  # EAGAIN error
                await asyncio.sleep(0.1)
            else:
                raise

async def reconnect(wlan):
    wlan.disconnect()
    while not wlan.isconnected():
        print("Reconnecting...")
        wlan.connect(ssid, password)
        await asyncio.sleep(5)
    ip = wlan.ifconfig()[0]
    print(f"Reconnected on {ip}")
    return ip, wlan

async def keep_alive(wlan):
    while True:
        if wlan.isconnected():
            try:
                wlan.ifconfig()  # A simple operation to keep the connection alive
            except Exception as e:
                print(f"Keep-alive operation failed: {e}")
        await asyncio.sleep(30)  # Adjust the interval as necessary

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

async def main():
    ip, wlan = await connect()
    connection = await open_socket(ip)
    await serve(connection, wlan)

try:
    asyncio.run(main())
except Exception as e:
    print(f"Error: {e}")
    blink_light_range(20)
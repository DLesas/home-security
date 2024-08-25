import network
import socket
import uasyncio as asyncio
from time import sleep
from picozero import pico_temp_sensor, pico_led
import machine
import json
import urequests
import gc

switch = machine.Pin(22, machine.Pin.IN, machine.Pin.PULL_UP)

def load_config():
    try:
        with open('config.json', 'r') as f:
            return json.load(f)
    except:
        print("Failed to load config, using defaults")
        

config = load_config()
ssid = config['ssid']
password = config['password']
server_endpoint = config['server_endpoint']





async def serve(connection, wlan):
    blink_light_range(20)
    print("Server is ready")
    keep_alive_task = asyncio.create_task(keep_alive(wlan))
    previous_door_state = switch.value()
    while True:
        if not wlan.isconnected():
            print("Disconnected from network, attempting to reconnect...")
            connection.close()
            ip, wlan = await reconnect(wlan)
            connection = await open_socket(ip)
            keep_alive_task.cancel()
            keep_alive_task = asyncio.create_task(keep_alive(wlan))
            continue

        current_door_state = switch.value()
        if current_door_state != previous_door_state:
            previous_door_state = current_door_state
            door_state = "open" if current_door_state else "closed"
            asyncio.create_task(send_door_state(door_state))  # Use create_task to avoid blocking

        # Accept client connections without blocking
        try:
            client, addr = await asyncio.wait_for(accept_client(connection), timeout=0.1)
            print(f"Connection from {addr}")
            asyncio.create_task(handle_client(client))
        except asyncio.TimeoutError:
            pass
        except OSError as e:
            if e.errno == 11:  # EAGAIN error
                continue
            else:
                print(f"Error in serve: {e}")



async def handle_client(client):
    try:
        client.settimeout(3.0)
        request = await asyncio.wait_for(read_request(client), timeout=2)
        print("Handling request")
        temperature = pico_temp_sensor.temp
        door_state = "open" if switch.value() else "closed"
        data = {"door_state": door_state, "temperature": temperature}
        print(data)
        response = json.dumps(data)
        print("Sending response")
        client.send("HTTP/1.1 200 OK\r\n")
        client.send("Content-Type: application/json\r\n\r\n")
        client.send(response)
        print("Closing connection")
    except asyncio.TimeoutError:
        print("Client request timed out")
    except Exception as e:
        print(f"Error handling client: {e}")
    finally:
        client.close()
        gc.collect()  # Force garbage collection after closing client

async def read_request(client):
    while True:
        try:
            return client.recv(1024)
        except OSError as e:
            if e.errno == 11:  # EAGAIN error
                await asyncio.sleep(0.1)
            else:
                raise



async def keep_alive(wlan):
    while True:
        if wlan.isconnected():
            try:
                print('keeping alive')
                wlan.ifconfig()
            except Exception as e:
                print(f"Keep-alive operation failed: {e}")
        await asyncio.sleep(30)

async def send_door_state(door_state):
    while True:
        try:
            temperature = pico_temp_sensor.temp
            data = {"door_state": door_state, "temperature": temperature}
            headers = {'Content-Type': 'application/json'}
            response = urequests.post(server_endpoint, data=json.dumps(data), headers=headers)
            if response.status_code == 200:
                response.close()
                print(f"Successfully sent door state: {door_state}")
                break  # Exit the loop if the request was successful
            else:
                response.close()
                print(f"Failed to send door state, status code: {response.status_code}")
        except Exception as e:
            print(f"Failed to send door state: {e}")
            gc.collect()  # Force garbage collection on failure
        
        await asyncio.sleep(0.2)  # Increased delay to reduce memory pressure

def blink_light_range(ran):
    for i in range(ran):
        pico_led.on()
        sleep(0.3)
        pico_led.off()
        sleep(0.3)

async def restart_device(wlan):
    print("Attempting to disconnect from the network...")
    wlan.disconnect()
    print("Disconnected. Restarting device in 10 seconds...")
    await asyncio.sleep(10)
    blink_light_range(20)
    machine.reset()

async def main():
    ip, wlan = await connect()
    connection = await open_socket(ip)
    await serve(connection, wlan)

try:
    asyncio.run(main())
except Exception as e:
    print(f"Error: {e}")
    wlan = network.WLAN(network.STA_IF)
    asyncio.run(restart_device(wlan))

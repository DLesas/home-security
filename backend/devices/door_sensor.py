import network
import socket
from time import sleep
from picozero import pico_temp_sensor, pico_led
import machine
import urequests
from machine import Pin
import json
import _thread

switch = Pin(22, Pin.IN, Pin.PULL_UP)


ssid = "***REMOVED_SSID***"
password = '***REMOVED_PASSWORD***'
count = 0

def connect():
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    wlan.connect(ssid, password)
    while wlan.isconnected() == False:
        print('Waiting for connection...')
        sleep(1)
    ip = wlan.ifconfig()[0]
    print(f'Connected on {ip}')
    return ip
    
def open_socket(ip):
    # Open a socket
    print(ip)
    address = (ip, 80)
    connection = socket.socket()
    connection.bind(address)
    connection.listen(1)
    print(connection)
    return connection

def webpage(temperature, state, switch):
    #Template HTML
    html = f"""
            <!DOCTYPE html>
            <html>
            <form action="./lighton">
            <input type="submit" value="Light on" />
            </form>
            <form action="./lightoff">
            <input type="submit" value="Light off" />
            </form>
            <p>LED is {state}</p>
            <p>switch value is {switch}</p>
            <p>Temperature is {temperature}</p>
            </body>
            </html>
            """
    html = f'{switch}'
    return str(html)

def send_html(jsondata, connection):
    print('accepting')
    try:
        client = connection.accept()[0]
        request = client.recv(1024)
        request = str(request)
        request = request.split()[1]
        #    pico_led.on()
        #    state = 'ON'
        #elif request =='/lightoff?':
        #    pico_led.off()
        #    state = 'OFF'
        
        client.send('HTTP/1.0 200 OK\r\nContent-type: text/json\r\n\r\n')
        client.send(jsondata)
        client.close()
    except IndexError:
            pass
    finally:
        client.close()
        print(' >> Connection closed.')

def serve(connection):
    #Start a web server
    state = 'OFF'
    pico_led.off()
    temperature = 0
    while True:
        pico_led.off()
        val = switch.value()
        if val == 1:
            pico_led.on()
            senState = 'open'
            
        else:
            pico_led.off()
            senState = 'closed'
        temperature = pico_temp_sensor.temp
        data = {'door': senState, 'temp': temperature}
        #res = urequests.post('http://192.168.43.94:5000/webhook', headers = {'content-type': 'application/json'}, data=json.dumps(data))
        #print(res.content)
        jsondata = json.dumps(data)
        #jsonresults = json.loads(res)
        #print(jsonresults)
        print('ready to accept')
        send_html(jsondata, connection)
        


try:
    ip = connect()
    connection = open_socket(ip)
    serve(connection)
except:
    machine.reset()


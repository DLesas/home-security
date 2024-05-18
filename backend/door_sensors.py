from operator import index
import pandas as pd
import os
import network_functions
import requests
import json
import threading
import time
from playsound import playsound

sensors = [
    {
        "name": "[Pico] livingRoom-frenchDoor1",
        "delay": 0.3,
        "mac": "28-CD-C1-0F-33-3A",
        "potentialIP": "192.168.1.111",
    },
    {
        "name": "[Pico] livingRoom-frenchDoor2",
        "delay": 0.3,
        "mac": "28-CD-C1-0F-31-62",
        "potentialIP": "192.168.1.241",
    },
    {
        "name": "[Pico] backDoor",
        "delay": 0.3,
        "mac": "28-CD-C1-0F-34-5E",
        "potentialIP": "192.168.1.191",
    },
    {
        "name": "[Pico] frontDoor",
        "delay": 0.3,
        "mac": "28-CD-C1-0F-2B-25",
        "potentialIP": "192.168.1.75",
    },
]
armed = False
playing = False
fileDir = os.path.dirname(os.path.realpath(__file__))
logFolder = os.path.join(fileDir, "logs")


def writeToFile(json: dict, name: str):
    json["date"] = pd.to_datetime("now").strftime("%d-%m-%Y %H:%M:%S")
    date = pd.to_datetime("now").strftime("%d_%m_%Y")
    df = pd.DataFrame(json, index=[0])
    df.to_csv(
        os.path.join(logFolder, f'{date + "_" + name}'),
        mode="a",
        header=not os.path.exists(os.path.join(logFolder, f'{date + "_" + name}')),
        index=False,
    )


def alarm():
    global playing
    playsound(
        r"C:\Users\Dimitri\Documents\Javascript\home_security\backend\Treasure.wav"
    )
    playing = False


def sensorWork(addr: str, sensorDict: dict):
    global playing
    print("started work")
    while True:
        try:
            res = requests.get(addr)
            resJson = json.loads(res.content)
            print(f"{sensorDict['name']}: {resJson}")
            t = threading.Thread(
                target=writeToFile, args=(resJson, sensorDict["name"] + ".csv")
            )
            t.start()
            if resJson["temperature"] > 45:
                continue
                # warn about potential fire?
            if resJson["door_state"] == "open" and armed == True and playing == False:
                playing = True
                soundT = threading.Thread(target=alarm)
                soundT.start()
            # warn about potential intruder
            time.sleep(sensorDict["delay"])
        except Exception as e:
            print(e)
            time.sleep(1)


def main():
    #ip = network_functions.get_local_ip()
    #mask = network_functions.get_network_mask(ip)
    #broadcastAddress = network_functions.get_broadcast_address(ip, mask)
    #network_functions.refresh_arp_cache(broadcastAddress)
    #network_functions.send_direct_arp_requests(broadcastAddress)
    #network_functions.scan_network_with_nmap(broadcastAddress, mask, ip)
    for sensor in sensors:
        # ip = socket.gethostbyname(sensor["name"])
        ip = network_functions.find_ip_by_mac(sensor["mac"])
        print(f'found ip of {sensor["name"]}: {ip}')
        if ip == None:
            print(f'could not find ip of {sensor["name"]}, falling back to potentialIP')
            ip = sensor["potentialIP"]
        addr = f"http://{ip}/"
        t = threading.Thread(target=sensorWork, args=(addr, sensor))
        t.start()


if __name__ == "__main__":
    main()

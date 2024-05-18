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
    {"name": "[Pico] livingRoom-frenchDoor1", "delay": 0.3, "mac": "28-CD-C1-0F-33-3A"},
    {"name": "[Pico] livingRoom-frenchDoor2", "delay": 0.3, "mac": "28-CD-C1-0F-31-62"},
    {"name": "[Pico] backDoor", "delay": 0.3, "mac": "28-CD-C1-0F-34-5E"},
    {"name": "[Pico] frontDoor", "delay": 0.3, "mac": "28-CD-C1-0F-2B-25"}
]
armed = True
playing = False
fileDir = os.path.dirname(os.path.realpath(__file__))
logFolder = os.path.join(fileDir, "logs")


def writeToFile(json: dict, name: str):
    print(f"{name}: {json}")
    json["date"] = pd.to_datetime("now").strftime("%Y-%m-%d %H:%M:%S")
    df = pd.DataFrame(json, index=[0])
    df.to_csv(
        os.path.join(logFolder, name),
        mode="a",
        header=not os.path.exists(os.path.join(logFolder, name)),
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
        res = requests.get(addr)
        resJson = json.loads(res.content)
        writeToFile(resJson, sensorDict["name"] + ".csv")
        if resJson["temp"] > 45:
            continue
            # warn about potential fire?
        if resJson["door"] == "open" and armed == True and playing == False:
            playing = True
            soundT = threading.Thread(target=alarm)
            soundT.start()
            # warn about potential intruder
        time.sleep(sensorDict["delay"])


def main():
    for sensor in sensors:
        # ip = socket.gethostbyname(sensor["name"])
        ip = network_functions.find_ip_by_mac(sensor["mac"])
        print(f'found ip of {sensor["name"]}: {ip}')
        addr = f"http://{ip}/"
        t = threading.Thread(target=sensorWork, args=(addr, sensor))
        t.start()


if __name__ == "__main__":
    main()

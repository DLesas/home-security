import pandas as pd
import os
import socket
import requests
import json
import threading
import time

sensors = [{"name": "", "delay": 0.3}]
armed = False


def writeToFile(json: dict, name: str):
    df = pd.DataFrame(json)
    df.to_csv(name, mode="a", header=not os.path.exists(name))


def sensorWork(addr: str, sensorDict: dict):
    while True:
        res = requests.get(addr)
        resJson = json.loads(res.content)
        writeToFile(resJson, sensorDict["name"] + ".csv")
        if resJson["temp"] > 45:
            continue
            # warn about potential fire?
        if resJson["door"] == "open" and armed == True:
            continue
            # warn about potential intruder
        time.sleep(sensorDict["delay"])


def main():
    for sensor in sensors:
        ip = socket.gethostbyname(sensor["name"])
        addr = f"http://{ip}/"

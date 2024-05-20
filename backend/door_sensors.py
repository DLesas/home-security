from flask import Flask, request, jsonify
import pandas as pd
import os
import network_functions
import requests
import json
import threading
import time
import multiprocessing
from playsound import playsound
from flask_cors import CORS

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

latestLog = {
    "livingRoom-frenchDoor1": None,
    "livingRoom-frenchDoor2": None,
    "backDoor": None,
    "frontDoor": None,
}

latestLog2 = [
    {"name": None, "time": None, "status": None, "temp": None},
    {"name": None, "time": None, "status": None, "temp": None},
    {"name": None, "time": None, "status": None, "temp": None},
    {"name": None, "time": None, "status": None, "temp": None}
]

armed = False
playing = False
fileDir = os.path.dirname(os.path.realpath(__file__))
logFolder = os.path.join(fileDir, "logs")


def writeToFile(data: dict, name: str):
    data["date"] = pd.to_datetime("now").strftime("%d-%m-%Y %H:%M:%S")
    date = pd.to_datetime("now").strftime("%d_%m_%Y")
    df = pd.DataFrame(data, index=[0])
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
    global playing, armed, latestLog
    print("started work")
    while True:
        try:
            res = requests.get(addr)
            resJson = json.loads(res.content)
            print(f"{sensorDict['name']}: {resJson}")
            name = sensorDict["name"].split("] ")[1]
            latestLog[name] = resJson
            t = threading.Thread(
                target=writeToFile, args=(resJson, sensorDict["name"] + ".csv")
            )
            t.start()
            if resJson["temperature"] > 45:
                continue
                # warn about potential fire?
            if resJson["door_state"] == "open" and armed and not playing:
                print('ALARM!!!')
                playing = True
                soundT =  threading.Thread(target=alarm)
                soundT.start()
            # warn about potential intruder
            time.sleep(sensorDict["delay"])
        except Exception as e:
            print(e)
            time.sleep(1)


def main():
    for sensor in sensors:
        ip = network_functions.find_ip_by_mac(sensor["mac"])
        print(f'found ip of {sensor["name"]}: {ip}')
        if ip is None:
            print(f'could not find ip of {sensor["name"]}, falling back to potentialIP')
            ip = sensor["potentialIP"]
        addr = f"http://{ip}/"
        t = threading.Thread(target=sensorWork, args=(addr, sensor))
        t.start()


app = Flask(__name__)
CORS(app)

@app.route('/arm', methods=['GET'])
def arm():
    global armed
    armed = True
    return jsonify({"armed": armed})

@app.route('/disarm', methods=['GET'])
def disarm():
    global armed
    armed = False
    return jsonify({"armed": armed})

@app.route('/status', methods=['GET'])
def status():
    return jsonify({"status": armed})

@app.route('/logs', methods=['GET'])
def logs():
    return jsonify(latestLog)

def run_flask():
    app.run(host='0.0.0.0', port=5000)

if __name__ == "__main__":
    flask_thread = threading.Thread(target=run_flask)
    flask_thread.daemon = True
    flask_thread.start()
    main()
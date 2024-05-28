from flask import Flask, request, jsonify
import pandas as pd
import os

# import network_functions
import requests
import json
import threading
import time
import multiprocessing
from playsound import playsound
from flask_cors import CORS
import numpy as np
from typing import List
from torch import device
from ultralytics import YOLO
from flask_sock import Sock
import cv2
import requests as r

model = YOLO(
    os.path.join(os.path.split(os.path.realpath(__file__))[0], "models", "yolov8m.pt")
)
model.TASK = "detect"
model.MODE = "predict"

sensors = [
    {
        "name": "[Pico] Dining room - French door",
        "delay": 0.0,
        "mac": "28-CD-C1-0F-33-3A",
        "potentialIP": "192.168.1.111",
        "location": "House",
    },
    {
        "name": "[Pico] Living room - French door",
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
        "name": "[Pico] Barn front door",
        "delay": 0.0,
        "mac": "28-CD-C1-0F-2B-79",
        "localIP": "192.168.0.195",
        "potentialIP": "192.168.1.214:8555",
        "location": "Stables",
    },
    {
        "name": "[Pico] Barn back door",
        "delay": 0.3,
        "mac": "28-CD-C1-0F-34-CE",
        "localIP": "192.168.0.235",
        "potentialIP": "192.168.1.214:8556",
        "location": "Stables",
    },
    # {
    #     "name": "[Pico] Shed door",
    #     "delay": 0.3,
    #     "mac": "28-CD-C1-0F-2B-29",
    #     "potentialIP": "192.168.1.79",
    #     'location': 'Shed',
    # },
    # {
    #     "name": "[Pico] Garage door",
    #     "delay": 0.3,
    #     "mac": "28-CD-C1-0F-2B-2A",
    #     "potentialIP": "192.168.1.80",
    #     'location': 'Garage',
    # },
]


alarms = [
    {
        "name": "[Pico] Shed alarm",
        "mac": "28-CD-C1-0F-34-B1",
        "potentialIP": "192.168.1.84",
        "location": "Shed",
    },
]

cameras = os.path.join(os.path.split(os.path.realpath(__file__))[0], "test_video.mp4")

latestLog = {
    "Dining room - French door": None,
    "Living room - French door": None,
    "Back door": None,
    "Front door": None,
}

logbase = {"name": None, "time": None, "status": None, "temp": None}
latestLogbase = [
    {"location": "House", "logs": []},
    {"location": "Stables", "logs": []},
    {"location": "Shed", "logs": []},
    {"location": "Garage", "logs": []},
]

baseObj = {}

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
    global playing, armed, latestLog, baseObj
    print("started work")
    while True:
        try:
            t1 = time.time()
            res = requests.get(addr, timeout=1)
            t2 = time.time()
            # print(f"request for {sensorDict['name']} took {t2 - t1} seconds")
            resJson = json.loads(res.content)
            # print(f"{sensorDict['name']}: {resJson}")
            name = sensorDict["name"].split("] ")[1]
            loc = sensorDict["location"]
            dateTime = pd.to_datetime("now")
            status = resJson["door_state"]
            temp = resJson["temperature"]
            log = {"time": dateTime, "status": status, "temp": temp}
            if loc not in baseObj.keys():
                baseObj[loc] = {}
            baseObj[loc][name] = log
            t = threading.Thread(
                target=writeToFile, args=(resJson, sensorDict["name"] + ".csv")
            )
            t.start()
            if resJson["temperature"] > 45:
                continue
                # warn about potential fire?
            if resJson["door_state"] == "open" and armed and not playing:
                print("ALARM!!!")
                playing = True
                soundT = threading.Thread(target=alarm)
                soundT.start()
            # warn about potential intruder
            # time.sleep(sensorDict["delay"])
        except Exception as e:
            print(e)
            time.sleep(1)


def getStreams(cameras):
    print(os.path.join(os.path.split(os.path.realpath(__file__))[0], "test_video.mp4"))
    cap = cv2.VideoCapture(
        os.path.join(os.path.split(os.path.realpath(__file__))[0], "test_video.mp4")
    )  # cv2.VideoCapture('chaplin.mp4')
    return [cap]


def getImage(cap, results: List, i: int):
    if cap.isOpened() == False:
        print("Error opening video stream or file")

    # Read until video is completed
    if cap.isOpened():
        # Capture frame-by-frame
        ret, frame = cap.read()
        if ret == True:
            results[i] = frame
        elif ret == False:
            raise Exception("no more frames")


def processImages(images: List[np.ndarray]):
    results = model.predict(
        source=images, classes=[0, 1, 3, 4, 5, 18], conf=0.4, device="cuda:0"
    )
    return results


def main():
    for sensor in sensors:
        ip = None
        # ip = network_functions.find_ip_by_mac(sensor["mac"])
        print(f'found ip of {sensor["name"]}: {ip}')
        if ip is None:
            print(f'could not find ip of {sensor["name"]}, falling back to potentialIP')
            ip = sensor["potentialIP"]
        addr = f"http://{ip}/"
        t = threading.Thread(target=sensorWork, args=(addr, sensor))
        t.start()
    results = model.predict(
        source=cameras,
        stream=True,
        classes=[0, 1, 3, 4, 5, 18],
        conf=0.4,
        device="cuda:0",
    )
    for result in results:
        f = result.plot()
        cv2.imshow("img", f)
        cv2.waitKey(1)
        print(result.probs)
    cv2.destroyAllWindows()
    # caps = getStreams(cameras)
    # while True:
    # results = [None] * len(caps)
    # threads = []
    # for i, cap in enumerate(caps):
    #     t = threading.Thread(target=getImage, args=(cap, results, i))
    #     t.start()
    #     threads.append(t)
    # for t in threads:
    # #     t.join()
    # results = model(
    #     os.path.join(
    #         os.path.split(os.path.realpath(__file__))[0], "test_video.mp4"
    #     ),
    #     stream=True,
    # )
    # results = model.predict(
    #     source=os.path.join(
    #         os.path.split(os.path.realpath(__file__))[0], "test_video.mp4"
    #     ),
    #     stream=True,
    #     classes=[0, 1, 3, 4, 5, 18],
    #     conf=0.4,
    #     device="cuda:0",
    # )
    # for result in results:
    #     f = result.plot()
    #     cv2.imshow("img", f)
    #     cv2.waitKey(1)
    #     print(result.probs)
    # cv2.destroyAllWindows()
    # break


app = Flask(__name__)
sock = Sock(app)
CORS(app)


@app.route("/arm", methods=["GET"])
def arm():
    global armed
    armed = True
    return jsonify({"armed": armed})


@app.route("/disarm", methods=["GET"])
def disarm():
    global armed
    armed = False
    return jsonify({"armed": armed})


@app.route("/status", methods=["GET"])
def status():
    return jsonify({"status": armed})


@app.route("/logs", methods=["GET"])
def logs():
    return jsonify(baseObj)


@app.route("/on", methods=["GET"])
def turnOn():
    for alarm in alarms:
        ip = alarm["potentialIP"]
        ret = 0
        while ret == 0:
            res = r.get(f"http://{ip}" + "/alarm/on")
            retu = res.json()
            print(retu)
            ret = retu["state"]
    return jsonify(True)


@app.route("/off", methods=["GET"])
def turnOff():
    for alarm in alarms:
        ip = alarm["potentialIP"]
        ret = 1
        while ret == 1:
            res = r.get(f"http://{ip}" + "/alarm/off")
            try:
                retu = res.json()
                print(retu)
                ret = retu["state"]
            except Exception as e:
                print(e)

    return jsonify(False)


@sock.route("/echo")
def echo(sock):
    while True:
        js = json.dumps(baseObj, indent=4, sort_keys=True, default=str)
        sock.send(js)


def run_flask():
    app.run(host="0.0.0.0", port=5000)


if __name__ == "__main__":
    flask_thread = threading.Thread(target=run_flask)
    flask_thread.daemon = True
    flask_thread.start()
    main()

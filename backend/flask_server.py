# import time
# from flask import Flask, jsonify
# from alarm_funcs import turnOffAlarms, turnOnAlarms
# from sensor_funcs import writeToFile
# from devices import sensors, cameras
# import pandas as pd
# import requests

# # import network_functions
# import json
# import threading
# from flask_cors import CORS
# from flask_sock import Sock

# latestLog = {
#     "Dining room - French door": None,
#     "Living room - French door": None,
#     "Back door": None,
#     "Front door": None,
# }

# logbase = {"name": None, "time": None, "status": None, "temp": None}
# latestLogbase = [
#     {"location": "House", "logs": []},
#     {"location": "Stables", "logs": []},
#     {"location": "Shed", "logs": []},
#     {"location": "Garage", "logs": []},
# ]

# baseObj = {}


# armed = False
# alarm = False


# def sensorWork(addr: str, sensorDict: dict):
#     global armed, latestLog, baseObj, alarm
#     print("started work")
#     while True:
#         try:
#             t1 = time.time()
#             res = requests.get(addr, timeout=1)
#             t2 = time.time()
#             # print(f"request for {sensorDict['name']} took {t2 - t1} seconds")
#             resJson = json.loads(res.content)
#             # print(f"{sensorDict['name']}: {resJson}")
#             #resJson = {"door_state": "open", "temperature": 40}
#             name = sensorDict["name"].split("] ")[1]
#             loc = sensorDict["location"]
#             dateTime = pd.to_datetime("now")
#             status = resJson["door_state"]
#             temp = resJson["temperature"]
#             log = {"time": dateTime, "status": status, "temp": temp}
#             if loc not in baseObj.keys():
#                 baseObj[loc] = {}
#             baseObj[loc][name] = log
#             # t = threading.Thread(
#             #     target=writeToFile, args=(resJson, sensorDict["name"] + ".csv")
#             # )
#             # t.start()
#             if resJson["temperature"] > 50:
#                 continue
#                 # warn about potential fire?
#             if resJson["door_state"] == "open" and armed and not alarm:
#                 alarm = True
#                 print(name, 'is open')
#                 turnOnAlarms()
#             # warn about potential intruder
#             # time.sleep(sensorDict["delay"])
#         except Exception as e:
#             print(e)
#             time.sleep(0.5)


# app = Flask(__name__)
# sock = Sock(app)
# CORS(app)


# @app.route("/arm", methods=["GET"])
# def arm():
#     global armed, alarm
#     armed = True
#     if alarm == True:
#         alarm = False
#     return jsonify({"success": True})


# @app.route("/disarm", methods=["GET"])
# def disarm():
#     global armed, alarm
#     armed = False
#     turnOffAlarms()
#     alarm = False
#     print("turned off alarms")
#     return jsonify({"success": True})


# @app.route("/test", methods=["GET"])
# def test():
#     global alarm
#     print("testing")
#     turnOnAlarms()
#     alarm = True
#     time.sleep(1)
#     turnOffAlarms()
#     alarm = False
#     return jsonify({"success": True})


# @app.route("/logs", methods=["GET"])
# def getLogs():
#     global baseObj, armed, alarm
#     tosend = {'armed': armed, 'alarm': alarm, 'logs': baseObj}
#     return jsonify(tosend)


# # return everything here including status
# # {
# #   armed: false,
# #   alarm: false,
# #   logs: {
# #     House: {
# #       'Back door': {
# #         status: 'closed',
# #         temp: 28.44887,
# #         time: 'Wed, 22 May 2024 00:08:59 GMT',
# #       },
# #       'Dining room - French door': {
# #         status: 'closed',
# #         temp: 28.91698,
# #         time: 'Wed, 22 May 2024 00:08:59 GMT',
# #       },
# #       'Front door': {
# #         status: 'closed',
# #         temp: 28.91698,
# #         time: 'Wed, 22 May 2024 00:08:59 GMT',
# #       },
# #       'Living room - French door': {
# #         status: 'closed',
# #         temp: 31.72584,
# #         time: 'Wed, 22 May 2024 00:08:59 GMT',
# #       },
# #     },
# #   },
# # }
# # @sock.route("/logs")
# # def echo(sock):
# #     global baseObj, armed, alarm
# #     while True:
# #         tosend = {'armed': armed, 'alarm': alarm, 'logs': baseObj}
# #         js = json.dumps(tosend, indent=4, sort_keys=True, default=str)
# #         sock.send(js)


# def run_flask():
#     app.run(host="0.0.0.0", port=5000)


# if __name__ == "__main__":
#     flask_thread = threading.Thread(target=run_flask)
#     flask_thread.daemon = True
#     flask_thread.start()
#     for sensor in sensors:
#         ip = None
#         # ip = network_functions.find_ip_by_mac(sensor["mac"])
#         print(f'found ip of {sensor["name"]}: {ip}')
#         if ip is None:
#             print(f'could not find ip of {sensor["name"]}, falling back to potentialIP')
#             ip = sensor["potentialIP"]
#         addr = f"http://{ip}/"
#         t = threading.Thread(target=sensorWork, args=(addr, sensor))
#         t.start()
#     for camera in cameras:
#         print("camera")
#     # results = model.predict(
#     #     source=cameras,
#     #     stream=True,
#     #     classes=[0, 1, 3, 4, 5, 18],
#     #     conf=0.4,
#     #     device="cuda:0",
#     # )
#     # for result in results:
#     #     f = result.plot()
#     #     cv2.imshow("img", f)
#     #     cv2.waitKey(1)
#     #     print(result.probs)
#     # cv2.destroyAllWindows()

from datetime import timedelta
import time
from flask import Flask
from alarm_funcs import turnOffAlarms, turnOnAlarms
from sensor_funcs import writeToFile
from devices import sensors, cameras
import pandas as pd
import requests
import json
import hashlib
from flask_socketio import SocketIO, emit

# example = {
#   'armed': False,
#   'alarm': False,
#   'logs': {
#     'House': {
#       'Back door': {
#         'status': 'closed',
#       },
#       'Dining room - French door': {
#         'status': 'closed',
#       },
#       'Front door': {
#         'status': 'closed',
#       },
#       'Living room - French door': {
#         'status': 'closed',
#       },
#     },
#   },
#   'issues': [{'msg': 'test', 'time': pd.to_datetime('now')}],
# }

latestLogTiming = {}
baseObj = {
    "House": {
        "Front door": {
            "status": "unknown",
            "armed": False,
        },
        "Dining room": {
            "status": "unknown",
            "armed": False,
        },
        "Living room": {
            "status": "unknown",
            "armed": False,
        },
        "Back door": {
            "status": "unknown",
            "armed": False,
        },
    },
    "Shed": {
        "Front door": {
            "status": "unknown",
            "armed": False,
        }
    },
    "Stables": {
        "Front door": {
            "status": "unknown",
            "armed": False,
        },
        "Back door": {
            "status": "unknown",
            "armed": False,
        },
    },
    "Garage": {
        "Front door": {
            "status": "unknown",
            "armed": False,
        },
    },
}
issues = []
alarm = False
sent = None


def hash_data(data):
    """Hash the given data for efficient comparison."""
    return hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()


def create_app():
    app = Flask(__name__)
    socketio = SocketIO(
        app, cors_allowed_origins="*", logger=True, async_mode="threading"
    )

    @socketio.on("arm/building")
    def arm(ev):
        global alarm, baseObj
        building = ev
        for door in baseObj[building].keys():
            baseObj[building][door]["armed"] = True
        return {"success": True}

    @socketio.on("disarm/building")
    def disarm(ev):
        global alarm, baseObj
        building = ev
        turnOffAlarms()
        alarm = False
        print("turned off alarms")
        for door in baseObj[building].keys():
            baseObj[building][door]["armed"] = False
        return {"success": True}

    @socketio.on("test")
    def test(ev):
        global alarm
        print("testing")
        turnOnAlarms()
        alarm = True
        time.sleep(1)
        turnOffAlarms()
        alarm = False
        return {"success": True}

    @socketio.on("dismiss")
    def dismiss(ev):
        global issues
        evDismiss = ev
        issues = list(filter(lambda x: x["id"] != evDismiss, issues))
        return {"success": True}

    # @app.route("/log", methods=["GET"])
    # def getLogs():
    #     global baseObj, armed, alarm
    #     tosend = {
    #         "armed": armed,
    #         "alarm": alarm,
    #         "logs": baseObj,
    #         # "issues": issues,
    #     }
    #     return jsonify(tosend)

    @socketio.on("connect")
    def test_connect(auth):
        global baseObj, alarm
        tosend = {
            "alarm": alarm,
            "logs": baseObj,
            "issues": issues,
        }
        emit("data", tosend)

    @socketio.on("disconnect")
    def test_disconnect():
        print("Client disconnected")

    return app, socketio


# Update last sent data for this client


# def sensorWork(addr: str, sensorDict: dict):
def sensorWork(args):
    global baseObj, alarm, latestLogTiming, issues
    addr = args[0]
    sensorDict = args[1]
    print("started work for", addr)
    while True:
        try:
            res = requests.get(addr, timeout=1)
            resJson = res.json()
            name = sensorDict["name"].split("] ")[1]
            loc = sensorDict["location"]
            latestLogTiming[f"{loc}_{name}"] = pd.to_datetime("now")
            status = resJson["door_state"]
            log = {"status": status, "temp": resJson["temperature"]}
            # print(name, status)
            if loc not in baseObj.keys():
                baseObj[loc] = {}
                baseObj[loc][name] = {
                    "status": status,
                    "armed": False,
                }
            else:
                baseObj[loc][name]["status"] = status
            id_exists = any(d["id"] == f"response_{name}_{loc}" for d in issues)
            if id_exists:
                issues = list(
                    filter(lambda x: x["id"] != f"response_{name}_{loc}", issues)
                )
            #hotID_exists = any(d["id"] == f"hot_{name}_{loc}" for d in issues)
            if resJson["temperature"] > 50:
                issues.append(
                    {
                        "msg": f"sensor by the {name} at {loc} is running a bit hot (>50C) please check it",
                        "time": pd.to_datetime("now"),
                        "id": f"hot_{name}_{loc}",
                    }
                )
            # elif hotID_exists:
            #     issues = list(filter(lambda x: x["id"] != f"hot_{name}_{loc}", issues))
            alarmID_exists = any(d["id"] == f"alarm_{name}_{loc}" for d in issues)
            if (
                resJson["door_state"] == "open"
                and baseObj[loc][name]["armed"]
                and not alarm
            ):
                print(f"{name} at {loc} is open")
                turnOnAlarms()
                alarm = True
                issues.append(
                    {
                        "msg": f"alarm triggered by {name} at {loc}",
                        "time": pd.to_datetime("now"),
                        "id": f"alarm_{name}_{loc}",
                    }
                )
            elif alarmID_exists:
                alarm_obj = next(
                    filter(lambda x: x["id"] == f"alarm_{name}_{loc}", issues)
                )
                if (
                    pd.to_datetime("now") - alarm_obj["time"] > pd.Timedelta(seconds=30)
                    and alarm
                    and not resJson["door_state"] == "open"
                ):
                    turnOffAlarms()
                    alarm = False
                    issues.append(
                        {
                            "msg": f"alarm autmatically turned off after 30 seconds since {name} at {loc} was closed",
                            "time": pd.to_datetime("now"),
                            "id": f"cleared_{name}_{loc}",
                        }
                    )
            # write to file here
            time.sleep(sensorDict["delay"])
        except Exception as e:
            name = sensorDict["name"].split("] ")[1]
            loc = sensorDict["location"]
            if latestLogTiming[f"{loc}_{name}"] < pd.to_datetime("now") - pd.Timedelta(
                seconds=30
            ):
                id_exists = any(d["id"] == f"response_{name}_{loc}" for d in issues)
                if not id_exists:
                    issues.append(
                        {
                            "msg": f"no response from {name} at {loc} for a while please contact dimitri",
                            "time": pd.to_datetime("now"),
                            "id": f"response_{name}_{loc}",
                        }
                    )
            print(f"got the following for {name}: {e}")
            time.sleep(0.5)


def start_sensor_threads():
    for sensor in sensors:
        ip = sensor.get("potentialIP")
        addr = f"http://{ip}/"
        t = socketio.start_background_task(target=sensorWork, args=(addr, sensor))


def check_for_new_logs(args):
    global baseObj, alarm, sent
    while True:
        tosend = {
            "alarm": alarm,
            "logs": baseObj,
            "issues": issues,
        }
        hash = hash_data(tosend)
        if hash != sent:
            socketio.emit("data", tosend)
            sent = hash


if __name__ == "__main__":
    app, socketio = create_app()
    start_sensor_threads()
    mainT = socketio.start_background_task(target=check_for_new_logs, args=())
    socketio.run(app, host="0.0.0.0", port=5000)

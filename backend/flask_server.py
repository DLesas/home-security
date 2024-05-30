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
from flask import Flask, jsonify
from alarm_funcs import turnOffAlarms, turnOnAlarms
from sensor_funcs import writeToFile
from devices import sensors, cameras
import pandas as pd
import requests
import json
import threading
import hashlib
from flask_cors import CORS
from flask_sock import Sock
import gevent
from gevent.lock import BoundedSemaphore

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
baseObj = {}
armed = False
alarm = False
last_sent_data_per_client = {}
semaphore = BoundedSemaphore(1)


def hash_data(data):
    """Hash the given data for efficient comparison."""
    return hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()


def handle_client(ws):
    global baseObj, armed, alarm, last_sent_data_per_client
    client_id = ws.environ.get("REMOTE_ADDR", None)  # Get client identifier
    if not client_id:
        return

    if client_id not in last_sent_data_per_client:
        last_sent_data_per_client[client_id] = None  # Initialize for new client

    try:
        while True:
            current_data = {
                "armed": armed,
                "alarm": alarm,
                "logs": baseObj,
                # "issues": issues,  # Uncomment and add issues if needed
            }
            current_data_hash = hash_data(current_data)
            last_sent_data_hash = last_sent_data_per_client[client_id]

            # Compare current data hash with last sent data hash for this client
            if current_data_hash != last_sent_data_hash:
                newJSON = json.dumps(
                    {"alarm": alarm, "armed": armed},
                    indent=4,
                    sort_keys=True,
                    default=str,
                )
                semaphore.acquire()
                print(newJSON)  # Ensure only one thread sends at a time
                ws.send(newJSON)
                semaphore.release()
                last_sent_data_per_client[client_id] = current_data_hash
    except gevent.socket.error as e:
        print(f"WebSocket error: {e}")
    finally:
        if client_id in last_sent_data_per_client:
            del last_sent_data_per_client[client_id]


def create_app():
    app = Flask(__name__)
    sock = Sock(app)
    CORS(app)

    @app.route("/arm", methods=["GET"])
    def arm():
        global armed, alarm
        armed = True
        if alarm:
            alarm = False
        return jsonify({"success": True})

    @app.route("/disarm", methods=["GET"])
    def disarm():
        global armed, alarm
        armed = False
        turnOffAlarms()
        alarm = False
        print("turned off alarms")
        return jsonify({"success": True})

    @app.route("/test", methods=["GET"])
    def test():
        global alarm
        print("testing")
        turnOnAlarms()
        alarm = True
        time.sleep(1)
        turnOffAlarms()
        alarm = False
        return jsonify({"success": True})

    @app.route("/log", methods=["GET"])
    def getLogs():
        global baseObj, armed, alarm, last_sent_data_per_client
        tosend = {
            "armed": armed,
            "alarm": alarm,
            "logs": baseObj,
            # "issues": issues,
        }
        return jsonify(tosend)

    @sock.route("/wslogs")
    def echo(ws):
        gevent.spawn(handle_client, ws)

    return app


# Update last sent data for this client


def sensorWork(addr: str, sensorDict: dict):
    global armed, baseObj, alarm, latestLogTiming
    print("started work for", addr)
    while True:
        try:
            res = requests.get(addr, timeout=1)
            resJson = res.json()
            name = sensorDict["name"].split("] ")[1]
            loc = sensorDict["location"]
            latestLogTiming[name] = pd.to_datetime("now")
            status = resJson["door_state"]
            log = {"status": status}
            print(name, status)
            if loc not in baseObj.keys():
                baseObj[loc] = {}
            baseObj[loc][name] = log
            if resJson["temperature"] > 50:
                continue
            if resJson["door_state"] == "open" and armed and not alarm:
                alarm = True
                print(name, "is open")
                turnOnAlarms()
            time.sleep(sensorDict["delay"])
        except Exception as e:
            name = sensorDict["name"].split("] ")[1]
            print(f"got the following for {name}: {e}")
            time.sleep(0.5)


def start_sensor_threads():
    for sensor in sensors:
        ip = sensor.get("potentialIP")
        addr = f"http://{ip}/"
        t = threading.Thread(target=sensorWork, args=(addr, sensor))
        t.start()


if __name__ == "__main__":
    app = create_app()
    threading.Thread(target=app.run, kwargs={"host": "0.0.0.0", "port": 5000}).start()
    start_sensor_threads()

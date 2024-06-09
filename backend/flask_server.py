import time
import logging
from datetime import timedelta
from flask import Flask, jsonify
from flask_socketio import SocketIO, emit
import pandas as pd
import requests
import json
import hashlib
from alarm_funcs import turnOffAlarms, turnOnAlarms
from devices import sensors
from sensor_funcs import writeToFile

VAPID_PUBLIC="BGaYMfU2J2yBlWchiwx_W4Jn6b-TwJisl8C-6z23y5qFSN_E2riZKjdbBhZs08PgfGYZeewCICCinGG4bscvzU4"
VAPID_PRIVATE="WGibkvRHns3AH3qIfGHCpWOgVmFtb2jUFOlUBn5JnVc"
VAPID_CLAIMS = {"sub": "mailto:dlesas@hotmail.com"}

subscriptions = []

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

latest_log_timing = {}
issues = []
alarm = False
sent = None

# Initial sensor states
base_obj = {
    "House": {
        "Front door": {"status": "unknown", "armed": False},
        "Dining room": {"status": "unknown", "armed": False},
        "Living room": {"status": "unknown", "armed": False},
        "Back door": {"status": "unknown", "armed": False},
    },
    "Shed": {"Front door": {"status": "unknown", "armed": False}},
    "Stables": {
        "Front door": {"status": "unknown", "armed": False},
        "Back door": {"status": "unknown", "armed": False},
    },
    "Garage": {
        "Front door": {"status": "unknown", "armed": False},
    },
}


def hash_data(data):
    """Hash the given data for efficient comparison."""
    return hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()


def create_app():
    """Create and configure the Flask application."""
    app = Flask(__name__)
    socketio = SocketIO(
        app, cors_allowed_origins="*", logger=True, async_mode="threading"
    )

    @socketio.on("arm/building")
    def arm_building(ev):
        """Arm all sensors in the specified building."""
        global base_obj
        building = ev
        for door in base_obj[building].keys():
            base_obj[building][door]["armed"] = True
        return {"success": True}

    @socketio.on("disarm/building")
    def disarm_building(ev):
        """Disarm all sensors in the specified building and turn off alarms."""
        global base_obj, alarm
        building = ev
        turnOffAlarms()
        alarm = False
        logger.info("Turned off alarms")
        for door in base_obj[building].keys():
            base_obj[building][door]["armed"] = False
        return {"success": True}

    @socketio.on("test")
    def test_alarm(ev):
        """Test the alarm by turning it on and off after a short delay."""
        global alarm
        logger.info("Testing alarm")
        turnOnAlarms()
        alarm = True
        time.sleep(1)
        turnOffAlarms()
        alarm = False
        return {"success": True}
    
    @socketio.on("subscribe")
    def subscribe(ev):
        subscription = ev
        subscriptions.append(subscription)
        return {"success": True}

    @socketio.on("dismiss")
    def dismiss_issue(ev):
        """Dismiss a specific issue."""
        global issues
        ev_dismiss = ev
        issues = list(filter(lambda x: x["id"] != ev_dismiss, issues))
        return {"success": True}

    @socketio.on("connect")
    def handle_connect(auth):
        """Handle client connection."""
        global base_obj, alarm
        to_send = {
            "alarm": alarm,
            "logs": base_obj,
            "issues": issues,
        }
        emit("data", to_send)

    @socketio.on("disconnect")
    def handle_disconnect():
        """Handle client disconnection."""
        logger.info("Client disconnected")

    return app, socketio


def sensor_work(args):
    """Monitor, action and log data from sensors."""
    global base_obj, alarm, latest_log_timing, issues
    addr, sensor_dict = args
    logger.info(f"Started work for {addr}")
    while True:
        try:
            res = requests.get(addr, timeout=1)
            res_json = res.json()
            name = sensor_dict["name"].split("] ")[1]
            loc = sensor_dict["location"]
            latest_log_timing[f"{loc}_{name}"] = pd.to_datetime("now")
            status = res_json["door_state"]
            log = {"status": status, "temp": res_json["temperature"]}
            if loc not in base_obj:
                base_obj[loc] = {}
            base_obj[loc][name] = base_obj[loc].get(
                name, {"status": status, "armed": False}
            )
            base_obj[loc][name]["status"] = status
            # writeToFile(log, name)
            handle_issues(res_json, name, loc)
            time.sleep(sensor_dict["delay"])
        except Exception as e:
            handle_exception(e, sensor_dict)


def handle_issues(res_json, name, loc):
    """Handle potential issues with the sensors and trigger alarm if needed."""
    global issues, alarm

    id_exists = any(d["id"] == f"response_{name}_{loc}" for d in issues)
    if id_exists:
        issues = list(filter(lambda x: x["id"] != f"response_{name}_{loc}", issues))

    if res_json["temperature"] > 50:
        issues.append(
            {
                "msg": f"Sensor by the {name} at {loc} is running hot (>50C), please check it",
                "time": pd.to_datetime("now").strftime("%d-%m-%Y %H:%M:%S"),
                "id": f"hot_{name}_{loc}",
            }
        )

    alarm_id_exists = any(d["id"] == f"alarm_{name}_{loc}" for d in issues)
    if res_json["door_state"] == "open" and base_obj[loc][name]["armed"] and not alarm:
        logger.info(f"{name} at {loc} is open")
        turnOnAlarms()
        alarm = True
        issues.append(
            {
                "msg": f"Alarm triggered by {name} at {loc}",
                "time": pd.to_datetime("now").strftime("%d-%m-%Y %H:%M:%S"),
                "id": f"alarm_{name}_{loc}",
            }
        )
    elif alarm_id_exists:
        alarm_obj = next(filter(lambda x: x["id"] == f"alarm_{name}_{loc}", issues))
        if (
            pd.to_datetime("now") - pd.to_datetime(alarm_obj["time"])
            > timedelta(seconds=30)
            and alarm
            and res_json["door_state"] != "open"
        ):
            turnOffAlarms()
            alarm = False
            issues.append(
                {
                    "msg": f"Alarm automatically turned off after 30 seconds since {name} at {loc} was closed",
                    "time": pd.to_datetime("now").strftime("%d-%m-%Y %H:%M:%S"),
                    "id": f"cleared_{name}_{loc}",
                }
            )


def handle_exception(e, sensor_dict):
    """Handle exceptions that occur during sensor work."""
    global issues, latest_log_timing
    name = sensor_dict["name"].split("] ")[1]
    loc = sensor_dict["location"]
    if f"{loc}_{name}" not in latest_log_timing:
        latest_log_timing[f"{loc}_{name}"] = pd.to_datetime("now") - timedelta(
            seconds=30
        )
    if latest_log_timing[f"{loc}_{name}"] < pd.to_datetime("now") - timedelta(
        seconds=30
    ):
        id_exists = any(d["id"] == f"response_{name}_{loc}" for d in issues)
        if not id_exists:
            issues.append(
                {
                    "msg": f"No response from {name} at {loc} for a while, please contact Dimitri",
                    "time": pd.to_datetime("now").strftime("%d-%m-%Y %H:%M:%S"),
                    "id": f"response_{name}_{loc}",
                }
            )
    logger.error(f"Got the following for {name} at {loc}: {e}")
    time.sleep(0.5)


def start_sensor_threads(socketio):
    """Start background tasks for each sensor."""
    for sensor in sensors:
        ip = sensor.get("potentialIP")
        addr = f"http://{ip}/"
        socketio.start_background_task(target=sensor_work, args=(addr, sensor))


def check_for_new_logs():
    """Check for new logs and emit data if there are updates."""
    global base_obj, alarm, sent
    while True:
        to_send = {
            "alarm": alarm,
            "logs": base_obj,
            "issues": issues,
        }
        hash = hash_data(to_send)
        if hash != sent:
            socketio.emit("data", to_send)
            sent = hash


if __name__ == "__main__":
    app, socketio = create_app()
    start_sensor_threads(socketio)
    socketio.start_background_task(target=check_for_new_logs)
    socketio.run(app, host="0.0.0.0", port=5000)

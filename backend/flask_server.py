import time
import logging
from datetime import timedelta
from flask import Flask
from flask_socketio import SocketIO, emit
import pandas as pd
import requests
import json
import hashlib
from alarm_funcs import (
    send_SMS,
    turnOffAlarmsUseCase,
    turnOnAlarmsUseCase,
    send_mail,
)
from devices import sensors
from logging_funcs import (
    writeSensorToDB,
    writeIssueToDB,
    readIssueFile,
    readSensorFile,
    initialiseDB,
)

# from pywebpush import webpush, WebPushException

import queue
import pythoncom

# Call CoInitialize to initialize COM
email_queue = queue.Queue()


VAPID_PUBLIC = "BGaYMfU2J2yBlWchiwx_W4Jn6b-TwJisl8C-6z23y5qFSN_E2riZKjdbBhZs08PgfGYZeewCICCinGG4bscvzU4"
VAPID_PRIVATE = "WGibkvRHns3AH3qIfGHCpWOgVmFtb2jUFOlUBn5JnVc"
VAPID_CLAIMS = {"sub": "mailto:***REMOVED_EMAIL***"}

subscriptions = []

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

latest_log_timing = {}
issues = []
alarm = False
sent = None
timeWithoutStatusRaiseIssueInS = 10

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


def send_email_thread():
    pythoncom.CoInitialize()  # Initialize COM library for the thread
    try:
        while True:
            email_content = email_queue.get()
            if email_content:
                send_mail(email_content["body"], email_content["subject"])
            email_queue.task_done()
    finally:
        pythoncom.CoUninitialize()


def hash_data(data):
    """Hash the given data for efficient comparison."""
    return hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()


def raise_issue(
    title: str,
    body: str,
    datetime: str,
    id: str,
    severity: str,
    delayTillNextInSeconds: int,
):
    global subscriptions, VAPID_PRIVATE, issues
    df = readIssueFile(pd.to_datetime("now"))
    triggeredNotification = False
    if df is not None:
        df["date"] = pd.to_datetime(df["date"])
        df["TriggeredNotification"] = df["TriggeredNotification"].astype(bool)
        df = df.loc[(df["id"] == id) & (df["TriggeredNotification"] == True)]
        df = df.sort_values(by="date", ascending=False)
        if df.shape[0] > 0:
            relevantIssue = df.iloc[0]
            nextNotif = relevantIssue["date"] + timedelta(
                seconds=relevantIssue["delayTillNextInSeconds"]
            )
            allowNotif = pd.to_datetime("now") > nextNotif
        else:
            allowNotif = True
    else:
        allowNotif = True
    if severity == "critical" and allowNotif:
        send_SMS(body)
        triggeredNotification = True
    if (severity == "warning" or severity == "critical") and allowNotif:
        email_queue.put({"body": body, "subject": title})
        triggeredNotification = True
    issues.append(
        {
            "msg": body,
            "time": datetime,
            "id": id,
        }
    )
    writeIssueToDB(
        {
            "title": title,
            "body": body,
            "severity": severity,
            "name": id,
            "delayTillNextInSeconds": delayTillNextInSeconds,
            "TriggeredNotification": triggeredNotification,
        }
    )
    # for subscription in subscriptions:
    #     for i in range(20):
    #         print("raising")
    #     try:
    #         webpush(
    #             subscription_info=subscription,
    #             data=json.dumps({"title": title, "body": body}),
    #             vapid_private_key=VAPID_PRIVATE,
    #             vapid_claims=VAPID_CLAIMS,
    #         )
    #     except WebPushException as ex:
    #         print("I'm sorry, Dave, but I can't do that: {}", repr(ex))
    #         if ex.response and ex.response.json():
    #             extra = ex.response.json()
    #             print(
    #                 "Remote service replied with a {}:{}, {}",
    #                 extra.code,
    #                 extra.errno,
    #                 extra.message,
    #             )


def create_app():
    """Create and configure the Flask application."""
    app = Flask(__name__)
    socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")

    @app.route("/nextjs/build")
    def nextjs_build():
        pass
        #

    @app.route("/logs/<name>/<date>")
    def get_logs(name, date):
        df = readSensorFile(name, pd.to_datetime(date, infer_datetime_format=True))
        return df.to_json(orient="records")

    @app.route("/issues/<date>")
    def get_issues(date):
        df = readIssueFile(pd.to_datetime(date, infer_datetime_format=True))
        return df.to_json(orient="records")

    @socketio.on("arm/building")
    def arm_building(ev):
        """Arm all sensors in the specified building."""
        global base_obj
        print(f"arming {ev}")
        building = ev
        for door in base_obj[building].keys():
            base_obj[building][door]["armed"] = True
        return {"success": True}

    @socketio.on("disarm/building")
    def disarm_building(ev):
        """Disarm all sensors in the specified building and turn off alarms."""
        global base_obj, alarm
        building = ev
        if alarm:
            for building in base_obj.keys():
                for door in base_obj[building].keys():
                    base_obj[building][door]["armed"] = False
        else:
            for door in base_obj[building].keys():
                base_obj[building][door]["armed"] = False
        turnOffAlarmsUseCase()
        alarm = False
        logger.info("Turned off alarms")
        return {"success": True}

    @socketio.on("test")
    def test_alarm(ev):
        """Test the alarm by turning it on and off after a short delay."""
        global alarm
        logger.info("Testing alarm")
        turnOnAlarmsUseCase()
        alarm = True
        time.sleep(1)
        turnOffAlarmsUseCase()
        alarm = False
        return {"success": True}

    @socketio.on("subscribe")
    def subscribe(ev):
        global subscriptions
        subscription = ev
        subscriptions.append(subscription)
        print(subscriptions)
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
            log = {"status": status, "temp": res_json["temperature"], "door": name}
            if loc not in base_obj:
                base_obj[loc] = {}
            base_obj[loc][name] = base_obj[loc].get(
                name, {"status": status, "armed": False}
            )
            base_obj[loc][name]["status"] = status
            writeSensorToDB(log, loc)
            handle_issues(res_json, name, loc)
            time.sleep(sensor_dict["delay"])
        except Exception as e:
            timeOfIssue = pd.to_datetime("now").strftime("%d-%m-%Y %H:%M:%S")
            name = sensor_dict["name"].split("] ")[1]
            loc = sensor_dict["location"]
            handle_exception(e, sensor_dict)
            base_obj[loc][name]["status"] = "unknown"
            print(f"{timeOfIssue}: issue for {name} at {loc}: {e}")


def handle_issues(res_json, name, loc):
    """Handle potential issues with the sensors and trigger alarm if needed."""
    global issues, alarm

    id_exists = any(d["id"] == f"response_{name}_{loc}" for d in issues)
    if id_exists:
        issues = list(filter(lambda x: x["id"] != f"response_{name}_{loc}", issues))
        writeIssueToDB(
            {
                "title": "Connection to Sensor restored",
                "body": f"Connection to {name} at {loc} restored",
                "severity": "debug",
                "name": f"!response_{name}_{loc}",
                "delayTillNextInSeconds": 0,
                "TriggeredNotification": False,
            }
        )
    if res_json["temperature"] > 75:
        raise_issue(
            "Sensor running very hot"
            f"Sensor by the {name} at {loc} is running very hot ({int(res_json["temperature"])}C), please check it. These devices are rated to work between -20C and 80C. This was detected at {pd.to_datetime("now").strftime("%d-%m-%Y %H:%M:%S")}.",
            pd.to_datetime("now").strftime("%d-%m-%Y %H:%M:%S"),
            f"75_{name}_{loc}",
            severity="critical",
            delayTillNextInSeconds=(60 * 10),
        )
    elif res_json["temperature"] > 60:
        raise_issue(
            "Sensor running hot",
            f"Sensor by the {name} at {loc} is running hot ({int(res_json["temperature"])}C), please check it. These devices are rated to work between -20C and 80C. This was detected at {pd.to_datetime("now").strftime("%d-%m-%Y %H:%M:%S")}.",
            pd.to_datetime("now").strftime("%d-%m-%Y %H:%M:%S"),
            f"65_{name}_{loc}",
            severity="warning",
            delayTillNextInSeconds=(60 * 60),
        )
    alarm_id_exists = any(d["id"] == f"alarm_{name}_{loc}" for d in issues)
    if res_json["door_state"] == "open" and base_obj[loc][name]["armed"] and not alarm:
        logger.info(f"{name} at {loc} is open, alarm triggered!")
        turnOnAlarmsUseCase()
        alarm = True
        raise_issue(
            "Alarm triggered!",
            f"Alarm triggered by {name} at {loc} at {pd.to_datetime('now').strftime('%d-%m-%Y %H:%M:%S')}",
            pd.to_datetime("now").strftime("%d-%m-%Y %H:%M:%S"),
            f"alarm_{name}_{loc}",
            severity="critical",
            delayTillNextInSeconds=0,
        )
    elif alarm_id_exists:
        alarm_obj = next(filter(lambda x: x["id"] == f"alarm_{name}_{loc}", issues))
        if (
            pd.to_datetime("now") - pd.to_datetime(alarm_obj["time"])
            > timedelta(seconds=30)
            and alarm
            and res_json["door_state"] != "open"
        ):
            turnOffAlarmsUseCase()
            alarm = False
            raise_issue(
                "Alarm turned off automatically",
                f"Alarm automatically turned off after 30 seconds since {name} at {loc} was closed at {pd.to_datetime('now').strftime('%d-%m-%Y %H:%M:%S')}",
                pd.to_datetime("now").strftime("%d-%m-%Y %H:%M:%S"),
                f"cleared_{name}_{loc}",
                severity="info",
                delayTillNextInSeconds=0,
            )


def handle_exception(e, sensor_dict):
    """Handle exceptions that occur during sensor work."""
    global issues, latest_log_timing
    name = sensor_dict["name"].split("] ")[1]
    loc = sensor_dict["location"]
    if f"{loc}_{name}" not in latest_log_timing:
        latest_log_timing[f"{loc}_{name}"] = pd.to_datetime("now") - timedelta(
            seconds=timeWithoutStatusRaiseIssueInS
        )
    if latest_log_timing[f"{loc}_{name}"] < pd.to_datetime("now") - timedelta(
        seconds=timeWithoutStatusRaiseIssueInS
    ):
        id_exists = any(d["id"] == f"response_{name}_{loc}" for d in issues)
        if not id_exists:
            raise_issue(
                "Sensor having connectivity issues",
                f"No response from {name} at {loc} for a while, please contact Dimitri",
                pd.to_datetime("now").strftime("%d-%m-%Y %H:%M:%S"),
                f"response_{name}_{loc}",
                severity="debug",
                delayTillNextInSeconds=0,
            )
    # logger.error(f"Got the following for {name} at {loc}: {e}")


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
    initialiseDB()
    email_queue.queue.clear()
    app, socketio = create_app()
    start_sensor_threads(socketio)
    socketio.start_background_task(target=send_email_thread)
    socketio.start_background_task(target=check_for_new_logs)
    socketio.run(app, host="0.0.0.0", port=5000)

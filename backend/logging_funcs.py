import pandas as pd
import os
import datetime
from queue import Queue, Empty
import time

# import network_functions
fileDir = os.path.dirname(os.path.realpath(__file__))
logFolder = os.path.join(fileDir, "logs")
sensorFolder = os.path.join(logFolder, "sensors")
issuesFolder = os.path.join(logFolder, "issues")


issueQueue = Queue()
sensorQueue = Queue()
queue_flush_limit = 100


def writeIssuesToFile(data: pd.DataFrame):
    if not os.path.exists(issuesFolder):
        os.makedirs(issuesFolder)
        print("created sensor log path")
    date = pd.to_datetime("now").strftime("%d_%m_%Y")
    filename = os.path.join(issuesFolder, f"{date}.csv")
    if os.path.exists(filename):
        past = pd.read_feather(filename)
        df = pd.concat([past, data], ignore_index=True)
    else:
        df = data
    df.to_feather(filename)


def WriteSensorDataToFile(data: pd.DataFrame):
    if not os.path.exists(sensorFolder):
        os.makedirs(sensorFolder)
        print("created sensor log path")
    date = pd.to_datetime("now").strftime("%d_%m_%Y")
    filename = os.path.join(sensorFolder, f"{date}.csv")
    if os.path.exists(filename):
        past = pd.read_feather(filename)
        df = pd.concat([past, data], ignore_index=True)
    else:
        df = data
    df.to_feather(filename)


# Initialize batch writers
def flush_queue_to_file():
    queues = {sensorQueue: WriteSensorDataToFile, issueQueue: writeIssuesToFile}
    for queue, func in queues.items():
        records = []
        while not queue.qsize() == 0:
            try:
                records.append(queue.get_nowait())
            except Empty:
                break
        if records:
            func(pd.DataFrame(records, index=[i for i in range(len(records))]))


def queue_monitor():
    while True:
        for q in [issueQueue, sensorQueue]:
            if q.qsize() >= queue_flush_limit:
                flush_queue_to_file()
            time.sleep(5)


def SensorDataToQueue(data: dict, building: str):
    data["building"] = building
    data["date"] = pd.to_datetime("now")
    sensorQueue.put(data)


def IssueDataToQueue(data: dict):
    data["date"] = pd.to_datetime("now")
    issueQueue.put(data)


def readIssues(date: datetime) -> pd.DataFrame:
    filename = os.path.join(issuesFolder, f"{date.strftime("%d_%m_%Y")}.csv")
    if not os.path.exists(filename):
        df = pd.DataFrame(
            data=[],
            columns=[
                "title",
                "body",
                "severity",
                "name",
                "delayTillNextInSeconds",
                "TriggeredNotification",
                "date",
            ],
        )
    else:
        df = pd.read_feather(filename)
    return df


def readSensorLogs(date: datetime, building: str) -> pd.DataFrame:
    filename = os.path.join(issuesFolder, f"{date.strftime("%d_%m_%Y")}.csv")
    if not os.path.exists(filename):
        df = pd.DataFrame(
            data=[],
            columns=[
                "door",
                "building",
                "status",
                "temp",
                "date",
            ],
        )
    else:
        df = pd.read_feather(filename)
        df = df.loc[df["building"] == building]
    return df

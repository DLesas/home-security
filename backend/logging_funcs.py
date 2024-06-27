import pandas as pd
import os
import datetime

# import network_functions


fileDir = os.path.dirname(os.path.realpath(__file__))
logFolder = os.path.join(fileDir, "logs")
sensorFolder = os.path.join(logFolder, "sensors")
issuesFolder = os.path.join(logFolder, "issues")


def writeToFile(data: dict, name: str):

    if not os.path.exists(sensorFolder):
        os.makedirs(sensorFolder)
        print("created sensor log path")
    data["date"] = pd.to_datetime("now").strftime("%d-%m-%Y %H:%M:%S")
    date = pd.to_datetime("now").strftime("%d_%m_%Y")
    filename = os.path.join(sensorFolder, f'{date + "_" + name}.csv')
    df = pd.DataFrame(data, index=[0])
    df.to_csv(
        filename,
        mode="a",
        header=(not os.path.exists(filename)),
        index=False,
    )


def issuesToFile(data: dict):

    if not os.path.exists(issuesFolder):
        os.makedirs(issuesFolder)
        print("created sensor log path")
    data["date"] = pd.to_datetime("now").strftime("%d-%m-%Y %H:%M:%S")
    date = pd.to_datetime("now").strftime("%d_%m_%Y")
    filename = os.path.join(issuesFolder, f"{date}.csv")
    df = pd.DataFrame(data, index=[0])
    df.to_csv(
        filename,
        mode="a",
        header=(not os.path.exists(filename)),
        index=False,
    )


def readIssueFile(date: datetime) -> pd.DataFrame | None:
    date.strftime("%d_%m_%Y")
    filename = os.path.join(issuesFolder, f"{date}.csv")
    if os.path.exists(filename):
        return pd.read_csv(filename)
    else:
        return None


def readSensorFile(date: datetime, name: str) -> pd.DataFrame | None:
    date.strftime("%d_%m_%Y")
    filename = os.path.join(sensorFolder, f'{date + "_" + name}.csv')
    if os.path.exists(filename):
        return pd.read_csv(filename)
    else:
        return None

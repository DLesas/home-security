import pandas as pd
import os
import datetime
from sqlalchemy import (
    create_engine,
    MetaData,
    Table,
    Column,
    Integer,
    String,
    DateTime,
    Boolean,
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# import network_functions
fileDir = os.path.dirname(os.path.realpath(__file__))
logFolder = os.path.join(fileDir, "logs")
sensorFolder = os.path.join(logFolder, "sensors")
issuesFolder = os.path.join(logFolder, "issues")
db_file = os.path.join("logs.db")

# Create SQLAlchemy engine
engine = create_engine(
    f"sqlite:///{db_file}", echo=False
)  # Set echo=True for debugging

# Define a base class for declarative class definitions
Base = declarative_base()


class SensorLog(Base):
    __tablename__ = "sensor_logs"
    id = Column(Integer, primary_key=True)
    building = Column(String)
    date = Column(DateTime)
    status = Column(String)
    temp = Column(Integer)
    door = Column(String)


class IssuesLog(Base):
    __tablename__ = "general_logs"
    id = Column(Integer, primary_key=True)
    title = Column(String)
    body = Column(String)
    severity = Column(String)
    delayTillNextInSeconds = Column(Integer)
    TriggeredNotification = Column(Boolean)
    date = Column(DateTime)


def initialiseDB():
    if not os.path.exists(db_file):
        open(db_file, "w").close()
        Base.metadata.create_all(engine)


def writeToFile(data: dict, building: str):

    if not os.path.exists(sensorFolder):
        os.makedirs(sensorFolder)
        print("created sensor log path")
    data["date"] = pd.to_datetime("now").strftime("%d-%m-%Y %H:%M:%S")
    data["microseconds"] = pd.to_datetime("now").strftime("%f")
    date = pd.to_datetime("now").strftime("%d_%m_%Y")
    filename = os.path.join(sensorFolder, f'{date + " " + building}.csv')
    df = pd.DataFrame(data, index=[0])
    df.to_csv(
        filename,
        mode="a",
        header=(
            not os.path.exists(filename)
        ),  # this has a race condition between all threads
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
        header=(
            not os.path.exists(filename)
        ),  # this has a race condition between all threads
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
    filename = os.path.join(sensorFolder, f'{date + " " + name}.csv')
    if os.path.exists(filename):
        return pd.read_csv(filename)
    else:
        return None

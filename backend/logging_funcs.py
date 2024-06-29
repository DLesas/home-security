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
db_file = os.path.join(logFolder, "logs.db")

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
    id = Column(String, primary_key=True)
    name = Column(String)
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


def writeSensorToDB(data: dict, building: str):

    data["date"] = pd.to_datetime("now")
    data["building"] = building
    df = pd.DataFrame(data, index=[0])
    df.to_sql("sensor_logs", con=engine, if_exists="append", index=False)


def writeIssueToDB(data: dict):
    data["date"] = pd.to_datetime("now")
    df = pd.DataFrame(data, index=[0])
    df.to_sql("general_logs", con=engine, if_exists="append", index=False)


def readIssuesDB(date: datetime) -> pd.DataFrame:
    date = date.date()
    # Calculate the start and end timestamps for the given date
    start_timestamp = datetime.datetime.combine(date, datetime.time.min)
    end_timestamp = datetime.datetime.combine(date, datetime.time.max)
    # Construct the SQL query to filter based on date range
    query = f"SELECT * FROM general_logs WHERE date >= '{start_timestamp}' AND date <= '{end_timestamp}'"
    # Execute the query and return the result as a DataFrame
    return pd.read_sql(query, con=engine)


def readSensorLogsDB(date: datetime, building: str) -> pd.DataFrame:
    date = date.date()
    # Calculate the start and end timestamps for the given date
    start_timestamp = datetime.datetime.combine(date, datetime.time.min)
    end_timestamp = datetime.datetime.combine(date, datetime.time.max)
    # Construct the SQL query to filter based on date range
    query = f"SELECT * FROM sensor_logs WHERE date >= '{start_timestamp}' AND date <= '{end_timestamp}' AND building = '{building}'"
    # Execute the query and return the result as a DataFrame
    return pd.read_sql(query, con=engine)


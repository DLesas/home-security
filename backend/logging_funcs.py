import pandas as pd
import os
import datetime
import threading
from sqlalchemy import (
    create_engine,
    MetaData,
    Table,
    Column,
    Integer,
    String,
    DateTime,
    Boolean,
    text
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.exc import OperationalError
from queue import Queue, Empty
import time

# import network_functions
fileDir = os.path.dirname(os.path.realpath(__file__))
logFolder = os.path.join(fileDir, "logs")
sensorFolder = os.path.join(logFolder, "sensors")
issuesFolder = os.path.join(logFolder, "issues")
db_file = os.path.join(logFolder, "logs.db")

# Create SQLAlchemy engine with connection pooling
engine = create_engine(
    f"sqlite:///{db_file}", echo=False, pool_size=5, max_overflow=10
)  # Set echo=True for debugging

# Define a base class for declarative class definitions
Base = declarative_base()

issueQueue = Queue()
sensorQueue = Queue()
queue_flush_limit = 100


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
    with engine.connect() as connection:
        connection.execute(text("PRAGMA journal_mode=WAL;"))
        connection.execute(text("DROP INDEX IF EXISTS idx_sensor_logs_date;"))
        connection.execute(text("DROP INDEX IF EXISTS idx_sensor_logs_building;"))
        connection.execute(text("DROP INDEX IF EXISTS idx_sensor_logs_date_building;"))
        connection.execute(text("CREATE INDEX IF NOT EXISTS idx_sensor_logs_date_building ON sensor_logs(date, building);"))
        connection.execute(text("CREATE INDEX IF NOT EXISTS idx_general_logs_date ON general_logs(date);"))



# Initialize batch writers

def flush_queue_to_db():
    queues = {'sensor_logs': sensorQueue, 'general_logs': issueQueue}
    for table_name, queue in queues.items():
        records = []
        while not queue.qsize() == 0:
            try:
                records.append(queue.get_nowait())
            except Empty:
                break
        if records:
            df = pd.DataFrame(records)
            df.to_sql(table_name, con=engine, if_exists="append", index=False)

def queue_monitor():
    while True:
        for q in [issueQueue, sensorQueue]:
            if q.qsize() >= queue_flush_limit:
                flush_queue_to_db()
            time.sleep(5)  


def writeSensorToDB(data: dict, building: str):
    data["building"] = building
    data["date"] = pd.to_datetime("now")
    sensorQueue.put(data)


def writeIssueToDB(data: dict):
    data["date"] = pd.to_datetime("now")
    issueQueue.put(data)


def readIssuesDB(date: datetime) -> pd.DataFrame:
    date = date.date()
    # Calculate the start and end timestamps for the given date
    start_timestamp = datetime.datetime.combine(date, datetime.time.min)
    end_timestamp = datetime.datetime.combine(date, datetime.time.max)
    # Construct the SQL query to filter based on date range
    query = text("SELECT * FROM general_logs WHERE date >= :start AND date <= :end")
    # Execute the query and return the result as a DataFrame
    df = pd.read_sql(query, con=engine, params={"start": start_timestamp, "end": end_timestamp})
    return df



def readSensorLogsDB(date: datetime, building: str) -> pd.DataFrame:
    date = date.date()
    print('got date')
    # Calculate the start and end timestamps for the given date
    start_timestamp = datetime.datetime.combine(date, datetime.time.min)
    end_timestamp = datetime.datetime.combine(date, datetime.time.max)
    print('got correct date')
    
    # Construct the SQL query to filter based on date range
    query = """
    SELECT * FROM sensor_logs 
    WHERE building = :building 
    AND date >= :start 
    AND date <= :end 
    """
    print('querying')
    
    with engine.connect() as connection:
        result = connection.execute(text(query), {"building": building, "start": start_timestamp, "end": end_timestamp})
        rows = result.fetchall()
    
    print('queried')
    
    # Convert query result into a DataFrame
    df = pd.DataFrame(rows, columns=result.keys())
    
    print('dataframe created')
    
    # Convert DataFrame to JSON format
    
    print('jsonified')
    
    return df


# Function to explain query plan for debugging index usage
# Initialize database and start batch writers

# Example usage
# writeSensorToDB({"status": "OK", "temp": 22, "door": "closed"}, "Building1")
# writeIssueToDB({"name": "Issue1", "title": "Example Issue", "body": "Issue details", "severity": "High", "delayTillNextInSeconds": 60, "TriggeredNotification": False})

# When shutting down the application
# stop_batch_writers()

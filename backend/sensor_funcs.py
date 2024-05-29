import pandas as pd
import os
from devices import sensors

# import network_functions
import requests
import json
import threading
import time
import numpy as np
from typing import List
from alarm_funcs import turnOnAlarms, turnOffAlarms
import cv2


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

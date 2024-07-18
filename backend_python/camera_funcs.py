import os
from typing import List
import cv2
import numpy as np
from ultralytics import YOLO

model = YOLO(
    os.path.join(os.path.split(os.path.realpath(__file__))[0], "models", "yolov8m.pt")
)
model.TASK = "detect"
model.MODE = "predict"


cameras = os.path.join(os.path.split(os.path.realpath(__file__))[0], "test_video.mp4")


def getStreams(cameras):
    print(os.path.join(os.path.split(os.path.realpath(__file__))[0], "test_video.mp4"))
    cap = cv2.VideoCapture(
        os.path.join(os.path.split(os.path.realpath(__file__))[0], "test_video.mp4")
    )  # cv2.VideoCapture('chaplin.mp4')
    return [cap]


def getImage(cap, results: List, i: int):
    if cap.isOpened() is False:
        print("Error opening video stream or file")

    # Read until video is completed
    if cap.isOpened():
        # Capture frame-by-frame
        ret, frame = cap.read()
        if ret is True:
            results[i] = frame
        elif ret is False:
            raise Exception("no more frames")


def processImages(images: List[np.ndarray]):
    results = model.predict(
        source=images, classes=[0, 1, 3, 4, 5, 18], conf=0.4, device="cuda:0"
    )
    return results

import numpy as np
import torch
from typing import List
from numpy.typing import NDArray
import multiprocessing as mp
from yoloProcessor import measure_operation
from ultralytics import YOLO

class FaceDetector:
    def __init__(self, model_path: str, device: str, performance_queue: mp.Queue, worker_id: int) -> None:
        self.model_path = model_path
        self.device = device
        self.performance_queue = performance_queue
        self.worker_id = worker_id
        self.model = self.load_model()
    
    def load_model(self) -> YOLO:
        with measure_operation(self.performance_queue, f"facedetector-{self.worker_id}", "facedetector_model_load"):
            model = YOLO(self.model_path)
            model.to(self.device)
            return model
    
    def detect(self, frame: NDArray[np.uint8]) -> List[Detection]:
        with measure_operation(self.performance_queue, f"facedetector-{self.worker_id}", "facedetector_inference"):
            results = self.model.predict(frame)
            return results

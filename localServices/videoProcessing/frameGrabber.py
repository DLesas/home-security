import cv2
import threading
from queue import Queue, Empty, Full
import time
import logging
from dataclasses import dataclass
from typing import Dict, Optional, List, Any
import numpy as np
from numpy.typing import NDArray
from performanceMonitor import measure_operation
import multiprocessing as mp
import traceback

@dataclass
class FrameData:
    frame_id: int
    stream_id: str
    timestamp: float
    frame: NDArray[np.uint8]

class FrameGrabber:
    def __init__(
        self, 
        stream_configs: Dict[str, str], 
        shared_queue: Queue,
        performance_queue: mp.Queue,
        logging_queue: mp.Queue,
        processed_frames: mp.Value,
        drop_frames: mp.Value
    ) -> None:
        self.stream_configs = stream_configs
        self.shared_queue = shared_queue
        self.performance_queue = performance_queue
        self.logging_queue = logging_queue
        self.processed_frames = processed_frames
        self.drop_frames = drop_frames
        
        self.running = threading.Event()
        self.threads: Dict[str, threading.Thread] = {}
        self.frame_count = 0
        
    def start(self) -> None:
        self.running.set()
        
        for stream_id, video_path in self.stream_configs.items():
            thread = threading.Thread(
                target=self._grab_frames,
                args=(stream_id, video_path),
                daemon=True
            )
            thread.start()
            self.threads[stream_id] = thread
        
        self.logging_queue.put({
            "severity": "info",
            "message": f"Started {len(self.threads)} frame grabbing threads"
        })
        
    def stop(self) -> None:
        self.running.clear()
        for thread in self.threads.values():
            thread.join()
        self.logging_queue.put({
            "severity": "info",
            "message": "All frame grabbing threads stopped"
        })
        
    def _grab_frames(self, stream_id: str, video_path: str) -> None:
        """Thread function for continuous frame grabbing from a single stream"""
        # Construct capture string with optimized parameters
        cap_string = (f"{video_path}")
        capture = cv2.VideoCapture(cap_string)
        #capture.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        #capture.set(cv2.CAP_PROP_FPS, 60)
        
        while self.running.is_set():
            
            if not capture.isOpened():
                self.logging_queue.put({
                    "severity": "error",
                    "message": f"Stream {stream_id}: Connection lost. Attempting to reconnect..."
                })
                time.sleep(1.0)  # Wait before retry
                capture = cv2.VideoCapture(cap_string)
                #capture.set(cv2.CAP_PROP_BUFFERSIZE, 1)
                #capture.set(cv2.CAP_PROP_FPS, 60)
                continue
            
            try:
                # Measure grab time
                with measure_operation(self.performance_queue, stream_id, "frame_grab"):
                    if not capture.grab():
                        continue
                
                # Only retrieve if queue isn't full
                if not self.shared_queue.full():
                    # Measure retrieve time
                    with measure_operation(self.performance_queue, stream_id, "frame_retrieve"):
                        ret, frame = capture.retrieve()
                    
                    if ret:
                        frame_data = FrameData(
                            frame_id=self.frame_count,
                            stream_id=stream_id,
                            timestamp=time.time(),
                            frame=frame
                        )
                        
                        # Measure queue put time
                        with measure_operation(self.performance_queue, stream_id, "queue_put"):
                            try:
                                self.shared_queue.put_nowait(frame_data)
                                self.frame_count += 1
                                self.processed_frames.value += 1
                            except Full:
                                self.drop_frames.value += 1
                else:
                    self.drop_frames.value += 1
                    
            except Exception as e:
                error_message = f"Stream {stream_id}: Error grabbing frame: {e}"
                traceback_str = traceback.format_exc()
                self.logging_queue.put({
                    "severity": "error",
                    "message": f"{error_message}\n{traceback_str}"
                })
                time.sleep(0.1)
                
        capture.release()
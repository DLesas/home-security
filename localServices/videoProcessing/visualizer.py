import cv2
import numpy as np
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
from numpy.typing import NDArray
from performanceMonitor import measure_operation
from yoloProcessor import Detection
from yoloClasses import yolo_classes
import multiprocessing as mp
import time

@dataclass
class StreamWindow:
    name: str
    window_created: bool = False
    last_frame_id: int = -1
    fps_counter: int = 0
    last_fps_time: float = 0.0
    fps: float = 0.0

class DetectionVisualizer:
    def __init__(self, performance_queue: mp.Queue) -> None:
        self.performance_queue = performance_queue
        self.stream_windows: Dict[str, StreamWindow] = {}

    def update(self, result: Dict[str, Any]) -> None:
        """Update visualization for a specific stream"""
        stream_id = result['stream_id']
        frame = result['frame']
        detections = result['detections']
        frame_id = result['frame_id']

        # Get or create stream window
        if stream_id not in self.stream_windows:
            self.stream_windows[stream_id] = StreamWindow(f"Stream {stream_id}")

        window = self.stream_windows[stream_id]

        # Skip if frame is older than last processed frame
        if frame_id < window.last_frame_id:
            return

        window.last_frame_id = frame_id

        with measure_operation(self.performance_queue, stream_id, "visualization"):
            # Create window if not exists
            if not window.window_created:
                cv2.namedWindow(window.name, cv2.WINDOW_NORMAL)
                window.window_created = True

            # Create visualization frame
            vis_frame = self._draw_detections(frame, detections)

            # Update FPS counter
            current_time = time.time()
            window.fps_counter += 1

            if current_time - window.last_fps_time >= 1.0:
                window.fps = window.fps_counter / (current_time - window.last_fps_time)
                window.fps_counter = 0
                window.last_fps_time = current_time

            # Draw FPS
            cv2.putText(
                vis_frame,
                f"FPS: {window.fps:.1f}",
                (10, 30),
                cv2.FONT_HERSHEY_SIMPLEX,
                1,
                (0, 255, 0),
                2
            )

            # Show frame
            cv2.imshow(window.name, vis_frame)

    def _draw_detections(
        self,
        frame: NDArray[np.uint8],
        detections: List[Detection]
    ) -> NDArray[np.uint8]:
        """Draw detections on frame"""
        vis_frame = frame.copy()

        for det in detections:
            x1, y1, x2, y2 = map(int, det.bbox)
            conf = det.confidence
            class_id = det.class_id
            class_name = det.class_name
            color = det.class_color

            # Draw bounding box
            cv2.rectangle(vis_frame, (x1, y1), (x2, y2), color, 2)

            # Draw label
            label = f"{class_name}: {conf:.2f}"
            cv2.putText(
                vis_frame,
                label,
                (x1, y1 - 10),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.5,
                color,
                2
            )

        return vis_frame

    def cleanup(self) -> None:
        """Clean up all windows"""
        cv2.destroyAllWindows() 

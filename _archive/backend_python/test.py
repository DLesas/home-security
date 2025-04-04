import multiprocessing as mp
import threading
from queue import Queue, Empty, Full
import cv2
import time
from ultralytics import YOLO
import os

class VideoStreamProcessor(mp.Process):
    def __init__(self, video_path, model_path, stream_id=0, queue_size=2):
        super().__init__()
        self.video_path = video_path
        self.model_path = model_path
        self.stream_id = stream_id
        self.queue_size = queue_size
        self.running = mp.Event()
        self.frames_processed = 0
        self.frames_dropped = 0

    def run(self):
        # Initialize video capture and YOLO model in the subprocess
        self.capture = cv2.VideoCapture(f"{self.video_path}?fifo_size=50000000&overrun_nonfatal=1")
        
        # Set capture properties
        self.capture.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        self.capture.set(cv2.CAP_PROP_FPS, 30)
        
        # Verify capture is properly initialized
        if not self.capture.isOpened():
            print(f"Failed to open video capture for stream {self.stream_id}")
            return
            
        self.model = YOLO(self.model_path)
        self.frame_queue = Queue(maxsize=self.queue_size)
        
        # Single display thread per process
        self.display_thread = threading.Thread(target=self.process_and_display)
        self.display_thread.daemon = True
        
        self.running.set()
        self.display_thread.start()
        
        self.capture_and_process()

    def capture_and_process(self):
        last_log_time = time.time()
        last_reconnect_time = 0
        reconnect_delay = 2  # seconds between reconnection attempts
        
        timings = {
            'grab': {'total': 0, 'max': 0, 'min': float('inf')},
            'retrieve': {'total': 0, 'max': 0, 'min': float('inf')},
            'inference': {'total': 0, 'max': 0, 'min': float('inf')},
            'display_prep': {'total': 0, 'max': 0, 'min': float('inf')},
            'queue_put': {'total': 0, 'max': 0, 'min': float('inf')}
        }
        iteration_count = 0
        
        while self.running.is_set():
            if not self.capture.isOpened():
                current_time = time.time()
                if current_time - last_reconnect_time >= reconnect_delay:
                    print(f"Stream {self.stream_id}: Connection lost, attempting to reconnect...")
                    self.capture.release()  # Ensure old connection is closed
                    self.capture = cv2.VideoCapture(f"{self.video_path}?fifo_size=50000000&overrun_nonfatal=1")
                    self.capture.set(cv2.CAP_PROP_BUFFERSIZE, 1)
                    self.capture.set(cv2.CAP_PROP_FPS, 30)
                    last_reconnect_time = current_time
                time.sleep(0.1)  # Prevent CPU spinning
                continue
                
            # Time frame grab
            grab_start = time.time()
            try:
                grabbed = self.capture.grab()
                if not grabbed:
                    print(f"Stream {self.stream_id}: Failed to grab frame")
                    self.capture.release()  # Force reconnection on next iteration
                    continue
            except Exception as e:
                print(f"Stream {self.stream_id}: Error grabbing frame: {e}")
                self.capture.release()
                continue
                
            grab_time = time.time() - grab_start
            self._update_timing_stats(timings['grab'], grab_time)
            
            if not self.frame_queue.full():
                # Time frame retrieve
                retrieve_start = time.time()
                try:
                    success, frame = self.capture.retrieve()
                    if not success:
                        print(f"Stream {self.stream_id}: Failed to retrieve frame")
                        continue
                except Exception as e:
                    print(f"Stream {self.stream_id}: Error retrieving frame: {e}")
                    continue
                    
                retrieve_time = time.time() - retrieve_start
                self._update_timing_stats(timings['retrieve'], retrieve_time)
                
                if success:
                    # Time inference
                    inference_start = time.time()
                    results = self.model(frame, verbose=False)
                    inference_time = time.time() - inference_start
                    self._update_timing_stats(timings['inference'], inference_time)
                    
                    # Time display preparation
                    display_start = time.time()
                    annotated_frame = results[0].plot()
                    display_time = time.time() - display_start
                    self._update_timing_stats(timings['display_prep'], display_time)
                    
                    # Time queue put operation
                    queue_start = time.time()
                    try:
                        self.frame_queue.put_nowait(annotated_frame)
                        self.frames_processed += 1
                    except Full:
                        self.frames_dropped += 1
                    queue_time = time.time() - queue_start
                    self._update_timing_stats(timings['queue_put'], queue_time)
                    
                    iteration_count += 1
                else:
                    self.frames_dropped += 1
                
                # Log statistics every 5 seconds
                current_time = time.time()
                if current_time - last_log_time >= 5:
                    self._log_statistics(timings, current_time - last_log_time, iteration_count)
                    self._reset_timings(timings)
                    iteration_count = 0
                    last_log_time = current_time

    def _update_timing_stats(self, timing_dict, time_value):
        timing_dict['total'] += time_value
        timing_dict['max'] = max(timing_dict['max'], time_value)
        timing_dict['min'] = min(timing_dict['min'], time_value)

    def _reset_timings(self, timings):
        for timing in timings.values():
            timing['total'] = 0
            timing['max'] = 0
            timing['min'] = float('inf')

    def _log_statistics(self, timings, total_time, count):
        if count == 0:
            return
            
        print(f"\nStream {self.stream_id} Performance Metrics:")
        print(f"Processed: {self.frames_processed}, Dropped: {self.frames_dropped} frames "
              f"({self.frames_dropped/(self.frames_processed + self.frames_dropped)*100:.1f}% drop rate)")
        print(f"Total iteration time: {total_time/count*1000:.1f}ms average")
        print("\nDetailed Timings (in ms):")
        print(f"{'Operation':<15} {'Average':>10} {'Min':>10} {'Max':>10}")
        print("-" * 45)
        
        for op_name, timing in timings.items():
            avg = timing['total'] / count if count > 0 else 0
            print(f"{op_name:<15} {avg*1000:>10.1f} {timing['min']*1000:>10.1f} {timing['max']*1000:>10.1f}")

    def process_and_display(self):
        window_name = f'YOLO Stream {self.stream_id}'
        cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)
        display_timings = {
            'get': {'total': 0, 'max': 0, 'min': float('inf')},
            'display': {'total': 0, 'max': 0, 'min': float('inf')}
        }
        last_log_time = time.time()
        iteration_count = 0
        
        while self.running.is_set():
            # Time queue get operation
            get_start = time.time()
            try:
                frame = self.frame_queue.get_nowait()
                get_time = time.time() - get_start
                self._update_timing_stats(display_timings['get'], get_time)
                
                # Time display operation
                display_start = time.time()
                cv2.imshow(window_name, frame)
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    self.stop()
                    break
                display_time = time.time() - display_start
                self._update_timing_stats(display_timings['display'], display_time)
                
                iteration_count += 1
                
                # Log display statistics every 5 seconds
                current_time = time.time()
                if current_time - last_log_time >= 5 and iteration_count > 0:
                    print(f"\nDisplay Thread Timings for Stream {self.stream_id} (in ms):")
                    print(f"{'Operation':<15} {'Average':>10} {'Min':>10} {'Max':>10}")
                    print("-" * 45)
                    for op_name, timing in display_timings.items():
                        avg = timing['total'] / iteration_count
                        print(f"{op_name:<15} {avg*1000:>10.1f} {timing['min']*1000:>10.1f} {timing['max']*1000:>10.1f}")
                    
                    self._reset_timings(display_timings)
                    iteration_count = 0
                    last_log_time = current_time
                    
            except Empty:
                time.sleep(0.001)

    def stop(self):
        self.running.clear()
        if hasattr(self, 'capture'):
            self.capture.release()
        cv2.destroyAllWindows()


def start_streams(stream_configs):
    """
    Start multiple video streams
    stream_configs: list of dicts containing video_path, model_path, and queue_size
    """
    processes = []

    for i, config in enumerate(stream_configs):
        processor = VideoStreamProcessor(
            video_path=config["video_path"],
            model_path=config["model_path"],
            stream_id=i,
            queue_size=config.get("queue_size", 2),  # Default to 2 if not specified
        )
        processor.start()
        processes.append(processor)

    return processes


if __name__ == "__main__":
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    YOLO_MODEL_PATH = os.path.join(BASE_DIR, "yoloModels", "yolo11l.pt")

    stream_configs = [
        {
            "video_path": "udp://192.168.95.234:9000",
            "model_path": YOLO_MODEL_PATH,
            "queue_size": 2,  # Customize queue size per stream
        },
    ]

    try:
        processes = start_streams(stream_configs)

        # Keep main process alive and handle keyboard interrupt
        while True:
            time.sleep(1)

    except KeyboardInterrupt:
        print("\nStopping all streams...")
        for process in processes:
            process.stop()
            process.join()

        print("All streams stopped")

# Run inference on an image

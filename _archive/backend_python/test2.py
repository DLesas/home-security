import cv2
from ultralytics import YOLO
import time
import os
from collections import defaultdict
from statistics import mean

def main():
    # Initialize YOLO model
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    model = YOLO(os.path.join(BASE_DIR, "yoloModels", "yolo11s.pt"))
    
    # Initialize video capture with optimized parameters
    cap_string = ("udp://192.168.95.234:9000?"
                 "overrun_nonfatal=1&"
                 "flags=low_delay")
    
    cap = cv2.VideoCapture(cap_string)
    
    # Create window
    cv2.namedWindow('YOLO Detection', cv2.WINDOW_NORMAL)
    
    # Performance tracking
    frames_processed = 0
    start_time = time.time()
    last_log_time = start_time
    
    # Add timing metrics tracking
    timing_stats = defaultdict(lambda: {'times': [], 'min': float('inf'), 'max': 0, 'avg': 0})
    stats_print_interval = 5.0  # Print stats every 5 seconds
    last_stats_time = time.time()
    
    try:
        while True:
            frames_processed += 1
            
            # Time frame grab
            t_start = time.time()
            if not cap.grab():
                print("Failed to grab frame")
                continue
            timing_stats['grab']['times'].append(time.time() - t_start)
                
            # Time frame retrieve
            t_start = time.time()
            ret, frame = cap.retrieve()
            if not ret:
                print("Failed to retrieve frame")
                continue
            timing_stats['retrieve']['times'].append(time.time() - t_start)
            
            # Time YOLO detection
            t_start = time.time()
            results = model(frame, verbose=False, half=True)
            timing_stats['yolo']['times'].append(time.time() - t_start)
            
            # Time visualization
            t_start = time.time()
            annotated_frame = results[0].plot()
            cv2.imshow('YOLO Detection', annotated_frame)
            timing_stats['visualize']['times'].append(time.time() - t_start)
            
            # Update and print timing statistics
            current_time = time.time()
            if current_time - last_stats_time >= stats_print_interval:
                fps = frames_processed / (current_time - last_log_time)
                print(f"\nFPS: {fps:.1f}")
                
                # Calculate and print timing statistics
                for operation, stats in timing_stats.items():
                    times = stats['times']
                    if times:
                        stats['min'] = min(times)
                        stats['max'] = max(times)
                        stats['avg'] = mean(times)
                        print(f"{operation:>8} - avg: {stats['avg']*1000:6.1f}ms, "
                              f"min: {stats['min']*1000:6.1f}ms, "
                              f"max: {stats['max']*1000:6.1f}ms")
                        stats['times'] = []  # Reset times list
                
                frames_processed = 0
                last_log_time = current_time
                last_stats_time = current_time

            # Check for 'q' key to quit
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break
                
    except KeyboardInterrupt:
        print("Stopping...")
        
    finally:
        cap.release()
        cv2.destroyAllWindows()

if __name__ == "__main__":
    main()

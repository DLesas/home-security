import multiprocessing as mp
from queue import Queue, Empty
import os
import time
import logging
from typing import Dict, Optional, List, TypedDict
import cv2
import numpy as np
from numpy.typing import NDArray
from performanceMonitor import MultiProcessMonitor
from frameGrabber import FrameGrabber
from yoloProcessor import YOLOProcessor, Detection
from visualizer import DetectionVisualizer

class ProcessedFrame(TypedDict):
    frame_id: int
    stream_id: str
    timestamp: float
    frame: NDArray[np.uint8]
    detections: List[Detection]

def get_stream_configs() -> Dict[str, str]:
    """Get stream configuration"""
    return {
        "test camera": "udp://192.168.95.234:9000?fifo_size=50000000&overrun_nonfatal=1&flags=low_delay&fflags=nobuffer&probesize=32&analyzeduration=0",  # UDP stream configuration
    }

def main() -> None:
    # Setup logging first, before any other operations
    logger = logging.getLogger(__name__)

    try:
        # Initialize paths and configs
        BASE_DIR = os.path.dirname(os.path.abspath(__file__))
        YOLO_MODEL_PATH = os.path.join(BASE_DIR, "yoloModels", "yolo11l.pt")
        stream_configs = get_stream_configs()

        # Create shared queues
        frame_queue = mp.Queue(maxsize=120)
        result_queue = mp.Queue(maxsize=120)
        performance_queue = mp.Queue()
        logging_queue = mp.Queue()
        grabber_drop_frames = mp.Value("i", 0)
        grabber_processed_frames = mp.Value("i", 0)
        processor_drop_frames = mp.Value("i", 0)
        processor_processed_frames = mp.Value("i", 0)
        

        # Initialize performance monitoring
        multi_process_monitor = MultiProcessMonitor(
            performance_queue=performance_queue,
            logging_queue=logging_queue,
            grabber_processed_frames=grabber_processed_frames,
            grabber_drop_frames=grabber_drop_frames,
            processor_processed_frames=processor_processed_frames,
            processor_drop_frames=processor_drop_frames,
            log_interval=5.0
        )

        # Initialize system components
        grabber = FrameGrabber(
            stream_configs=stream_configs,
            shared_queue=frame_queue,
            performance_queue=performance_queue,
            logging_queue=logging_queue,
            processed_frames=grabber_processed_frames,
            drop_frames=grabber_drop_frames
        )

        # Initialize YOLO processors
        processor = YOLOProcessor(
            model_path=YOLO_MODEL_PATH,
            shared_queue=frame_queue,
            result_queue=result_queue,
            performance_queue=performance_queue,
            logging_queue=logging_queue,
            processed_frames=processor_processed_frames,
            drop_frames=processor_drop_frames,
            memory_fraction=0.6,
        )

        # Initialize detection visualizer
        visualizer = DetectionVisualizer(
            performance_queue=performance_queue
        )

        # Start all components
        multi_process_monitor.start()
        grabber.start()
        processor.start()

        logger.info("System running. Press 'q' to stop.")

        # Main processing loop
        while True:
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break

            try:
                # Get results with timeout to allow for keyboard interrupt
                result: ProcessedFrame = result_queue.get(timeout=0.1)

                # Update visualization
                visualizer.update(result)

            except Empty:
                continue

    except KeyboardInterrupt:
        logger.info("\nShutdown signal received")

    except Exception as e:
        logger.error(f"Fatal error: {e}")
        import traceback
        logger.error(traceback.format_exc())  # Added detailed error logging

    finally:
        # Cleanup
        logger.info("Stopping system components...")
        visualizer.cleanup()
        grabber.stop()
        processor.stop()
        multi_process_monitor.stop()
        logger.info("Shutdown complete")

if __name__ == "__main__":
    # Enable clean shutdown with Ctrl+C
    if os.name == 'nt':  # Windows
        mp.set_start_method('spawn')
        
    # Freeze support for Windows
    mp.freeze_support()
    main()

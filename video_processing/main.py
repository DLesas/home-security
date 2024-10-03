import redis
import cv2
import numpy as np
import time
import os
import ffmpeg

class RTMPStreamProcessor:
    def __init__(self, rtmp_url, camera_id, redis_url):
        self.rtmp_url = rtmp_url
        self.camera_id = camera_id
        self.redis = redis.from_url(redis_url)
        self.width = 640  # Set your stream's width
        self.height = 480  # Set your stream's height

    def push_frame_with_metadata(self, frame):
        _, buffer = cv2.imencode('.jpg', frame)
        frame_bytes = buffer.tobytes()
        timestamp = time.time()
        frame_id = f"frame_{self.camera_id}_{int(timestamp)}"
        self.redis.hset(frame_id, mapping={
            'camera_id': self.camera_id,
            'timestamp': timestamp,
            'frame': frame_bytes
        })
        self.redis.rpush(f'camera_queue:{self.camera_id}', frame_id)

    def process_stream(self):
        process = (
            ffmpeg
            .input(self.rtmp_url)
            .output('pipe:', format='rawvideo', pix_fmt='bgr24')
            .run_async(pipe_stdout=True)
        )
        while True:
            in_bytes = process.stdout.read(self.width * self.height * 3)
            if not in_bytes:
                break
            frame = np.frombuffer(in_bytes, np.uint8).reshape([self.height, self.width, 3])
            self.push_frame_with_metadata(frame)

if __name__ == "__main__":
    redis_url = os.getenv('REDIS_URL', 'redis://redis:6379')
    rtmp_url = "rtmp://your_rtmp_stream_url"  # Replace with your RTMP stream URL
    camera_id = "camera_1"
    
    processor = RTMPStreamProcessor(rtmp_url, camera_id, redis_url)
    processor.process_stream()

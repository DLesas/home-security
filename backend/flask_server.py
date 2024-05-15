from flask import Flask, render_template, Response
from camera import Camera
import cv2

app = Flask(__name__)
cameras = [
    {'name': "xxx", 'ip': "", 'cap' : {} }
]

def gen(camera):
    while True:
        rawFrame = 'xx'
        frame = camera.get_frame()
        yield (b"--frame\r\n" b"Content-Type: image/jpeg\r\n\r\n" + frame + b"\r\n")


@app.route("/video_feed/<str:name>")
def video_feed():
    return Response(gen(Camera()), mimetype="multipart/x-mixed-replace; boundary=frame")


if __name__ == "__main__":
    app.run(host="0.0.0.0", debug=True)

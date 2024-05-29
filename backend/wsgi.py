from gevent import monkey
monkey.patch_all()
from flask_server import create_app, start_sensor_threads

app = create_app()

if __name__ == "__main__":
    start_sensor_threads()
    
    from gevent.pywsgi import WSGIServer
    from geventwebsocket.handler import WebSocketHandler

    http_server = WSGIServer(('0.0.0.0', 5000), app, handler_class=WebSocketHandler)
    http_server.serve_forever()
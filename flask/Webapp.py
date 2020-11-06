import logging
from flask import Flask
from flask_socketio import SocketIO
import string
rooms = {}
app = Flask(__name__)
socketApp = SocketIO(app)
print('WEBAPP UP', flush=True)
import HttpServer
import SocketServer

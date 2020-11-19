import logging
from flask import Flask
from flask_socketio import SocketIO
import string
rooms = {}
app = Flask(__name__)
socketApp = SocketIO(app)
print('WEBAPP UP v 0.4c', flush=True)
import HttpServer
import SocketServer

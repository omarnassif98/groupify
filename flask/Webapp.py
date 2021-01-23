import logging
from flask import Flask
from flask_socketio import SocketIO
from werkzeug.middleware.proxy_fix import ProxyFix
rooms = {}
app = Flask(__name__)
socketApp = SocketIO(app)
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_host=1)
print('WEBAPP UP v 0.5e', flush=True)
import HttpServer
import SocketServer

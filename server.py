from flask import Flask, url_for, render_template, redirect, request
from flask_socketio import SocketIO, send, emit, join_room, leave_room, rooms as GetRooms
import random
import string
import os
import json
rooms = {}
app = Flask('Groupify')
socketApp = SocketIO(app)

@app.route('/')
def LandingPage():
    return render_template('Landing.html')
    
@app.route('/auth')
def auth():
    return render_template('Callback.html')

@app.route('/host', methods = ['POST'])
def CreateRoom():
    while True:
        room_code = ''.join(random.choice(string.ascii_uppercase + string.digits) for _ in range(4))
        if room_code not in rooms.keys():
            break
    
    print('NEW ROOM ' + room_code)
    return room_code

@socketApp.on('disconnect')
def disconnection():
    print(GetRooms(sid=request.sid))

@socketApp.on('client_join')
def displayMsg(userInfo):
    print('CONNECTION RECIEVED')
    print(userInfo)
    print(type(userInfo))
    roomCode = userInfo['room_code']
    del userInfo['room_code']
    if roomCode not in rooms.keys():
        roomObj = {'users': [userInfo], 'host': userInfo['socket_id']}
        rooms[roomCode] = roomObj
    else:
        rooms[roomCode]['users'].append(userInfo)
    emit('user_join', userInfo, room=roomCode)
    join_room(roomCode, sid = userInfo['socket_id'])
    emit('populate_room', rooms[roomCode], room=userInfo['socket_id'])
    

@socketApp.on('test')
def test(msg):
    print(msg)

@app.route('/room/<id>')
def DisplayRoom(id):
    return render_template('RoomView.html')

if __name__ == '__main__':
    socketApp.run(app,host='localhost', port=5000, debug=True)
from flask import request
from flask_socketio import send, emit, join_room, leave_room, rooms as GetRooms
from Webapp import socketApp
import Webapp
from time import time

localServerTime = lambda: int(round(time() * 1000))

@socketApp.on('disconnect')
def disconnection():
    print(GetRooms(sid=request.sid))

@socketApp.on('client_join')
def displayMsg(packet):
    print('CONNECTION RECIEVED', flush=True)
    print(packet)
    userInfo = packet['sender']
    roomCode = userInfo['room_code']
    del userInfo['room_code']
    if roomCode not in Webapp.rooms.keys():
        roomObj = {'users': [userInfo], 'host': userInfo['socket_id']}
        Webapp.rooms[roomCode] = roomObj
    else:
        Webapp.rooms[roomCode]['users'].append(userInfo)
    emit('user_join', userInfo, room=roomCode)
    join_room(roomCode, sid = userInfo['socket_id'])
    emit('initialize_room', {'ledger':Webapp.rooms[roomCode], 'servertime':localServerTime()}, room=userInfo['socket_id'])
    

@socketApp.on('play_event')
def SendPlayEvent(msg):
    print(msg)

@socketApp.on('enqueue_relay')
def RelayQueueEvent(packet):
    userInfo = packet['sender']
    roomCode = userInfo['room_code']
    packet['timestamp'] = localServerTime() + 300
    print('queueing song in room ' + roomCode)
    emit('enqueue_event', packet, room=roomCode)

@socketApp.on('test')
def test(msg):
    print(msg)
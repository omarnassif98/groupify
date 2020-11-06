from flask import url_for, render_template, redirect, request
from Webapp import app
import Webapp
import json
import random
import string
import SpotifyApiHelper

@app.route('/')
def LandingPage():
    print('LANDED', flush=True)
    return render_template('Landing.html')
    
@app.route('/auth')
def auth():
    return render_template('Callback.html')

@app.route('/host', methods = ['POST'])
def CreateRoom():
    while True:
        room_code = ''.join(random.choice(string.ascii_uppercase + string.digits) for _ in range(4))
        if room_code not in Webapp.rooms.keys():
            break
    print('NEW ROOM ' + room_code)
    return room_code

@app.route('/attempt_room')
def AttemptRoom():
    code = request.args.get('code')
    print('Someone wants to join room ' + code)
    feedback = 200 if code in Webapp.rooms.keys() else 404
    return '', feedback

@app.route('/room/<id>')
def DisplayRoom(id):
    return render_template('RoomView.html')

@app.route('/guest_search')
def GuestSearch():
    phrase = request.args.get('phrase')
    return SpotifyApiHelper.QuerySong(phrase)
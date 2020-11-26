import requests as httprequests
from base64 import b64encode
import json

accessToken = None
def AuthenticateClientCredentials():
    auth = '192243d8b5fb45ff836d39698e189545:9001e27bbb2a4989a3089faba9546583'.encode('ascii')
    auth = b64encode(auth)
    auth = auth.decode('ascii')
    headers = {'Authorization': 'Basic ' + auth}
    body = {'grant_type':'client_credentials'}
    req = httprequests.post('https://accounts.spotify.com/api/token', data=body, headers=headers)
    if req.status_code == 200:
        response = json.loads(req.content)
        global accessToken 
        accessToken = response['access_token']
        print('Refreshed access token',flush=True)

def QuerySong(searchTerm):
    params = {'q': searchTerm, 'type': 'track'}
    headers = {'Authorization': 'Bearer ' + accessToken}
    print('WTF Bro')
    print(accessToken)
    req = httprequests.get('https://api.spotify.com/v1/search', params=params, headers=headers)
    if req.status_code == 200:
        print('XOXOXOXOXOX')
        return req.content
    else:
        print(req.content)
AuthenticateClientCredentials()

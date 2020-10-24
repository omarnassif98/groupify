const socket = io.connect('http://localhost:5000', {transports: ['websocket']});
console.log(sessionStorage.authCallback);
console.log(sessionStorage.verifier);
const roomCode = window.location.pathname.split('/').pop();
var localUserInfo = JSON.parse(sessionStorage.userProf);
localUserInfo = {'name':localUserInfo.display_name, 'socket_id': null}
var roomQueue = [];
var active = false;
var playing = false;
var playNextSongEvent = null;
var autoNudge = false;
var currentSongProgress = {};
var deviceInfo = {'currentDevice':null, 'availableDevices':[]};
var mediaUpdater = null;
const progressSlider = document.getElementById('progressSlider');
const progressIndicator = document.getElementById('progress');
var serverTimeOffset;
const SYNCRONIZATION_BUFFER = 500;
ChooseDevice();
//library defined Socket-io hook
//fires upon connection to server
socket.on('connect', function(){
    localUserInfo.socket_id = socket.id;
    localUserInfo.room_code = roomCode;
    console.log(localUserInfo);
    socket.emit('client_join', localUserInfo);
});

//library defined Socket-io hook
//fires upon getting message via send()
socket.on('message', (msg) =>{
    console.log(msg);
});

//user defined Socket-io hook
//Roster related
//populates roster with those already in the room
//only fires once (in the beginning)
socket.on('populate_room', (roomInfo) =>{
    console.log('Populating');
    console.log(roomInfo);
    const users = roomInfo.users;
    UpdateRoomRoster(users)
});

//user defined Socket-io hook
//adds user to roster upon their connection
//fires every single time a new user joins
socket.on('user_join', (incommingUser) => {
    console.log('Updating');
    UpdateRoomRoster([incommingUser]);
});

//user defined Socket-io hook
//fires upon getting a message via emit() to the 'answer' namespace
socket.on('answer', (text) => {
    console.log('FINALLY ' + text);
});


function HandleQuery(){
    const resultsDropdown =document.getElementById('resultsDropdown');
    while(resultsDropdown.firstChild){
        resultsDropdown.removeChild(resultsDropdown.firstChild);
    }
    const loadingPlaceholder = document.createElement('div');
    loadingPlaceholder.classList.add('dropdownPlaceholder');
    loadingPlaceholder.appendChild(document.createTextNode('Loading'));
    resultsDropdown.appendChild(loadingPlaceholder);
    resultsDropdown.style.display = 'block';

    const searchTerm =document.getElementById("songSearch").value;
    GuestQuery(searchTerm);

}

function GuestQuery(term){
    const endpoint = new URL('http://localhost:5000/guest_search');
    endpoint.searchParams.append('phrase',term);
    const req = new XMLHttpRequest();
    req.open('GET', endpoint);
    req.send();
    req.onreadystatechange = function(){
        if(req.readyState === XMLHttpRequest.DONE){
            console.log(req.responseText);
            DisplaySearchResults(JSON.parse(req.responseText));
        }
    }
}

//Search related function
//Uses API call directly if Authorized
//Queries spotify api for tracks matching search parameters
//Calls function to display each track found
function AuthorizedSongSearch(term){
    const endpoint = new URL('https://api.spotify.com/v1/search');
    endpoint.searchParams.append('q',term);
    endpoint.searchParams.append('type','track');
    const queryRequest = new XMLHttpRequest();
    queryRequest.open('GET',endpoint.href);
    console.log(`Bearer ${JSON.parse(sessionStorage.authCallback).access_token}`);
    queryRequest.setRequestHeader('Authorization', `Bearer ${JSON.parse(sessionStorage.authCallback).access_token}`);
    queryRequest.send();
    queryRequest.onreadystatechange = function (){
        if(queryRequest.readyState === XMLHttpRequest.DONE){
            DisplaySearchResults(JSON.parse(queryRequest.responseText))
            RefreshAccess();
        }
    }
}


function DisplaySearchResults(results){
    const resultsDropdown =document.getElementById('resultsDropdown');
    resultsDropdown.removeChild(resultsDropdown.firstChild)
    results.tracks.items.slice(0,4).forEach(item => {
        console.log(item);
        let songObj = {
            'name': item.name,
            'artist': item.artists.map(artist => artist.name).join(', '),
            'artworkURL' : item.album.images[2].url,
            'trackURI' : item.uri,
            'duration' : item.duration_ms
        };
        const dropdownResult = document.createElement('div');
        dropdownResult.classList.add('selectableResult');
        
        const albumCover = document.createElement('img')
        albumCover.classList.add('coverArt')
        albumCover.src = songObj.artworkURL;
        
        const labelContainer = document.createElement('div');
        labelContainer.classList.add('labelContainer');

        const songLabel = document.createElement('div');
        songLabel.classList.add('songLabel');
        songLabel.appendChild(document.createTextNode(songObj.name));
        
        
        const artistLabel = document.createElement('div');
        artistLabel.classList.add('artistLabel');
        artistLabel.appendChild(document.createTextNode(songObj.artist));
        
        dropdownResult.appendChild(albumCover)

        labelContainer.appendChild(songLabel);
        labelContainer.appendChild(artistLabel);
        dropdownResult.appendChild(labelContainer);
        dropdownResult.addEventListener('click', function(){
            PopulateInternalQueue(songObj);
            resultsDropdown.style.display = "none"
        });
        resultsDropdown.appendChild(dropdownResult);
    });
}

//Search related function
//Produces and displays a given song's information
function PopulateInternalQueue(song){
    roomQueue.push(song);
    const queueList = document.getElementById('roomQueue');
    const newListEntry = document.createElement('li');
    newListEntry.id = song.trackURI;
    newListEntry.appendChild(document.createTextNode(song.name))
    queueList.appendChild(newListEntry)
    if (!active){
        ForcePlaySong();
        active = true;
        playing = true;
    }else if (roomQueue.length == 1 && currentSongProgress.endTimestamp - Date.now() < 5000){
        console.log('Last second queue update');
        clearTimeout(playNextSongEvent);
        NudgeExternalQueue();
    }
}

//Player related function
//Uses an API call
//Instructs the spotify API to play the first song in the room's queue
//Only called when not already playing (this song was not queued; there was no queue) 
function ForcePlaySong(){
    const playerControl = new XMLHttpRequest();
        const endpoint = new URL('https://api.spotify.com/v1/me/player/play');
        endpoint.searchParams.append('device_id', deviceInfo.currentDevice.id);
        console.log(deviceInfo.currentDevice.name);
        playerControl.open('PUT', endpoint);
        playerControl.setRequestHeader('Authorization', `Bearer ${JSON.parse(sessionStorage.authCallback).access_token}`);
        playerControl.setRequestHeader('Content-type', 'application/json');
        const song = roomQueue.shift();
        const body = {'uris': [song.trackURI]};
        playerControl.send(JSON.stringify(body));
        playerControl.onreadystatechange = function(){
            if (playerControl.readyState == XMLHttpRequest.DONE){
                console.log('Forcing in ' + song.name);
                PlaySongEvent(song);
                mediaUpdater = setInterval(UpdateMediaProgress, 250);
            }
        };
}

//Player related function
//Called on the start any given song's playtime
//Calls the queue nudging function 5 seconds before the end of the song 
function PlaySongEvent(song){
    const current = document.getElementById('currentSongName');
    if (song != null){
        current.innerText = song.name;
        console.log(song);
        const duration = song.duration;
        const queueList = document.getElementById('roomQueue');
        queueList.removeChild(document.getElementById(song.trackURI));
        let date = new Date();
        date.setTime(Date.now() + duration);
        currentSongProgress.endTimestamp = date.getTime()
        currentSongProgress.duration = duration;
        currentSongProgress.progress = 0;
        setTimeout(SynchronizeClock, SYNCRONIZATION_BUFFER);
        playNextSongEvent = setTimeout(NudgeExternalQueue, duration - 5000);
    }else{
        active = false;
        playing = false;
        clearInterval(mediaUpdater);
        current.innerText = 'SPIN ONE UP DJ...';
    }
}

//Player related function
//Uses an API call
//Sends next song in room queue to spotify queue if possible
//If not prepares to end room queue
function NudgeExternalQueue(){
    if (roomQueue.length > 0) {
        const song = roomQueue.shift();
        const endpoint = new URL('https://api.spotify.com/v1/me/player/queue');
        endpoint.searchParams.append('uri', song.trackURI)
        const playerControl = new XMLHttpRequest();
        playerControl.open('POST', endpoint);
        playerControl.setRequestHeader('Authorization', `Bearer ${JSON.parse(sessionStorage.authCallback).access_token}`);
        playerControl.setRequestHeader('Content-type', 'application/json');
        playerControl.send();
        playerControl.onreadystatechange = function(){
            if (playerControl.readyState == XMLHttpRequest.DONE){
                playNextSongEvent = setTimeout(function(){PlaySongEvent(song)}, currentSongProgress.endTimestamp - Date.now());
            }
        };
    }else{
        playNextSongEvent = setTimeout(function(){PlaySongEvent(null)}, currentSongProgress.endTimestamp - Date.now());
    }
}

//Room state related
//takes an array of userInfo objects {display name, socket id}
//Updates roster with new users' names
function UpdateRoomRoster(newUsers){
    const userList = document.getElementById('userList');
    newUsers.forEach(incommingUser => {
        const newListEntry = document.createElement('li');
        if (incommingUser.socket_id == localUserInfo.socket_id){
            const boldObj = document.createElement('B');
            boldObj.appendChild(document.createTextNode(incommingUser.name));
            newListEntry.appendChild(boldObj);
            
        }else{
            newListEntry.appendChild(document.createTextNode(incommingUser.name));
        }
        newListEntry.setAttribute('socketIdx', incommingUser.socket_id)
        userList.appendChild(newListEntry)
    });
}


function UpdateMediaProgress(){
    progressSlider.value = currentSongProgress.progress/parseFloat(currentSongProgress.duration) *100;
    progressIndicator.innerText = currentSongProgress.progress;
    currentSongProgress.progress += 250;
}

function scrubMedia(val){
    console.log('Scrub: ' + val);
    progressIndicator.innerText = currentSongProgress.duration*val/parseFloat(100);
}

function ReleaseScrub(val){
    console.log('Final: ' + val);
    progressIndicator.innerText = currentSongProgress.duration*val/parseFloat(100);
}

function ScrubClick(val){
    console.log('First: ' + val);
    clearInterval(mediaUpdater)
}

//Player
function TogglePlayback(){
    if (!active){
        return;
    }
    const toggleRequest = new XMLHttpRequest();
    const endpoint = (playing)?'https://api.spotify.com/v1/me/player/pause':'https://api.spotify.com/v1/me/player/play';
    toggleRequest.open('PUT', endpoint);
    toggleRequest.setRequestHeader('Authorization', `Bearer ${JSON.parse(sessionStorage.authCallback).access_token}`);
    toggleRequest.setRequestHeader('Content-type', 'application/json');
    toggleRequest.send();
    toggleRequest.onreadystatechange = function(){
        if(toggleRequest.readyState == XMLHttpRequest.DONE){
            playing = !playing;
            if (playing){
                let timeRemaining = currentSongProgress.duration - currentSongProgress.progress;
                playNextSongEvent = setTimeout(NudgeExternalQueue, timeRemaining - 5000);
                mediaUpdater = setInterval(UpdateMediaProgress, 250);
            }else{
                clearInterval(mediaUpdater);
                clearTimeout(playNextSongEvent);
            }
            setTimeout(SynchronizePlayer, SYNCRONIZATION_BUFFER);
        }
    };

}


function SynchronizePlayer(){
    const request = new XMLHttpRequest();
    request.open('GET', 'https://api.spotify.com/v1/me/player/currently-playing');
    request.setRequestHeader('Authorization', `Bearer ${JSON.parse(sessionStorage.authCallback).access_token}`);
    request.setRequestHeader('Content-type', 'application/json');
    request.send()
    request.onreadystatechange = function(){
        if (request.readyState == XMLHttpRequest.DONE){
            const response = JSON.parse(request.responseText);
            const correctionOffset = Date.now() - serverTimeOffset - response.timestamp - SYNCRONIZATION_BUFFER;
            console.log(correctionOffset + ' dif ' + response.progress_ms + 'ms ' + typeof(response.timestamp) + ' ' + response.is_playing);
            currentSongProgress.progress = (playing)?response.progress_ms + correctionOffset :response.progress_ms;
        }
    }
}
//synchronizes time witth spotify server time
function SynchronizeClock(){
    const request = new XMLHttpRequest();
    request.open('GET', 'https://api.spotify.com/v1/me/player/currently-playing');
    request.setRequestHeader('Authorization', `Bearer ${JSON.parse(sessionStorage.authCallback).access_token}`);
    request.setRequestHeader('Content-type', 'application/json');
    request.send()
    request.onreadystatechange = function(){
        if (request.readyState == XMLHttpRequest.DONE){
            const response = JSON.parse(request.responseText);
            serverTimeOffset = Date.now() - response.timestamp - SYNCRONIZATION_BUFFER;
            console.log('offset was ' + serverTimeOffset);
        }
    }
}

function CallOverlay(subemenu){
    document.getElementById('backdrop').style.display = 'block';
}

function DismissOverlay(){
    document.getElementById('backdrop').style.display = 'none';
    
}

function ChooseDevice(){
    const deviceReq = new XMLHttpRequest();
    console.log(`Bearer ${JSON.parse(sessionStorage.authCallback).access_token}`);
    deviceReq.open('GET', 'https://api.spotify.com/v1/me/player/devices');
    deviceReq.setRequestHeader('Authorization', `Bearer ${JSON.parse(sessionStorage.authCallback).access_token}`);
    deviceReq.setRequestHeader('Content-type', 'application/json');
    deviceReq.send()
    deviceReq.onreadystatechange = function(){
        if (deviceReq.readyState == XMLHttpRequest.DONE){
            const response = JSON.parse(deviceReq.responseText);
            deviceInfo.availableDevices = [];
            response.devices.forEach(device => {
                deviceInfo.availableDevices.push({'name':device.name,'id':device.id,'type':device.type})                
            });
            if(deviceInfo.availableDevices.length == 1){
                deviceInfo.currentDevice = deviceInfo.availableDevices[0];
                console.log('Defaulted');
            }else{
                CallOverlay('test')
            }
        }
    }
}
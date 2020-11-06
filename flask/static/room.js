var socket;
const roomCode = window.location.pathname.split('/').pop();
var currentServerTime;

var popupFocus = false;
var localUserInfo;
var activeSubmenu = 0;

if (sessionStorage.userProf){
    localUserInfo = JSON.parse(sessionStorage.userProf);
    InitializeConnection();
    ChooseDevice();
}else{
    popupFocus = true;
    CallOverlay(1);
    console.log('AYY LMAO YOU SKIPPED A STEP BRO');
}

console.log(localUserInfo);
var roomQueue = [];

var playerInfo = {'active':false,'playing':false};
var deviceInfo = {'currentDevice':null, 'availableDevices':[]};
var mediaUpdater = null;
var playNextSongEvent = null;

const progressSlider = document.getElementById('progressSlider');
const progressIndicator = document.getElementById('progress');
var serverTimeOffset;

const SYNCRONIZATION_BUFFER = 500;

function SendToSocketServer(HOOK, data){
    console.log([HOOK,data]);
    socket.emit(HOOK, {'data':data, 'sender':localUserInfo});
}

function InitializeConnection(){
    var startTime;
    console.log(location.origin);
    socket = io.connect(location.origin, {transports: ['websocket']});
    //library defined Socket-io hook
    //fires upon connection to server
    socket.on('connect', function(){
        localUserInfo.socket_id = socket.id;
        localUserInfo.room_code = roomCode;
        startTime = Date.now();
        SendToSocketServer('client_join', null);
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
    socket.on('initialize_room', (data) =>{
        console.log(data);
        console.log('server: ' + data.servertime + '\n' + 'local: '+ Date.now());
        const serverTimeOffset = Date.now() - data.servertime + Math.floor((Date.now() - startTime)/2);
        currentServerTime = function(){return Date.now() - serverTimeOffset;};
        const users = data.ledger.users;
        UpdateRoomRoster(users);
        popupFocus = false;
        DismissOverlay();
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

    socket.on('enqueue_event', (response) => {
        console.log(response);
        console.log('goal: ' + response.timestamp + '\n' + 'now: '+ currentServerTime());
        console.log(response.timestamp-currentServerTime());
        playerInfo.latestTimestamp = response.timestamp
        if(currentServerTime() < response.timestamp){
        setTimeout(function(){PopulateInternalQueue(response.data)},response.timestamp-currentServerTime());
        }else{
            PopulateInternalQueue(response.data);
        }
    });

    

    
}
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
    AuthorizedSongSearch(searchTerm);

}

async function GuestQuery(term){
    let res = await AuthHTTPRequest('http://localhost:5000/guest_search', {'params':[['phrase', term]]},'GET');
    if(res.code == 200){
        res = JSON.parse(res.response);
        DisplaySearchResults(res);
    }
}

//Search related function
//Uses API call directly if Authorized
//Queries spotify api for tracks matching search parameters
//Calls function to display each track found
async function AuthorizedSongSearch(term){
    let res = await AuthHTTPRequest('https://api.spotify.com/v1/search', {'params':[['q', term], ['type','track']]},'GET');
    if(res.code == 200){
        console.log(res);
        res = JSON.parse(res.response);
        DisplaySearchResults(res);
    }
}

function EstablishConnection(){
    const username = document.getElementById('usernameEntry').value;
    if(username != ''){
        localUserInfo = {'name':username}
        InitializeConnection();
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
        
        dropdownResult.appendChild(albumCover);

        labelContainer.appendChild(songLabel);
        labelContainer.appendChild(artistLabel);
        dropdownResult.appendChild(labelContainer);
        dropdownResult.addEventListener('click', function(){
            SendToSocketServer('enqueue_relay', songObj);
            resultsDropdown.style.display = "none";
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
    if (!playerInfo.active){
        ForcePlaySong()
        playerInfo.active = true;
        playerInfo.playing = true;
    }else if (roomQueue.length == 1 && playerInfo.endTimestamp - Date.now() < 5000){
        console.log('Last second queue update');
        clearTimeout(playNextSongEvent);
        NudgeExternalQueue();
    }
}

//Player related function
//Uses an API call
//Instructs the spotify API to play the first song in the room's queue
//Only called when not already playing (this song was not queued; there was no queue) 
async function ForcePlaySong(offset=0){
    const song = roomQueue.pop();
    const body = {'uris': [song.trackURI]};        
    let res = await AuthHTTPRequest('https://api.spotify.com/v1/me/player/play', {'headers':[['Content-Type','application/json']],'params':[['device_id',deviceInfo.currentDevice.id], ['offset', offset]], 'body':body},'PUT');
    if(res.code == 204){
        console.log('Playing');
        PlaySongEvent(song);
        mediaUpdater = setInterval(UpdateMediaProgress, 250);
    }else{
        console.log('Error in playing');
    }
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
        playerInfo.endTimestamp = date.getTime()
        playerInfo.duration = duration;
        playerInfo.progress = 0;
        setTimeout(SynchronizeClock, SYNCRONIZATION_BUFFER);
        playNextSongEvent = setTimeout(NudgeExternalQueue, duration - 5000);
        socket.emit('play_event', {'data':song, })
    }else{
        playerInfo.active = false;
        playerInfo.playing = false;
        clearInterval(mediaUpdater);
        current.innerText = 'SPIN ONE UP DJ...';
    }
}

//Player related function
//Uses an API call
//Sends next song in room queue to spotify queue if possible
//If not prepares to end room queue
async function NudgeExternalQueue(){
    if (roomQueue.length > 0) {
        const song = roomQueue.shift();
        let res = await AuthHTTPRequest('https://api.spotify.com/v1/me/player/queue', {'params':[['uri', song.trackURI]]},'POST');
        if(res.code == 204){
            playNextSongEvent = setTimeout(function(){PlaySongEvent(song)}, playerInfo.endTimestamp - Date.now());
        }
    }else{
        playNextSongEvent = setTimeout(function(){PlaySongEvent(null)}, playerInfo.endTimestamp - Date.now());
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
    progressSlider.value = playerInfo.progress/parseFloat(playerInfo.duration) *100;
    progressIndicator.innerText = playerInfo.progress;
    playerInfo.progress += 250;
}

function scrubMedia(val){
    console.log('Scrub: ' + val);
    progressIndicator.innerText = playerInfo.duration*val/parseFloat(100);
}

function ReleaseScrub(val){
    console.log('Final: ' + val);
    progressIndicator.innerText = playerInfo.duration*val/parseFloat(100);
}

function ScrubClick(val){
    console.log('First: ' + val);
    clearInterval(mediaUpdater)
}

//Player
async function TogglePlayback(){
    if (!playerInfo.active){
        return;
    }
    const endpoint = (playerInfo.playing)?'https://api.spotify.com/v1/me/player/pause':'https://api.spotify.com/v1/me/player/play';
    let res = await AuthHTTPRequest(endpoint, {},'PUT');
    if(res.code == 204){
        playerInfo.playing = !playerInfo.playing;
        if (playerInfo.playing){
            let timeRemaining = playerInfo.duration - playerInfo.progress;
            playNextSongEvent = setTimeout(NudgeExternalQueue, timeRemaining - 5000);
            mediaUpdater = setInterval(UpdateMediaProgress, 250);
        }else{
            clearInterval(mediaUpdater);
            clearTimeout(playNextSongEvent);
        }
        setTimeout(SynchronizePlayer, SYNCRONIZATION_BUFFER);
    }
}


async function SynchronizePlayer(){
    let res = await AuthHTTPRequest('https://api.spotify.com/v1/me/player/currently-playing', {},'GET');
    if(res.code == 200){
        res = JSON.parse(res.response);
        const correctionOffset = Date.now() - serverTimeOffset - response.timestamp - SYNCRONIZATION_BUFFER;
        console.log(correctionOffset + ' dif ' + res.progress_ms + 'ms ' + typeof(res.timestamp) + ' ' + res.is_playing);
        playerInfo.progress = (playerInfo.playing)?res.progress_ms + correctionOffset :res.progress_ms;
    }
}
//synchronizes time with spotify server time
async function SynchronizeClock(){
    let res = await AuthHTTPRequest('https://api.spotify.com/v1/me/player/currently-playing', {},'GET');
    if(res.code == 200){
        res = JSON.parse(res.response);
        serverTimeOffset = Date.now() - res.timestamp - SYNCRONIZATION_BUFFER;
        console.log('offset was ' + serverTimeOffset);
    }
}

function CallOverlay(subemenu){
    document.getElementById('backdrop').style.display = 'block';
    activeSubmenu = subemenu;
    document.getElementById('overlay').getElementsByClassName('popupSubmenu')[activeSubmenu].style.display = 'block'
}

function DismissOverlay(){
    if(!popupFocus){
        console.log(activeSubmenu);
        document.getElementById('overlay').getElementsByClassName('popupSubmenu')[activeSubmenu].style.display = 'none'
        document.getElementById('backdrop').style.display = 'none';
    }
}

async function ChooseDevice(){
    let res = await AuthHTTPRequest('https://api.spotify.com/v1/me/player/devices', {},'GET');
    if(res.code == 200){
        res = JSON.parse(res.response);
        console.log(res);
        deviceInfo.availableDevices = [];
        res.devices.forEach(device => {
                deviceInfo.availableDevices.push({'name':device.name,'id':device.id,'type':device.type})                
            }
        );
        if(deviceInfo.availableDevices.length == 1){
            deviceInfo.currentDevice = deviceInfo.availableDevices[0];
            console.log('Defaulted');
        }else{
            CallOverlay(0)
        }
    }
}
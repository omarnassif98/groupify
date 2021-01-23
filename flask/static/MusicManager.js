var mediaUpdater = null;
const progressSlider = document.getElementById('progressSlider');
const progressIndicator = document.getElementById('progress');
var serverTimeOffset;
var roomQueue = [];
var playerInfo = {'active':false,'playing':false};
var currentServerTime;

const SYNCRONIZATION_BUFFER = 500;



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
        playerInfo.endTimestamp = date.getTime();
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
        const correctionOffset = Date.now() - serverTimeOffset - res.timestamp - SYNCRONIZATION_BUFFER;
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
var popupFocus = false;
var localUserInfo;
var activeSubmenu = 0;
var deviceInfo = {'currentDevice':null, 'availableDevices':[]};
var playNextSongEvent = null;
var democracyObj = {'enabled' : true, 'voted' : false, 'roster' : {}};


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
    SongSearch(searchTerm);
}

//Search related function
//Uses API call directly if Authorized
//Queries spotify api for tracks matching search parameters
//Calls function to display each track found
async function SongSearch(term){
    var res;
    if(localUserInfo.authorized){
        res = await AuthHTTPRequest('https://api.spotify.com/v1/search', {'params':[['q', term], ['type','track']]},'GET');
    }else{
        res = await HTTPRequest(location.origin + '/guest_search', {'params':[['phrase', term]]},'GET');
    }
    if(res.code == 200){
        console.log(res);
        res = JSON.parse(res.response);
        DisplaySearchResults(res);
    }
}

function DisplaySearchResults(results){
    console.log(results);
    const resultsDropdown =document.getElementById('resultsDropdown');
    resultsDropdown.removeChild(resultsDropdown.firstChild)
    results = ParseResults(results);
    results.slice(0,4).forEach(songObj => {
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
            HandleDecision(songObj);
            resultsDropdown.style.display = "none";
        });
        resultsDropdown.appendChild(dropdownResult);
    });
    const expandResultsDiv = document.createElement('div');
    expandResultsDiv.classList.add('resultExpander');
    expandResultsDiv.appendChild(document.createTextNode("Load more results"));
    expandResultsDiv.addEventListener('click', function(){
        resultsDropdown.style.display = "none";
        DisplayExtendedSearchResults(results);
        CallOverlay(2);
    });
    resultsDropdown.appendChild(expandResultsDiv);
}

function DisplayExtendedSearchResults(results){
    const resContainer = document.getElementById("extendedResultsView");
    while(resContainer.firstChild){
        resContainer.removeChild(resContainer.firstChild)
    }
    results.forEach(songObj => {
        const resDiv = document.createElement('div');
        resDiv.classList.add("fullTrackResult")

        const resArt = document.createElement('img');
        resArt.src = songObj.artworkURL;
        resArt.classList.add('art');

        const resTitle = document.createElement('div');
        resTitle.appendChild(document.createTextNode(songObj.name));
        resTitle.classList.add("title");

        const resArtist = document.createElement('div');
        resArtist.appendChild(document.createTextNode(songObj.artist));
        resArtist.classList.add('artists')

        resDiv.appendChild(resArt);
        resDiv.appendChild(resTitle);
        resDiv.appendChild(resArtist);
        resDiv.addEventListener('click', function(){
            HandleDecision(songObj);
            resultsDropdown.style.display = "none";
        });
        resContainer.appendChild(resDiv);
    });
}

function HandleDecision(songObj){
    const command = democracyObj.enabled? 'vote_relay':'enque_relay'
    SendToSocketServer(command, songObj);
}

function AddSongCandidate(candidate){
    console.log(candidate);

    democracyObj.roster[candidate.songObj[trackURI]] = 1;
    const container = document.getElementById('nextSongs');
    const track = document.createElement('div');
    track.classList.add('trackContainer')
    const trackImg = document.createElement('img');
    trackImg.classList.add('trackArt')
    //trackImg.src = songObj.trackURI;
    track.appendChild(trackImg);
    track.addEventListener('click', function(){
        console.log(democracyObj.roster[songObj.trackURI]);
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

//overlay windows are as follows
// 0 is for showing errors connecting with spotify (only shows for authenticated users)
// 1 is for profile setup (only shows for uninitialized guest users)
// 2 is for showing expanded results
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

function EstablishConnection(){
    const username = document.getElementById('usernameEntry').value;
    if(username != ''){
        localUserInfo = {'name':username, 'authorized':false}
        InitializeConnection();
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
            CallOverlay(0);
        }
    }
}
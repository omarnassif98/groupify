const socket = io.connect('http://localhost:5000', {transports: ['websocket']});
console.log(sessionStorage.authCallback);
console.log(sessionStorage.verifier);
const roomCode = window.location.pathname.split('/').pop();
var localUserInfo = JSON.parse(sessionStorage.userProf)
localUserInfo = {'name':localUserInfo.display_name, 'socket_id': null}
console.log(localUserInfo);
//part of the socketio library
//fires upon connection to server
socket.on('connect', function(){
    localUserInfo.socket_id = socket.id
    localUserInfo.room_code = roomCode
    console.log(localUserInfo)
    socket.emit('client_join', localUserInfo);
});
//part of the socketio library
//fires upon getting message via send()
socket.on('message', (msg) =>{
    console.log(msg);
});

//user defined
//populates roster with those already in the room
//only fires once (in the beginning)
socket.on('populate_room', (roomInfo) =>{
    console.log('Populating');
    console.log(roomInfo);
    const users = roomInfo.users;
    UpdateRoomRoster(users)
});

//user defined
//adds user to roster upon their connection
//fires every single time a new user joins
socket.on('user_join', (incommingUser) =>{
    console.log('Updating');
    UpdateRoomRoster([incommingUser]);
});



//user defined
//fires upon getting a message via emit() to the 'answer' namespace
socket.on('answer', (text) =>{
    console.log('FINALLY ' + text);
});

function SongSearch(){
    const searchTerm =document.getElementById("songSearch").value;
    const endpoint = new URL('https://api.spotify.com/v1/search');
    endpoint.searchParams.append('q',searchTerm);
    endpoint.searchParams.append('type','track');
    console.log(endpoint.href);
    const queryRequest = new XMLHttpRequest();
    console.log(sessionStorage.verifier);
    queryRequest.open('GET',endpoint.href);
    queryRequest.setRequestHeader('Authorization', `Bearer ${JSON.parse(sessionStorage.authCallback).access_token}`);
    queryRequest.send();
    queryRequest.onreadystatechange = function (){
        if(queryRequest.readyState === XMLHttpRequest.DONE){
            document.getElementById('resultsDropdown').style.display = 'block';
            const queryResponse = JSON.parse(queryRequest.responseText);
            queryResponse.tracks.items.forEach(item => {
                console.log(item);
            });
            RefreshAccess();
        }
    }
}


//takes an array of userInfo objects {display name, socket id}
//Updates roster with new users' names
function UpdateRoomRoster(newUsers){
    const userList = document.getElementById('userList');
    console.log(newUsers);
    newUsers.forEach(incommingUser => {
        console.log(incommingUser);
        const newListEntry = document.createElement('li');
        if (incommingUser.socket_id == localUserInfo.socket_id){
            const boldObj = document.createElement('B');
            boldObj.appendChild(document.createTextNode(incommingUser.name))
            newListEntry.appendChild(boldObj)
        }else{
            newListEntry.appendChild(document.createTextNode(incommingUser.name))
        }
        newListEntry.setAttribute('socketIdx', incommingUser.socket_id)
        userList.appendChild(newListEntry)
    });
}

function DismissOverlay(){
    document.getElementById('backdrop').style.display = 'none';
}
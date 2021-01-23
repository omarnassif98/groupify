var socket;


if (sessionStorage.userProf){
    localUserInfo = JSON.parse(sessionStorage.userProf);
    InitializeConnection();
    if(localUserInfo.authorized){
       ChooseDevice();
    }
}else{
    popupFocus = true;
    CallOverlay(1);
    console.log('AYY LMAO YOU SKIPPED A STEP BRO');
}

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
        localUserInfo.room_code = window.location.pathname.split('/').pop();
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
        localUserInfo.isHost = (socket.id == data.ledger.host)?true:false;
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

    //updates room queue with newest track
    //The timestamp recieved in this function is actually the time when the players should play
    //(it is in the future for synchronization purposes)
    socket.on('enqueue_event', (response) => {
        console.log(response);
        console.log('goal: ' + response.timestamp + '\n' + 'now: '+ currentServerTime());
        console.log(response.timestamp-currentServerTime());
        playerInfo.latestTimestamp = response.timestamp;
        if(currentServerTime() < response.timestamp){
        setTimeout(function(){PopulateInternalQueue(response.data)},response.timestamp-currentServerTime());
        }else{
            PopulateInternalQueue(response.data);
        }
    });

    //updates whenever a vote is cast for the next song
    //response is a dictionary with the song object along with the amount of votes it has
    socket.on('vote_event', (response) =>{
        AddSongCandidate(response);
    });
}

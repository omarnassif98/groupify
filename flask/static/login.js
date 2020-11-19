const baseUrl = location.origin
sessionStorage.client_id = '192243d8b5fb45ff836d39698e189545'
userProf = {'name':'','authorized':false}
window.verifier = GenerateVerifier();
console.log(window.verifier);
var challenge;
const protoChallenge = GenerateChallenge(window.verifier);

protoChallenge.then(function(val){challenge = val;});
sessionStorage.verifier = window.verifier;
console.log('challenge and verifier generated')
//Authorizes user's spotify account, this is needed to host and also play music
//Authorization uses PKCE method
async function Authorize(){
    console.log('Spotify take the wheel...');
    const authURL = new URL('https://accounts.spotify.com/authorize')
    authURL.searchParams.append('client_id', sessionStorage.client_id);
    authURL.searchParams.append('response_type', 'code');
    authURL.searchParams.append('scope', 'user-read-private user-read-email user-read-playback-state user-modify-playback-state user-read-currently-playing')
    authURL.searchParams.append('redirect_uri', baseUrl + '/auth')
    authURL.searchParams.append('code_challenge_method', 'S256')
    authURL.searchParams.append('code_challenge', challenge)
    let popup = window.open(authURL.href,'Login with spotify', 'width=800,height=600');
    window.callback = async (payload) => {
        console.log(payload);
        popup.close();
        sessionStorage.authCallback = payload;
        payload = JSON.parse(payload);
        res = await HTTPRequest('https://api.spotify.com/v1/me', {'headers':[['Authorization', `Bearer ${payload.access_token}`]]});
        if(res!=null){
            res = JSON.parse(res.response)
            document.getElementById('UsernameEntry').value = res.display_name;
            userProf.authorized = true;
            userProf.region = res.country;
        }
        
    };
}

//Tells webserver to start a new room with this user as the host
//User needs to be authorized
function HostRoom(){
    console.log(userProf);
    if (userProf.authorized && document.getElementById('UsernameEntry').value != ''){
        const http = new XMLHttpRequest();
        userProf.name = document.getElementById('UsernameEntry').value;
        http.open('POST',baseUrl + '/host');
        http.send()
        http.onreadystatechange = function (){
            if(http.readyState === XMLHttpRequest.DONE){
                sessionStorage.userProf = JSON.stringify(userProf);
                window.location.replace(baseUrl + '/room/' + http.responseText);
            }
        }
    }
}

function JoinRoom(){
    req = async () =>{
        const roomCode = document.getElementById('RoomCodeEntry').value;
        userProf.name = document.getElementById('UsernameEntry').value;
        sessionStorage.userProf = JSON.stringify(userProf);
        res = await HTTPRequest('http://localhost:5000/attempt_room', {'params':[['code', roomCode]]});
        if(res.code==200){
            window.location.replace(baseUrl + '/room/' + roomCode);
        }else{
            //DISPLAY ERROR, NO SUCH ROOM
        }
    }
    req();
}
//Authorization related function
//Generates verifier for the PKCE process
function GenerateVerifier(){
    let array = new Uint32Array(28);
    window.crypto.getRandomValues(array);
    let transformation = Array.from(array, x => ('0' + x.toString(16)).substr(-2)).join('');
    return transformation;
}
//Authorization related function
//Encodes challenge for the PKCE process
async function GenerateChallenge(_verifier){
    const encoder = new TextEncoder();
    console.log('1 more ' + _verifier);
    const sha =await window.crypto.subtle.digest('SHA-256', encoder.encode(_verifier));
    console.log(sha);
    return btoa(String.fromCharCode.apply(null, new Uint8Array(sha))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

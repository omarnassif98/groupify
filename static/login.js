const baseUrl = location.origin
sessionStorage.client_id = '192243d8b5fb45ff836d39698e189545'
var profile = null;
window.verifier = GenerateVerifier();
var challenge;
const protoChallenge = GenerateChallenge(window.verifier);
console.log(window.verifier);
protoChallenge.then(function(val){challenge = val; console.log('Promise done')});
console.log(challenge);
console.log(protoChallenge)
sessionStorage.verifier = window.verifier;
function Authorize(){
    console.log('Spotify take the wheel...');
    const authURL = new URL('https://accounts.spotify.com/authorize')
    authURL.searchParams.append('client_id', sessionStorage.client_id);
    authURL.searchParams.append('response_type', 'code');
    authURL.searchParams.append('scope', 'user-read-private user-read-email user-read-playback-state user-modify-playback-state user-read-currently-playing')
    authURL.searchParams.append('redirect_uri', 'http://localhost:5000/auth')
    authURL.searchParams.append('code_challenge_method', 'S256')
    authURL.searchParams.append('code_challenge', challenge)
    let popup = window.open(authURL.href,'Login with spotify', 'width=800,height=600');
    window.callback = (payload) => {
        popup.close()
        sessionStorage.authCallback = payload;
        payload = JSON.parse(payload);
        let loginDiv = document.getElementById('loginDiv')
        let roomHost = document.getElementById('roomDiv')
        loginDiv.style.display = 'none'
        roomHost.style.display = 'block'
        const profGet = new XMLHttpRequest();
        profGet.open('GET','https://api.spotify.com/v1/me');
        profGet.setRequestHeader('Authorization', `Bearer ${payload.access_token}`);
        profGet.send();
        profGet.onreadystatechange = function (){
            if(profGet.readyState === XMLHttpRequest.DONE){
                let userInfo = JSON.parse(profGet.responseText)
                document.getElementById("welcomeText").innerHTML += userInfo.display_name
                sessionStorage.userProf = profGet.responseText;
                RefreshAccess();
            }
        }
    }
}

function HostRoom(){
    const http = new XMLHttpRequest();
    http.open('POST',baseUrl + '/host');
    http.send()
    http.onreadystatechange = function (){
        if(http.readyState === XMLHttpRequest.DONE){
            console.log(http.responseType);
            console.log(http.HEADERS_RECEIVED);
            console.log(http.responseXML);
            console.log(http.responseText);
            window.location.replace(baseUrl + '/room/' + http.responseText);
        }
    }
}

function GenerateVerifier(){
    let array = new Uint32Array(28);
    window.crypto.getRandomValues(array);
    let transformation = Array.from(array, x => ('0' + x.toString(16)).substr(-2)).join('');
    return transformation;
}

async function GenerateChallenge(_verifier){
    const encoder = new TextEncoder();
    const sha =await window.crypto.subtle.digest('SHA-256', encoder.encode(_verifier));
    return btoa(String.fromCharCode.apply(null, new Uint8Array(sha))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

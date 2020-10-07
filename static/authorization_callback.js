const params = new URLSearchParams(window.location.search);
const baseUrl = location.origin + location.pathname;
const auth = btoa('192243d8b5fb45ff836d39698e189545:54df42214be54bcd84d9c74defa51add')
code = params.get('code');
const verifier = window.opener.verifier;
console.log(typeof verifier)

if (code != null){
    console.log(code);
    const endpoint = 'https://accounts.spotify.com/api/token';
    const http = new XMLHttpRequest();
    http.open('POST',endpoint);
    http.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
    body ='grant_type=authorization_code&code=' + code + '&redirect_uri=http://localhost:5000/auth&client_id=192243d8b5fb45ff836d39698e189545&code_verifier=' + verifier;
    http.onreadystatechange = function (){
        if(http.readyState === XMLHttpRequest.DONE){
            window.opener.callback(http.response);
        }
    }
    http.send(body);
}


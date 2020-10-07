function RefreshAccess(){
    const refreshCall = new XMLHttpRequest();
    refreshCall.open('POST', 'https://accounts.spotify.com/api/token');
    refreshCall.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
    refreshCall.send('grant_type=refresh_token&refresh_token=' + JSON.parse(sessionStorage.authCallback).refresh_token + '&client_id=' + sessionStorage.client_id);
    refreshCall.onreadystatechange = function (){
        if(refreshCall.readyState === XMLHttpRequest.DONE){
            sessionStorage.authCallback = refreshCall.responseText;
            console.log('Refresed access token');
        }
    }
}
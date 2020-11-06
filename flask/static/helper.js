function AuthHTTPRequest(url,requestInfo, method='GET'){
    if(requestInfo['headers']){
        requestInfo.headers.push(['Authorization' ,`Bearer ${JSON.parse(sessionStorage.authCallback).access_token}`]);
    }else{
        requestInfo.headers = [['Authorization' ,`Bearer ${JSON.parse(sessionStorage.authCallback).access_token}`]];
    }
    return HTTPRequest(url,requestInfo,method);
}
function HTTPRequest(url, requestInfo, method = 'GET'){
    console.log(requestInfo);
    return new Promise(function(resolve){
        const Http = new XMLHttpRequest();
        const endpoint = new URL(url);
        if (requestInfo['params']){
            requestInfo.params.forEach(param => {
                console.log(param[0]);
                console.log(param[1]);
                endpoint.searchParams.append(param[0], param[1]);
            });
        }else{
            console.log('EYYO WHAT THE FUCK');
        }
        Http.open(method, endpoint);
        console.log('Params');
        if (requestInfo['headers']){
            requestInfo.headers.forEach(header =>{
                console.log(header);
                Http.setRequestHeader(header[0], header[1]);
            });
        }
        if (requestInfo['body']){
            Http.send(JSON.stringify(requestInfo.body));
        }else{
            Http.send();
        }
        Http.onreadystatechange = function(){
            if(Http.readyState === XMLHttpRequest.DONE){
                resolve({'code': Http.status, 'response': Http.responseText})
            }
        }
    });
}

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

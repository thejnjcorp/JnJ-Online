import { Routes, Route, Navigate, HashRouter } from 'react-router-dom';
import { useEffect, useState } from 'react';
import '../styles/App.scss';
import { Homepage } from './Homepage';
import { Blog } from './Blog';
import { Navigation } from './Navigation';
import BlogPages from './BlogPages';
import { InvalidPage } from './InvalidPage';
import { getGoogleSheetCells } from './googleSheetCellFunctions.js';
import { useGoogleLogin } from '@react-oauth/google';
import appData from './AppData.json';
import { Characters } from './Characters.js';

const delay = ms => new Promise(res => setTimeout(res, ms));

function getAccessToken() {
  return localStorage.getItem(appData.localStorageLocation);
}

async function initializeGoogleSheets() {
  window.gapi.load('client:auth2', async() => {
    await window.gapi.client.init({
      'apiKey': appData.apiKey,
      'clientId': appData.clientId,
      'scope': appData.scope
    }).catch(res => res);
  });

  /*
  // Now load the GIS client
  window.google.accounts.oauth2.initTokenClient({
    client_id: appData.apiKey,
    scope: appData.scope,
    prompt: 'consent',
    callback: (tokenResponse) => {
      accessToken = tokenResponse.accessToken;
      console.log(tokenResponse.accessToken)
    },
  });*/

  await delay(100);
  window.gapi.client.load('https://sheets.googleapis.com/$discovery/rest?version=v4');
  if (getAccessToken() !== null) {
    window.gapi.client.setToken({access_token: getAccessToken()});
  }
  await delay(500);

  const response = await getGoogleSheetCells('1TcAIoDPvix4FLdMQIDlpzBEQtcDlPBUfU8mfNVZEQek', 'Sheet1', 'A', 'A');
  return response;
}

function App() {
  const [markdowns, setMarkdowns] = useState([]);
  const [accessToken, setAccessToken] = useState(getAccessToken() ? getAccessToken() : "bogus access token");
  const [validAccessToken, setValidAccessToken] = useState(true);
  const [errorMessage, setErrorMessage] = useState({});

  const login = useGoogleLogin({
    onSuccess: tokenResponse => {
      window.gapi.client.setToken({access_token: tokenResponse.access_token});
      localStorage.setItem(appData.localStorageLocation, tokenResponse.access_token);
      setAccessToken(tokenResponse.access_token);
      setValidAccessToken(true);
    },
  });

  useEffect(() => {
    fetch('/allFileNames.txt')
      .then((r) => r.text())
      .then(text  => {
        var array = text.split(/\r?\n/);
        array.pop();
        setMarkdowns(array);
        initializeGoogleSheets();
      })
      .catch(err => console.log(err));
  },[]);

  useEffect(() => {
    const refreshTime = 1800*1000;
    const intervalId = setInterval(async () => {
      // refresh google token
      if (accessToken) {
        login();
      }
    }, refreshTime);

    return () => clearInterval(intervalId);
  }, [login, accessToken]);

  
  const routeMarkdownFiles = markdowns.map((file, index) =>
    <Route key={index} path={"blog/" + file} element={ <BlogPages post={file} /> } />
  );

  return (
    <HashRouter basename='/'>
      <div className="App">
        <div className='App-header'>
          <Navigation/>
        </div>
        {!validAccessToken && <div className='App-banner'>
          {"ERROR: " + errorMessage.code + ", " + errorMessage.message + ": " + errorMessage.status}
          <button 
          className='App-banner-button'
          onClick={() => login()}
          >
            Sign in with Google
          </button>
        </div>}
        <div className="App-body">
          <Routes>
            <Route path="*" element={ <InvalidPage/> } />
            <Route path="/" element={ <Navigate to="/home" /> } />
            <Route path="blog" element={ <Blog/> } />
            <Route path="/home" element={ <Homepage setValidAccessToken={setValidAccessToken} setErrorMessage={setErrorMessage} accessToken={accessToken} /> } />
            <Route path="/characters/*" element={ <Characters/>}/>
            {routeMarkdownFiles}
          </Routes>
        </div>
      </div>
    </HashRouter>
    
  );
}

export default App;

import { Routes, Route, Navigate, BrowserRouter } from 'react-router-dom';
import { useEffect, useState } from 'react';
import '../styles/App.scss';
import { Homepage } from './Homepage';
import { Blog } from './Blog';
import { Navigation } from './Navigation';
import BlogPages from './BlogPages';
import { InvalidPage } from './InvalidPage';
import { useGoogleLogin } from '@react-oauth/google';
import appData from './AppData.json';
import { Characters } from './Characters.js';
import { Campaigns } from './Campaigns.js';
import { AccountPage } from './AccountPage.js';
import { DirectorsPage } from './DirectorsPage.js';
import { ClassPage } from './ClassPage.js';

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

  await delay(100);
  window.gapi.client.load('https://sheets.googleapis.com/$discovery/rest?version=v4');
  window.gapi.client.load('https://www.googleapis.com/discovery/v1/apis/drive/v3/rest');
  if (getAccessToken() !== null) {
    window.gapi.client.setToken({access_token: getAccessToken()});
  }
}

function App() {
  const [markdowns, setMarkdowns] = useState([]);
  const [accessToken, setAccessToken] = useState(getAccessToken() ? getAccessToken() : "bogus access token");
  const [validAccessToken, setValidAccessToken] = useState(true);
  const [errorMessage, setErrorMessage] = useState({});
  const [accountInfo, setAccountInfo] = useState();

  const login = useGoogleLogin({
    scope: appData.scope,
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
    <BrowserRouter basename='JnJ-Online'>
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
          <button 
            className='App-banner-button'
            onClick={() => setValidAccessToken(true)}
          >
            Dismiss
          </button>
        </div>}
        <div className="App-body">
          <Routes>
            <Route path="*" element={ <InvalidPage/> } />
            <Route path="/" element={ <Navigate to="/home" /> } />
            <Route path="blog" element={ <Blog/> } />
            <Route path="/home" element={ <Homepage accountInfo={accountInfo} setAccountInfo={setAccountInfo} /> } />
            <Route path="/characters/*" element={ <Characters setValidAccessToken={setValidAccessToken} setErrorMessage={setErrorMessage} accessToken={accessToken} />}/>
            <Route path="/campaigns/*" element={ <Campaigns/> }/>
            <Route path="/account/*" element={<AccountPage accountInfo={accountInfo} setAccountInfo={setAccountInfo} /> }/>
            <Route path='/directors/*' element={<DirectorsPage/>} />
            <Route path='/classes/*' element={<ClassPage/>} />
            {routeMarkdownFiles}
          </Routes>
        </div>
      </div>
    </BrowserRouter>
    
  );
}

export default App;

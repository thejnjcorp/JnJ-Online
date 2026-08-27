import { Routes, Route, Navigate, BrowserRouter } from 'react-router-dom';
import { useEffect, useState } from 'react';
import '../styles/App.scss';
import { Homepage } from './Homepage';
import { Blog } from './Blog';
import { Navigation } from './Navigation';
import BlogPages from './BlogPages';
import { InvalidPage } from './InvalidPage';
import { Characters } from './Characters.js';
import { Campaigns } from './Campaigns.js';
import { AccountPage } from './AccountPage.js';
import { DirectorsPage } from './DirectorsPage.js';
import { ClassPage } from './ClassPage.js';
import { ClassListPage } from './ClassListPage.js';
import { StatusPage } from './StatusPage.js';
import { StatusListPage } from './StatusListPage.js';
import { auth } from '../utils/firebase.js';

// The site shell (nav + home) reads its palette from a theme class - see
// styles/themes/BaseTheme.scss for the token contract and DarkArcane.scss for
// this theme's values. Swapping themes is a matter of pointing this at a
// different class name.
const siteTheme = 'Theme-DarkArcane';

function App() {
  const [markdowns, setMarkdowns] = useState([]);
  const [userInfo, setUserInfo] = useState(null);

  useEffect(() => {
    fetch('/JnJ-Online/allFileNames.txt')
      .then((r) => r.text())
      .then(text  => {
        const array = text.split(/\r?\n/);
        array.pop();
        setMarkdowns(array);
      })
      .catch(err => console.log(err));
    const unsubscribe = auth.onAuthStateChanged((currentUser) => setUserInfo(currentUser));
    return () => unsubscribe();
  },[]);

  // The theme class has to live on <html>, not on an element inside <body>:
  // CSS custom properties only cascade to descendants, and index.scss styles
  // `body` itself (background, font). A class on .App would leave body's own
  // rules stuck reading BaseTheme's fallback values instead of this theme's.
  useEffect(() => {
    document.documentElement.classList.add(siteTheme);
    return () => document.documentElement.classList.remove(siteTheme);
  }, []);
  
  const routeMarkdownFiles = markdowns.map((file) =>
    <Route key={file} path={"blog/" + file} element={ <BlogPages post={file} /> } />
  );

  return (
    <BrowserRouter basename='JnJ-Online'>
      <div className="App">
        <div className='App-header'>
          <Navigation userInfo={userInfo} setUserInfo={setUserInfo}/>
        </div>
        <div className="App-body">
          <Routes>
            <Route path="*" element={ <InvalidPage/> } />
            <Route path="/" element={ <Navigate to="/home" /> } />
            <Route path="blog" element={ <Blog markdowns={markdowns}/> } />
            <Route path="/home" element={ <Homepage/> } />
            <Route path="/characters/*" element={ <Characters/>}/>
            <Route path="/campaigns/*" element={ <Campaigns/> }/>
            <Route path="/account/*" element={<AccountPage setUserInfo={setUserInfo}/> }/>
            <Route path='/directors/*' element={<DirectorsPage/>} />
            <Route path='/classes/*' element={<ClassPage/>} />
            <Route path='/class-list' element={<ClassListPage/>} />
            <Route path='/statuses/*' element={<StatusPage/>} />
            <Route path='/status-list' element={<StatusListPage/>} />
            {routeMarkdownFiles}
          </Routes>
        </div>
      </div>
    </BrowserRouter>
    
  );
}

export default App;

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
import { auth } from '../utils/firebase.js';

function App() {
  const [markdowns, setMarkdowns] = useState([]);
  const [userInfo, setUserInfo] = useState(null);

  useEffect(() => {
    fetch('/JnJ-Online/allFileNames.txt')
      .then((r) => r.text())
      .then(text  => {
        var array = text.split(/\r?\n/);
        array.pop();
        setMarkdowns(array);
      })
      .catch(err => console.log(err));
      // eslint-disable-next-line
    const unsubscribe = auth.onAuthStateChanged((currentUser) => setUserInfo(currentUser));
    return () => unsubscribe();
  },[]);
  
  const routeMarkdownFiles = markdowns.map((file, index) =>
    <Route key={index} path={"blog/" + file} element={ <BlogPages post={file} /> } />
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
            <Route path="/account/*" element={<AccountPage userInfo={userInfo} setUserInfo={setUserInfo}/> }/>
            <Route path='/directors/*' element={<DirectorsPage/>} />
            <Route path='/classes/*' element={<ClassPage/>} />
            <Route path='/class-list' element={<ClassListPage/>} />
            {routeMarkdownFiles}
          </Routes>
        </div>
      </div>
    </BrowserRouter>
    
  );
}

export default App;

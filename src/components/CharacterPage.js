import '../styles/CharacterPage.scss';
import 'react-tooltip/dist/react-tooltip.css';
import loadingIcon from '../icons/loading.svg';
import characterPageLayout from '../CharacterPageLayout.json';
import { useEffect, useState } from 'react';
import { CharacterPageAbilityScorePanel } from './CharacterPageAbilityScorePanel';
import { CharacterPageStatsPanel } from './CharacterPageStatsPanel';
import { CharacterPageNavigation } from './CharacterPageNavigation';
import { SkillsAndFlaws } from './SkillsAndFlaws';
import { auth, db } from '../utils/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import '../styles/CharacterPageStyles/DefaultCharacterPage.scss';
import '../styles/CharacterPageStyles/AlternativeCharacterPage.scss';
import { useLocation } from 'react-router-dom';
import { CharacterMainTab } from './CharacterMainTab';
import { onAuthStateChanged } from 'firebase/auth';

export function CharacterPage() {
    const [characterPage, setCharacterPage] = useState(characterPageLayout);
    const [loadingScreen, setLoadingScreen] = useState(true);
    const [userId, setUserId] = useState("");
    const location = useLocation();
    const pageTheme = 'DefaultCharacterPage';

    const docQuery = doc(db, "characters", location.pathname.split("/").at(2));
    
    // eslint-disable-next-line
    const unsubscribe = onSnapshot(docQuery, { includeMetadataChanges: true }, (docSnap) => {
        if (document.title !== docSnap.data().character_name) document.title = docSnap.data().character_name;
        if (docSnap.metadata.hasPendingWrites || loadingScreen) {
            setCharacterPage(prevData => ({
                ...prevData,
                ...docSnap.data(),
                character_id: location.pathname.split("/").at(2)
            }));
            setLoadingScreen(false);
        }
    });
    window.addEventListener('beforeunload', () => unsubscribe());

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (!user) return;
            setUserId(user.uid);
            unsubscribe();
        });
    }, [location])

    return <>
        {!loadingScreen && <div className={"CharacterPage " + pageTheme}>
            <div className='CharacterPage-column-div CharacterPage-skills-and-flaws SkillsAndFlawsPanelOverride'>
                {"\xa0\xa0"}Skills and Flaws<br/>
                <SkillsAndFlaws characterPage={characterPage} userId={userId}/>
            </div>
            <div className='CharacterPage-column-div CharacterPage-right-content'>
                <CharacterPageNavigation characterPage={characterPage}/>
                <CharacterPageAbilityScorePanel characterPageLayoutLive={characterPage} userId={userId}/>
                <CharacterPageStatsPanel characterPageLayoutLive={characterPage} userId={userId}/>
                <CharacterMainTab characterPage={characterPage} setCharacterPage={setCharacterPage} userId={userId}/>
            </div>
    </div>}
    {loadingScreen && <img src={loadingIcon} alt="loading" className='CharacterPage-loading-icon'/>}
    </>
}
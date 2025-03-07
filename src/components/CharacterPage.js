import '../styles/CharacterPage.scss';
import 'react-tooltip/dist/react-tooltip.css';
import loadingIcon from '../icons/loading.svg';
import characterPageLayout from '../CharacterPageLayout.json';
import { useState } from 'react';
import { CharacterPageAbilityScorePanel } from './CharacterPageAbilityScorePanel';
import { CharacterPageStatsPanel } from './CharacterPageStatsPanel';
import { CharacterPageNavigation } from './CharacterPageNavigation';
import { SkillsAndFlaws } from './SkillsAndFlaws';
import { TabContainer } from './TabContainer';
import { db } from '../utils/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import '../styles/CharacterPageStyles/DefaultCharacterPage.scss';
import '../styles/CharacterPageStyles/AlternativeCharacterPage.scss';
import { useLocation } from 'react-router-dom';
import { CharacterMainTab } from './CharacterMainTab';

export function CharacterPage() {
    const [characterPage, setCharacterPage] = useState(characterPageLayout);
    const [loadingScreen, setLoadingScreen] = useState(true);
    const location = useLocation();
    const pageTheme = 'DefaultCharacterPage';
    const docQuery = doc(db, "characters", location.pathname.split("/").at(2));
    // eslint-disable-next-line
    const docSnap = onSnapshot(docQuery, { includeMetadataChanges: true }, (docSnap) => {
        if (docSnap.metadata.hasPendingWrites || loadingScreen) {
            setCharacterPage(prevData => ({
                ...prevData,
                ...docSnap.data()
            }));
            document.title = docSnap.data().character_name;
            setLoadingScreen(false);
        }
    });

    return <>
        {!loadingScreen && <div className={"CharacterPage " + pageTheme}>
            <div className='CharacterPage-column-div CharacterPage-skills-and-flaws SkillsAndFlawsPanelOverride'>
                {"\xa0\xa0"}Skills and Flaws<br/>
                <SkillsAndFlaws characterPage={characterPage}/>
            </div>
            <div className='CharacterPage-column-div CharacterPage-right-content'>
                <CharacterPageNavigation characterPage={characterPage}/>    
                <CharacterPageAbilityScorePanel characterPageLayoutLive={characterPage}/>
                <CharacterPageStatsPanel characterPageLayoutLive={characterPage}/>
                <TabContainer tabs={CharacterMainTab(characterPage, setCharacterPage)}/>
            </div>
    </div>}
    {loadingScreen && <img src={loadingIcon} alt="loading" className='CharacterPage-loading-icon'/>}
    </>
}
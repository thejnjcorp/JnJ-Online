import '../styles/CharacterPage.scss';
import 'react-tooltip/dist/react-tooltip.css';
import loadingIcon from '../icons/loading.svg';
import characterPageLayout from '../CharacterPageLayout.json';
import { useEffect, useMemo, useState } from 'react';
import { CharacterPageAbilityScorePanel } from './CharacterPageAbilityScorePanel';
import { CharacterPageStatsPanel } from './CharacterPageStatsPanel';
import { CharacterPageNavigation } from './CharacterPageNavigation';
import { SkillsAndFlaws } from './SkillsAndFlaws';
import { auth, db } from '../utils/firebase';
import { doc, onSnapshot, query, collection, where } from 'firebase/firestore';
import '../styles/CharacterPageStyles/DefaultCharacterPage.scss';
import '../styles/CharacterPageStyles/AlternativeCharacterPage.scss';
import { useLocation } from 'react-router-dom';
import { CharacterMainTab } from './CharacterMainTab';
import { onAuthStateChanged } from 'firebase/auth';

export function CharacterPage() {
    const [characterPage, setCharacterPage] = useState(characterPageLayout);
    const [campaignId, setCampaignId] = useState("placeholder");
    const [campaignInfo, setCampaignInfo] = useState({
        enemy_list: [],
        ally_combat_npc_list: [],
        neutral_combat_npc_list: [],
        active_map: null,
        maps: [],
    });
    const [characterList, setCharacterList] = useState([]);
    const [loadingScreen, setLoadingScreen] = useState(true);
    const [userId, setUserId] = useState("");
    const location = useLocation();
    const pageTheme = 'DefaultCharacterPage';

    const docQuery = useMemo(() => doc(db, "characters", location.pathname.split("/").at(2)), [location.pathname]);
    const campaignDocQuery = useMemo(() => doc(db, "campaigns", campaignId), [campaignId]);
    const charactersQuery = useMemo(() => query(collection(db, "characters"), where("campaign", "==", campaignId)), [campaignId]);
    
    useEffect(() => {
        // eslint-disable-next-line
        const unsubscribe = onSnapshot(docQuery, { includeMetadataChanges: true }, (docSnap) => {
            if (document.title !== docSnap.data().character_name) document.title = docSnap.data().character_name;
            if (docSnap.metadata.hasPendingWrites || loadingScreen) {
                setCharacterPage(prevData => ({
                    ...prevData,
                    ...docSnap.data(),
                    character_id: location.pathname.split("/").at(2)
                }));
                setCampaignId(docSnap.data().campaign);
                setLoadingScreen(false);
            }
        });
        return () => unsubscribe();
        // eslint-disable-next-line
    }, [docQuery, location.pathname]);

    useEffect(() => {
        if (campaignId !== "placeholder") {
            // eslint-disable-next-line
            const unsubscribe = onSnapshot(campaignDocQuery, (docSnap) => {
                if (docSnap.metadata.hasPendingWrites || campaignInfo !== docSnap.data()) {
                    setCampaignInfo(docSnap.data());
                }
            });
            return () => unsubscribe();
        }
        // eslint-disable-next-line
    }, [campaignDocQuery]);

    useEffect(() => {
        if (campaignId !== "placeholder") {
            // eslint-disable-next-line
            const unsubscribe = onSnapshot(campaignDocQuery, (docSnap) => {
                if (docSnap.metadata.hasPendingWrites || campaignInfo !== docSnap.data()) {
                    setCampaignInfo(docSnap.data());
                }
            });
            return () => unsubscribe();
        }
        // eslint-disable-next-line
    }, [campaignDocQuery]);

    useEffect(() => {
        if (campaignId !== "placeholder") {
            // eslint-disable-next-line
            const unsubscribe = onSnapshot(charactersQuery, (querySnapshot) => {
                if (querySnapshot.metadata.hasPendingWrites || characterList.length === 0) {
                    setCharacterList(querySnapshot.docs.map(doc => ({character_id: doc.id, ...doc.data()})));
                }
            });
            return () => unsubscribe();
        }
        // eslint-disable-next-line
    }, [charactersQuery]);

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
                <CharacterMainTab characterPage={characterPage} userId={userId} characterList={characterList} campaignInfo={campaignInfo} />
            </div>
    </div>}
    {loadingScreen && <img src={loadingIcon} alt="loading" className='CharacterPage-loading-icon'/>}
    </>
}
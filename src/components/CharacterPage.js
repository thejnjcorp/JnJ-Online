import '../styles/CharacterPage.scss';
import 'react-tooltip/dist/react-tooltip.css';
import loadingIcon from '../icons/loading.svg';
import characterPageLayout from '../CharacterPageLayout.json';
import { useEffect, useMemo, useState } from 'react';
import { CharacterPageVitalsPanel } from './CharacterPageVitalsPanel';
import { CharacterPageNavigation } from './CharacterPageNavigation';
import { SkillsAndFlaws } from './SkillsAndFlaws';
import { auth, db } from '../utils/firebase';
import { doc, onSnapshot, query, collection, where } from 'firebase/firestore';
import '../styles/CharacterPageStyles/DefaultCharacterPage.scss';
import '../styles/CharacterPageStyles/AlternativeCharacterPage.scss';
import { useLocation } from 'react-router-dom';
import { CharacterMainTab } from './CharacterMainTab';
import { onAuthStateChanged } from 'firebase/auth';
import { useIsMobile } from '../utils/useIsMobile';
import { ReactComponent as ChevronDownIcon } from '../icons/chevron_down.svg';

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
    const [skillsDrawerOpen, setSkillsDrawerOpen] = useState(false);
    const location = useLocation();
    const pageTheme = 'DefaultCharacterPage';
    const isMobile = useIsMobile();

    const docQuery = useMemo(() => doc(db, "characters", location.pathname.split("/").at(2)), [location.pathname]);
    // campaignId is "placeholder" until the character doc loads, then either a
    // real campaign ID or null (a character with no campaign field, e.g.
    // created before that field existed). doc()/query() below must not run for
    // either "not loaded yet" or "confirmed none" - doc(db, "campaigns", null)
    // throws synchronously (Firestore rejects an empty path segment), which
    // would crash the whole page before a "join a campaign" prompt ever had a
    // chance to render.
    const hasCampaign = campaignId !== "placeholder" && campaignId !== null;
    const campaignDocQuery = useMemo(() => hasCampaign ? doc(db, "campaigns", campaignId) : null, [campaignId, hasCampaign]);
    const charactersQuery = useMemo(() => hasCampaign ? query(collection(db, "characters"), where("campaign", "==", campaignId)) : null, [campaignId, hasCampaign]);

    useEffect(() => {
        const unsubscribe = onSnapshot(docQuery, { includeMetadataChanges: true }, (docSnap) => {
            if (document.title !== docSnap.data().character_name) document.title = docSnap.data().character_name;
            if (docSnap.metadata.hasPendingWrites || loadingScreen) {
                setCharacterPage(prevData => ({
                    ...prevData,
                    ...docSnap.data(),
                    character_id: location.pathname.split("/").at(2)
                }));
                setCampaignId(docSnap.data().campaign || null);
                setLoadingScreen(false);
            }
        });
        return () => unsubscribe();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [docQuery, location.pathname]);

    useEffect(() => {
        if (!campaignDocQuery) return;
        const unsubscribe = onSnapshot(campaignDocQuery, (docSnap) => {
            if (docSnap.metadata.hasPendingWrites || campaignInfo !== docSnap.data()) {
                setCampaignInfo(docSnap.data());
            }
        });
        return () => unsubscribe();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [campaignDocQuery]);

    useEffect(() => {
        if (!charactersQuery) return;
        const unsubscribe = onSnapshot(charactersQuery, (querySnapshot) => {
            if (querySnapshot.metadata.hasPendingWrites || characterList.length === 0) {
                setCharacterList(querySnapshot.docs.map(doc => ({character_id: doc.id, ...doc.data()})));
            }
        });
        return () => unsubscribe();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [charactersQuery]);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (!user) return;
            setUserId(user.uid);
            unsubscribe();
        });
    }, [location])

    const skillsCount = characterPage.skills_and_flaws.filter(item => item.isSkill).length;
    const flawsCount = characterPage.skills_and_flaws.length - skillsCount;

    return <>
        {!loadingScreen && <div className={"CharacterPage " + pageTheme}>
            {isMobile
                ? <button type="button" className='CharacterPage-skills-summary-button' onClick={() => setSkillsDrawerOpen(true)}>
                    <span>Skills &amp; Flaws · {skillsCount} · {flawsCount}</span>
                    <ChevronDownIcon className='CharacterPage-skills-summary-chevron'/>
                </button>
                : <div className='CharacterPage-skills-and-flaws SkillsAndFlawsPanelOverride'>
                    <SkillsAndFlaws characterPage={characterPage} userId={userId}/>
                </div>}
            <div className='CharacterPage-right-content'>
                <CharacterPageNavigation characterPage={characterPage} userId={userId}/>
                <CharacterPageVitalsPanel characterPageLayoutLive={characterPage} userId={userId}/>
                <CharacterMainTab characterPage={characterPage} userId={userId} characterList={characterList} campaignInfo={campaignInfo} />
            </div>
            {/* Mobile only: Skills & Flaws content is unchanged, just moved into a
                slide-up drawer instead of the persistent sidebar - see
                design/character-page-v2 section 9. */}
            {isMobile && skillsDrawerOpen && <>
                <button
                    type="button"
                    className='CharacterPage-skills-drawer-scrim'
                    aria-label="Close"
                    onClick={() => setSkillsDrawerOpen(false)}
                />
                <div className='CharacterPage-skills-drawer SkillsAndFlawsPanelOverride'>
                    <button type="button" className='CharacterPage-skills-drawer-close' onClick={() => setSkillsDrawerOpen(false)}>×</button>
                    <SkillsAndFlaws characterPage={characterPage} userId={userId}/>
                </div>
            </>}
    </div>}
    {loadingScreen && <img src={loadingIcon} alt="loading" className='CharacterPage-loading-icon'/>}
    </>
}
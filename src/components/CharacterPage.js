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
import { DocAdminManager } from './DocAdminManager';
import { LevelUpPrompt } from './LevelUpPrompt';
import { CharacterAdminButton } from './CharacterAdmin';
import { useClassVersion, useRaceVersion } from '../utils/useClassVersion';
import { resolveCharacter } from '../utils/characterClass';

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

    // Class data (actions, base AC/hit/healing, class name) and race data
    // (name, racial actions) come from the versions this character is pinned
    // to, not from the copies made at creation - see useClassVersion.js. Everything below renders
    // `character`; writes still go straight to the character doc by field, so
    // nothing derived here is ever written back.
    const classInfo = useClassVersion(characterPage.class_id, characterPage.class_version);
    const raceInfo = useRaceVersion(characterPage.race_id, characterPage.race_version);
    const character = useMemo(
        () => resolveCharacter(characterPage, classInfo.classData, raceInfo.raceData),
        [characterPage, classInfo.classData, raceInfo.raceData]
    );

    const skillsCount = character.skills_and_flaws.filter(item => item.isSkill).length;
    const flawsCount = character.skills_and_flaws.length - skillsCount;

    return <>
        {!loadingScreen && <div className={"CharacterPage " + pageTheme}>
            {isMobile
                ? <button type="button" className='CharacterPage-skills-summary-button' onClick={() => setSkillsDrawerOpen(true)}>
                    <span>Skills &amp; Flaws · {skillsCount} · {flawsCount}</span>
                    <ChevronDownIcon className='CharacterPage-skills-summary-chevron'/>
                </button>
                : <div className='CharacterPage-skills-and-flaws SkillsAndFlawsPanelOverride'>
                    <SkillsAndFlaws characterPage={character} userId={userId}/>
                </div>}
            <div className='CharacterPage-right-content'>
                <CharacterPageNavigation characterPage={character} userId={userId} classInfo={classInfo} raceInfo={raceInfo}/>
                <LevelUpPrompt character={character} userId={userId}/>
                <CharacterAdminButton character={character} campaignInfo={campaignInfo} userId={userId}/>
                <CharacterPageVitalsPanel characterPageLayoutLive={character} userId={userId}/>
                <CharacterMainTab characterPage={character} userId={userId} characterList={characterList} campaignInfo={campaignInfo} />
                <DocAdminManager docRef={docQuery} admins={characterPage.admins} userId={userId}/>
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
                    <SkillsAndFlaws characterPage={character} userId={userId}/>
                </div>
            </>}
    </div>}
    {loadingScreen && <img src={loadingIcon} alt="loading" className='CharacterPage-loading-icon'/>}
    </>
}
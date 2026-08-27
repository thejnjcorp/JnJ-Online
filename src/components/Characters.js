import { useEffect, useState } from "react";
import '../styles/Characters.scss';
import { useNavigate, useLocation } from "react-router-dom";
import { CharacterPage } from "./CharacterPage";
import { getDocs, query, collection, where, or, documentId } from "firebase/firestore";
import { auth, db } from "../utils/firebase";
import { onAuthStateChanged } from "firebase/auth";
import loadingIcon from '../icons/loading.svg';

// Firestore 'in' queries cap at 30 values per query.
const FIRESTORE_IN_LIMIT = 30;

export function Characters() {
    const [characterList, setCharacterList] = useState([]);
    const [campaignNames, setCampaignNames] = useState({});
    const [campaignNamesLoaded, setCampaignNamesLoaded] = useState(false);
    // "loading" | "signed-out" | "ready" - distinguishes "nothing has loaded
    // yet" from "we checked, there's genuinely nothing here", and lets a
    // signed-out visitor get a real message instead of a silently empty grid.
    const [status, setStatus] = useState("loading");
    const navigate = useNavigate();
    const location = useLocation();
    document.title = "Characters";

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (!user) {
                setStatus("signed-out");
                return;
            }
            getCharacterList(user);
        });
        return () => unsubscribe();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    },[])

    async function getCharacterList(user) {
        const characters = query(collection(db, "characters"), or(where("playerId", "==", user.uid), where("canRead", "array-contains", user.uid), where("canWrite", "array-contains", user.uid)));
        const querySnapshotCharacters = await getDocs(characters);
        const list = querySnapshotCharacters?.docs?.map(doc => ({
            id: doc.id,
            character_name: doc.data().character_name,
            player_name: doc.data().player_name,
            class: doc.data().class,
            campaign: doc.data().campaign,
            navigation_color: doc.data().navigation_color
        })) || [];
        setCharacterList(list);
        setStatus("ready");
        loadCampaignNames(list);
    }

    // Character docs only store the campaign's document ID (see
    // NewCharacterPage.js), not its name, so the card needs a second lookup to
    // show something a player recognizes instead of a raw Firestore ID.
    async function loadCampaignNames(list) {
        const ids = [...new Set(list.map(c => c.campaign).filter(Boolean))];
        if (ids.length === 0) {
            setCampaignNamesLoaded(true);
            return;
        }
        try {
            const chunks = [];
            for (let i = 0; i < ids.length; i += FIRESTORE_IN_LIMIT) chunks.push(ids.slice(i, i + FIRESTORE_IN_LIMIT));
            const names = {};
            for (const chunk of chunks) {
                const snap = await getDocs(query(collection(db, "campaigns"), where(documentId(), "in", chunk)));
                snap.docs.forEach(doc => { names[doc.id] = doc.data().campaign_name; });
            }
            setCampaignNames(names);
        } catch (e) {
            console.log("Failed to resolve campaign names: " + e);
        }
        setCampaignNamesLoaded(true);
    }

    function handleCharacterCardSelect(character) {
        navigate("/characters/" + character.id)
    }

    function campaignLabel(character) {
        if (!character.campaign) return null;
        if (!campaignNamesLoaded) return "Loading campaign…";
        return campaignNames[character.campaign] || "Unknown Campaign";
    }

    return <div>
        {location.pathname.endsWith('characters') && <div className="Character-page">
            <div className="Characters-title">
                Characters
            </div>

            {status === "signed-out" && <div className="Characters-empty-state">
                Sign in to see your characters.
            </div>}

            {status === "loading" && <img src={loadingIcon} alt="Loading" className="Characters-loading-icon"/>}

            {status === "ready" && <div className="Characters-grid">
                {characterList.map((character) =>
                    <button type="button"
                        className='CharacterCard'
                        key={character.id}
                        onClick={() => handleCharacterCardSelect(character)}
                        style={character.navigation_color ? {"--character-accent": character.navigation_color} : undefined}
                    >
                        <div className="CharacterCard-name">{character.character_name}</div>
                        <div className="CharacterCard-small-text">
                            {character.class}<br/>
                            Player: {character.player_name}<br/>
                            {character.campaign && <>Campaign: {campaignLabel(character)}</>}
                        </div>
                    </button>
                )}
                <button type="button" className='CharacterCard CharacterCard-create' onClick={() => navigate("/campaigns")}>
                    + Create one from a campaign
                </button>
                {characterList.length === 0 && <div className="Characters-empty-state Characters-empty-state-grid">
                    No characters yet.
                </div>}
            </div>}
        </div>}
        {!location.pathname.endsWith('characters') &&
            <CharacterPage/>}
    </div>
}

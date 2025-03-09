import { useState, useEffect } from "react";
import '../styles/Characters.scss';
import { useNavigate } from "react-router-dom";
import { CharacterPage } from "./CharacterPage";
import { useLocation } from "react-router-dom";
import { getDocs, query, collection } from "firebase/firestore";
import { db } from "../utils/firebase";

export function Characters() {
    const [characterList, setCharacterList] = useState([]);
    const navigate = useNavigate();
    const location = useLocation();
    document.title = "Characters";

    useEffect(() => {
        getCharacterList();
        // eslint-disable-next-line
    },[]);

    async function getCharacterList() {
        const characters = query(collection(db, "characters"));
        const querySnapshotCharacters = await getDocs(characters);
        const campaigns = query(collection(db, "campaigns"));
        const querySnapshotCampaigns = await getDocs(campaigns);
        const campaignAssociation = new Map(querySnapshotCampaigns.docs.map(doc => [doc.id, doc.data().campaign_name]));
        setCharacterList(querySnapshotCharacters.docs.map(doc => ({
            id: doc.id, 
            character_name: doc.data().character_name,
            player_name: doc.data().player_name,
            class: doc.data().class,
            campaigns: doc.data().campaigns.map(campaign_id => campaignAssociation.get(campaign_id))
        })));
    }

    function handleCharacterCardSelect(character) {
        navigate("/characters/" + character.id)
    }

    return <div>
        {location.pathname.endsWith('characters') && <div className="Character-page">
            <div className="Characters-title">
                Characters
            </div>
            {characterList.map((character, index) =>
            <button className='CharacterCard' key={index} onClick={() => handleCharacterCardSelect(character)}>
                    {character.character_name}<br/>
                    <div className="CharacterCard-small-text">
                        {character.class}<br/>
                        Player: {character.player_name}<br/>
                        {"Campaign(s): " + character.campaigns.map((campaign, index) => {
                            if (!index) return campaign;
                            return ", " + campaign;
                        })}
                    </div>
                </button>
            )}
        </div>}
        {!location.pathname.endsWith('characters') && 
            <CharacterPage/>}
    </div>
}
import { useEffect, useState } from "react";
import '../styles/Characters.scss';
import { useNavigate } from "react-router-dom";
import { CharacterPage } from "./CharacterPage";
import { useLocation } from "react-router-dom";
import { getDocs, query, collection, where, or } from "firebase/firestore";
import { auth, db } from "../utils/firebase";
import { onAuthStateChanged } from "firebase/auth";

export function Characters() {
    const [characterList, setCharacterList] = useState([]);
    const navigate = useNavigate();
    const location = useLocation();
    document.title = "Characters";

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (!user) return;
            getCharacterList(user);
            unsubscribe();
        });
    },[])
    

    async function getCharacterList(user) {
        const characters = query(collection(db, "characters"), or(where("playerId", "==", user.uid), where("canRead", "array-contains", user.uid), where("canWrite", "array-contains", user.uid)));
        const querySnapshotCharacters = await getDocs(characters);
        setCharacterList(querySnapshotCharacters?.docs?.map(doc => ({
            id: doc.id, 
            character_name: doc.data().character_name,
            player_name: doc.data().player_name,
            class: doc.data().class,
            campaign: doc.data().campaign
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
                        Campaign: {character.campaign}
                    </div>
                </button>
            )}
        </div>}
        {!location.pathname.endsWith('characters') && 
            <CharacterPage/>}
    </div>
}
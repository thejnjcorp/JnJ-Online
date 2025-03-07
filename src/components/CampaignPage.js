import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { collection, getDocs, getDoc, doc, where, query } from "firebase/firestore";
import { db } from "../utils/firebase";
import '../styles/CampaignPage.scss';

export function CampaignPage() {
    const [characterList, setCharacterList] = useState([]);
    const [campaignInfo, setCampaignInfo] = useState({director_name: "placeholder", campaign_name: "placeholder"});
    const navigate = useNavigate();
    const location = useLocation();

    const getCharacterList = async() => {
        const docSnap = await getDoc(doc(db, "campaigns", location.pathname.split("/").at(2)));
        setCampaignInfo(docSnap.data());
        document.title = docSnap.data().campaign_name;
        const characters = query(collection(db, "characters"), where("campaigns", "array-contains", location.pathname.split("/").at(2)));
        const querySnapshot = await getDocs(characters);
        setCharacterList(querySnapshot.docs.map(doc => ({id: doc.id, ...doc.data()})));
    }

    useEffect(() => {
        getCharacterList();
        // eslint-disable-next-line
    },[location]);

    return <div className="CampaignPage">
        <div className="Campaigns-title">
            {campaignInfo.campaign_name}
        </div>
        {characterList.map((character, index) =>
            <button className='CharacterCard' key={index} onClick={() => navigate("/characters/" + character.id)}>
                {character.character_name}<br/>
                <div className="CharacterCard-small-text">
                    {character.class}<br/>
                    Player: {character.player_name}<br/>
                </div>
            </button>
        )}
        <br/>
        <button className='CharacterCard' onClick={() => navigate("/directors/" + location.pathname.split("/").at(2))}>
            Director Mode<br/>
        </button>
        <br/>
        <button className='CharacterCard' onClick={() => navigate(location.pathname.split("/").at(2) + "/newCharacter")}>
            New Character
        </button>
    </div>
}
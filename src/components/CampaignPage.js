import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { collection, getDocs, getDoc, doc, where, query, getCountFromServer, documentId, updateDoc, arrayUnion } from "firebase/firestore";
import { auth, db } from "../utils/firebase";
import '../styles/CampaignPage.scss';
import { onAuthStateChanged } from "firebase/auth";

export function CampaignPage() {
    const [characterList, setCharacterList] = useState([]);
    const [campaignInfo, setCampaignInfo] = useState({director_name: "placeholder", campaign_name: "placeholder"});
    const [visibleAddPlayerScreen, setVisibleAddPlayerScreen] = useState(false);
    const [playerId, setPlayerId] = useState("");
    const navigate = useNavigate();
    const location = useLocation();

    const getCharacterList = async() => {
        const docSnap = await getDoc(doc(db, "campaigns", location.pathname.split("/").at(2)));
        setCampaignInfo(docSnap.data());
        document.title = docSnap.data().campaign_name;
        const characters = query(collection(db, "characters"), where("canRead", "array-contains", auth.currentUser.uid));
        const querySnapshot = await getDocs(characters);
        const tempSnapshot = querySnapshot.docs.filter(doc => doc.data().campaigns.includes(location.pathname.split("/").at(2)));
        setCharacterList(tempSnapshot.map(doc => ({id: doc.id, ...doc.data()})));
    }

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (!user) return;
            getCharacterList();
            unsubscribe();
        });
        
        // eslint-disable-next-line
    },[location]);

    const handleNewPlayer = async() => {
        if (playerId === auth.currentUser.uid) return alert("Cannot add yourself as a player!");
        const player = query(collection(db, "players"), where(documentId(), '==', playerId));
        try {
            await getCountFromServer(player);
            alert("Error: player does not exist!")
        } catch (error) {
            if (error.message !== "Missing or insufficient permissions.") alert(error);
            try {
                await updateDoc(doc(db, "campaigns", location.pathname.split("/").at(2)), {
                    canRead: arrayUnion(playerId)
                });
                alert("Added player!");
            } catch (error) {
                alert(error);
            }
        }
        setVisibleAddPlayerScreen(false);
    }

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
        {campaignInfo?.canWrite?.includes(auth.currentUser.uid) && <>
            <button className='CharacterCard' onClick={() => setVisibleAddPlayerScreen(true)}>
                Add a Player
            </button>
            <br/>
            {visibleAddPlayerScreen && <div className="Campaigns-new-player-div">
                <h2>Player ID:</h2>
                <input
                    className="Campaign-new-player-input"
                    type="text"
                    required
                    name="player_id"
                    onChange={(e) => setPlayerId(e.target.value)}
                    placeholder="Player ID"
                />
                <button className="Campaign-new-player-button" onClick={() => handleNewPlayer()}>
                    Submit
                </button>
            </div>}
        </>}
        <button className='CharacterCard' onClick={() => navigate(location.pathname.split("/").at(2) + "/newCharacter")}>
            New Character
        </button>
    </div>
}
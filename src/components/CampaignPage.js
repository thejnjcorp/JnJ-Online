import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { collection, getDocs, getDoc, doc, where, query, getCountFromServer, documentId, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { auth, db } from "../utils/firebase";
import '../styles/CampaignPage.scss';
import { onAuthStateChanged } from "firebase/auth";

export function CampaignPage() {
    const [characterList, setCharacterList] = useState([]);
    const [campaignInfo, setCampaignInfo] = useState({director_name: "placeholder", campaign_name: "placeholder", players: []});
    const [visibleAddPlayerScreen, setVisibleAddPlayerScreen] = useState(false);
    const [visibleKickPlayerScreen, setVisibleKickPlayerScreen] = useState(false);
    const [playerId, setPlayerId] = useState("");
    const navigate = useNavigate();
    const location = useLocation();
    const divRef = useRef(null);

    const getCharacterList = async() => {
        const docSnap = await getDoc(doc(db, "campaigns", location.pathname.split("/").at(2)));
        setCampaignInfo(docSnap.data());
        document.title = docSnap.data().campaign_name;
        const characters = query(collection(db, "characters"), where("campaign", "==", location.pathname.split("/").at(2)));
        const querySnapshot = await getDocs(characters);
        // console.log(querySnapshot)
        setCharacterList(querySnapshot.docs.map(doc => ({id: doc.id, ...doc.data()})));
    }

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (!user) return;
            getCharacterList();
            unsubscribe();
        });
        document.addEventListener('mousedown', clickOutsidePopupScreen);

        return () => {
            document.removeEventListener('mousedown', clickOutsidePopupScreen);
        }
        // eslint-disable-next-line
    },[location]);

    const handleNewPlayer = async() => {
        if (playerId === auth.currentUser.uid) return alert("Cannot add yourself as a player!");
        const player = query(collection(db, "players"), where(documentId(), '==', playerId));
        try {
            const count = await getCountFromServer(player);
            if (count.data().count === 0) {
                alert("Error: player does not exist!")
            } else {
                const playerDoc = await getDoc(doc(db, "players", playerId))
                await updateDoc(doc(db, "campaigns", location.pathname.split("/").at(2)), {
                    canRead: arrayUnion(playerId),
                    players: arrayUnion({name: playerDoc.data().name, uid: playerId})
                });
                alert("Added player!");
                getCharacterList();
            }
        } catch (error) {
            alert(error);
        }
        setVisibleAddPlayerScreen(false);
    }

    const handleKickPlayer = async(name, playerId) => {
        try {
            await updateDoc(doc(db, "campaigns", location.pathname.split("/").at(2)), {
                canRead: arrayRemove(playerId),
                players: arrayRemove({name: name, uid: playerId})
            });
            alert("Kicked player!");
            getCharacterList();
        } catch (error) {
            alert(error);
        }
        setVisibleKickPlayerScreen(false);
    }

    const clickOutsidePopupScreen = (event) => {
        if (divRef.current && !divRef.current.contains(event.target)) {
            setVisibleAddPlayerScreen(false);
            setVisibleKickPlayerScreen(false);
        }
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
        <button className='CharacterCard' onClick={() => navigate(location.pathname.split("/").at(2) + "/newCharacter")}>
            New Character
        </button>
        <br/>
        <button className='CharacterCard' onClick={() => navigate("/directors/" + location.pathname.split("/").at(2))}>
            Director Mode<br/>
        </button>
        <br/>
        <div>
            <h2>Players</h2>
            {campaignInfo?.players?.map((player, index) => 
            <div key={index}>
                {player.name} {`<${player.uid}> `}
                {campaignInfo?.canWrite?.includes(auth.currentUser.uid) && 
                <button className="Campaigns-kick-button" onClick={() => setVisibleKickPlayerScreen(true)}>Kick Player</button>}
                {visibleKickPlayerScreen && <div className="Campaigns-kick-player-div" ref={divRef}>
                <h3>Are you sure you want to kick this player?</h3>
                Player: {player.name} {`<${player.uid}> `}<br/>
                <button className="Campaign-kick-player-button" onClick={() => handleKickPlayer(player.name, player.uid)}>
                    Yes
                </button>
                <button className="Campaign-kick-player-button" onClick={() => setVisibleKickPlayerScreen(false)}>
                    No
                </button>
            </div>}
            </div>)}
        </div>
        {campaignInfo?.canWrite?.includes(auth.currentUser.uid) && <>
            <button className='CharacterCard' onClick={() => setVisibleAddPlayerScreen(true)}>
                Add a Player
            </button>
            <br/>
            {visibleAddPlayerScreen && <div className="Campaigns-new-player-div" ref={divRef}>
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
    </div>
}
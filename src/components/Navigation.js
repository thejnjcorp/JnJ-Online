import { Link } from "react-router-dom";
import { auth, db } from "../utils/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import '../styles/Navigation.scss';
import defaultProfileIcon from '../icons/default_profile.svg';
import { signInWithGooglePopup } from "../utils/firebase";
import { useState } from "react";

export function Navigation({userInfo, setUserInfo}) {
    const [newPlayerInfoScreen, setNewPlayerInfoScreen] = useState(false);
    const [playerName, setPlayerName] = useState("");
    const logGoogleUser = async() => {
        try {
            const response = await signInWithGooglePopup();
            const user = response.user;
            const userData = await getDoc(doc(db, "players", user.uid));
            if (userData.exists()) {
                console.log("the user exists!")
                setUserInfo(response.user);
                setNewPlayerInfoScreen(false);
                console.log(user.uid)
            } else {
                console.log("user does not exist, making a new player!")
                setNewPlayerInfoScreen(true);
            }
        } catch(error) {
            console.log(error);
        }
    }

    async function handleNewPlayer() {
        try {
            if (auth.currentUser === null) throw new Error("No Current user is found!");
            await setDoc(doc(db, "players", auth.currentUser.uid), {
                name: playerName,
                characters: [],
                campaigns: []
            });
            setUserInfo(auth.currentUser);
            setNewPlayerInfoScreen(false);
        } catch(error) {
            console.log(error)
            console.log("Error adding Player!")
        }
    }

    return <nav className="Navigation">
        <Link to="/home" className="Navigation-button">Home</Link>
        <Link to="/blog" className="Navigation-button">Blog</Link>
        <Link to="/characters" className="Navigation-button">Characters</Link>
        <Link to="/class-list" className="Navigation-button">Class List</Link>
        <Link to="/campaigns" className="Navigation-button">Campaigns</Link>
        <Link to="/account" className="Navigation-button">Account</Link>
        <button onClick={logGoogleUser} className="Navigation-button">
            Sign In
            <img src={userInfo?.photoURL || defaultProfileIcon} 
                alt={userInfo?.displayName || 'User'}
                className="Navigation-user-icon"
            />
        </button>
        {userInfo?.uid && <span>UID: {userInfo?.uid}</span>}
        {newPlayerInfoScreen && <div className="Navigation-new-player">
            <h1>New Account:</h1>
            <input
                className="Navigation-new-player-input"
                type="text"
                required
                name="name"
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="player name"
            />
            <button className="Navigation-new-player-button" onClick={() => handleNewPlayer()}>
                Submit
            </button>
        </div>}
    </nav>
}

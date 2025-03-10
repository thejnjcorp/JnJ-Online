import { Link } from "react-router-dom";
import '../styles/Navigation.scss';
import defaultProfileIcon from '../icons/default_profile.svg';
import { signInWithGooglePopup } from "../utils/firebase";

export function Navigation({userInfo, setUserInfo}) {
    const logGoogleUser = async() => {
        try {
            const response = await signInWithGooglePopup();
            setUserInfo(response.user);
        } catch(error) {
            console.log(error);
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
    </nav>
}

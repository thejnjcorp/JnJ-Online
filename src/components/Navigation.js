import { Link, NavLink, useLocation } from "react-router-dom";
import { auth, db } from "../utils/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";
import '../styles/Navigation.scss';
import defaultProfileIcon from '../icons/default_profile.svg';
import { signInWithGooglePopup } from "../utils/firebase";
import { useEffect, useRef, useState } from "react";

const NAV_LINKS = [
    { to: "/home", label: "Home" },
    { to: "/characters", label: "Characters" },
    { to: "/campaigns", label: "Campaigns" },
    { to: "/class-list", label: "Classes" },
    { to: "/blog/JnJ_Ruleset", label: "Rules" },
];

export function Navigation({userInfo, setUserInfo}) {
    const [newPlayerInfoScreen, setNewPlayerInfoScreen] = useState(false);
    const [playerName, setPlayerName] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [menuOpen, setMenuOpen] = useState(false);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [copiedId, setCopiedId] = useState(false);
    const menuRef = useRef(null);
    const location = useLocation();

    // The players doc holds the name the table knows you by, which is not
    // necessarily the Google account name.
    useEffect(() => {
        if (!userInfo?.uid) return setDisplayName("");
        let cancelled = false;
        getDoc(doc(db, "players", userInfo.uid))
            .then(snap => { if (!cancelled && snap.exists()) setDisplayName(snap.data().name); })
            .catch(error => console.log(error));
        return () => { cancelled = true; };
    }, [userInfo?.uid]);

    // Any navigation closes whatever was open.
    useEffect(() => {
        setMenuOpen(false);
        setDrawerOpen(false);
    }, [location]);

    useEffect(() => {
        if (!menuOpen) return;
        const clickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false);
        };
        const onEscape = (event) => { if (event.key === "Escape") setMenuOpen(false); };
        document.addEventListener('mousedown', clickOutside);
        document.addEventListener('keydown', onEscape);
        return () => {
            document.removeEventListener('mousedown', clickOutside);
            document.removeEventListener('keydown', onEscape);
        };
    }, [menuOpen]);

    const logGoogleUser = async() => {
        try {
            const response = await signInWithGooglePopup();
            const user = response.user;
            const userData = await getDoc(doc(db, "players", user.uid));
            if (userData.exists()) {
                setUserInfo(response.user);
                setNewPlayerInfoScreen(false);
            } else {
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

    async function handleSignOut() {
        try {
            await signOut(auth);
            setUserInfo(null);
        } catch (error) {
            console.log(error);
        }
        setMenuOpen(false);
    }

    // Directors add players to a campaign by pasting their player ID, so the ID
    // needs to be reachable - just not printed into the bar the way it was.
    async function handleCopyPlayerId() {
        try {
            await navigator.clipboard.writeText(userInfo.uid);
            setCopiedId(true);
            setTimeout(() => setCopiedId(false), 1600);
        } catch (error) {
            console.log(error);
        }
    }

    const navLinks = NAV_LINKS.map(link =>
        <NavLink
            key={link.to}
            to={link.to}
            className={({isActive}) => isActive ? "Navigation-button Navigation-button-active" : "Navigation-button"}
        >
            {link.label}
        </NavLink>
    );

    return <nav className="Navigation">
        <Link to="/home" className="Navigation-brand">
            <img src={`${process.env.PUBLIC_URL}/JnJProfilePic192.png`} alt="" className="Navigation-brand-mark" />
            <span className="Navigation-brand-name">JnJ<span className="Navigation-brand-name-accent">Online</span></span>
        </Link>

        <div className="Navigation-links">
            {navLinks}
        </div>

        <div className="Navigation-account" ref={menuRef}>
            {!userInfo && <button onClick={logGoogleUser} className="Navigation-signin">
                Sign In
            </button>}
            {userInfo && <>
                <button
                    className="Navigation-avatar-button"
                    onClick={() => setMenuOpen(open => !open)}
                    aria-expanded={menuOpen}
                    aria-haspopup="menu"
                >
                    <img
                        src={userInfo.photoURL || defaultProfileIcon}
                        alt={displayName || userInfo.displayName || 'User'}
                        className="Navigation-user-icon"
                    />
                    <span className="Navigation-avatar-name">{displayName || userInfo.displayName}</span>
                </button>
                {menuOpen && <div className="Navigation-menu" role="menu">
                    <div className="Navigation-menu-header">
                        <div className="Navigation-menu-name">{displayName || userInfo.displayName}</div>
                        <div className="Navigation-menu-email">{userInfo.email}</div>
                    </div>
                    <Link to="/account" className="Navigation-menu-item" role="menuitem">Account</Link>
                    <button className="Navigation-menu-item" role="menuitem" onClick={handleCopyPlayerId}>
                        {copiedId ? "Player ID copied" : "Copy Player ID"}
                    </button>
                    <button className="Navigation-menu-item Navigation-menu-item-danger" role="menuitem" onClick={handleSignOut}>
                        Sign Out
                    </button>
                </div>}
            </>}

            <button
                className="Navigation-hamburger"
                onClick={() => setDrawerOpen(open => !open)}
                aria-expanded={drawerOpen}
                aria-label="Menu"
            >
                <span/><span/><span/>
            </button>
        </div>

        {drawerOpen && <div className="Navigation-drawer">
            {navLinks}
            {userInfo && <NavLink to="/account" className="Navigation-button">Account</NavLink>}
        </div>}

        {newPlayerInfoScreen && <>
            <div className="Navigation-scrim"/>
            <div className="Navigation-new-player">
                <h1>Create your player</h1>
                <p className="Navigation-new-player-help">
                    This is the name your table will see on characters and campaign rosters.
                </p>
                <input
                    className="Navigation-new-player-input"
                    type="text"
                    required
                    name="name"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    placeholder="Player name"
                />
                <button
                    className="Navigation-new-player-button"
                    onClick={() => handleNewPlayer()}
                    disabled={playerName.trim() === ""}
                >
                    Create Player
                </button>
            </div>
        </>}
    </nav>
}

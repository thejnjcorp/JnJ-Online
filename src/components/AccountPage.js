import { useState, useEffect } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { auth, db } from '../utils/firebase';
import { collection, where, getDoc, doc, getDocs, query, or, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from "firebase/auth";
import defaultProfileIcon from '../icons/default_profile.svg';
import '../styles/AccountPage.scss';

async function getCampaigns(user) {
    try {
        const campaigns = query(collection(db, "campaigns"), or(where("canRead", "array-contains", user.uid), where("canWrite", "array-contains", user.uid)));
        const querySnapshot = await getDocs(campaigns);
        return querySnapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
    } catch (e) {
        console.log("Failed to get campaign info: " + e)
        return [];
    }
}

async function getCharacters(user) {
    try {
        const characters = query(collection(db, "characters"), where("playerId", "==", user.uid));
        const querySnapshot = await getDocs(characters);
        return querySnapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
    } catch (e) {
        console.log("Failed to get character info: " + e)
        return [];
    }
}

export function AccountPage({setUserInfo}) {
    // Tracked independently from the App-level userInfo prop, which starts as
    // null both before auth resolves and after a confirmed sign-out - trusting
    // it here would redirect a signed-in user home for a frame on every
    // refresh, before App's own listener catches up. undefined means "auth
    // hasn't resolved yet"; null means "confirmed signed out".
    const [user, setUser] = useState(undefined);
    const [accountInfo, setAccountInfo] = useState(null);
    const [editingName, setEditingName] = useState(false);
    const [nameDraft, setNameDraft] = useState("");
    const [savingName, setSavingName] = useState(false);
    const [copiedId, setCopiedId] = useState(false);
    const navigate = useNavigate();
    document.title = "Account";

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (authUser) => {
            setUser(authUser || null);
            if (authUser) getAccountInfo(authUser);
        });
        return () => unsubscribe();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    },[]);

    async function getAccountInfo(user) {
        try {
            const docSnapPlayer = await getDoc(doc(db, "players", user.uid));
            const [campaigns, characters] = await Promise.all([getCampaigns(user), getCharacters(user)]);
            const docAccountInfo = {
                ...docSnapPlayer.data(),
                campaigns,
                characters
            }
            setAccountInfo(docAccountInfo);
            setNameDraft(docAccountInfo.name || "");
        } catch(e) {
            console.log("Failed to get account info: " + e)
        }
    }

    async function handleSaveName() {
        const trimmed = nameDraft.trim();
        if (trimmed === "" || trimmed === accountInfo?.name) return setEditingName(false);
        setSavingName(true);
        try {
            await updateDoc(doc(db, "players", user.uid), { name: trimmed });
            setAccountInfo(prev => ({...prev, name: trimmed}));
            setEditingName(false);
        } catch (e) {
            console.log("Failed to update name: " + e)
        }
        setSavingName(false);
    }

    async function handleCopyPlayerId() {
        try {
            await navigator.clipboard.writeText(user.uid);
            setCopiedId(true);
            setTimeout(() => setCopiedId(false), 1600);
        } catch (e) {
            console.log(e);
        }
    }

    async function handleSignOut() {
        try {
            await signOut(auth);
            setUserInfo(null);
            navigate("/home");
        } catch (e) {
            console.log(e);
        }
    }

    if (user === undefined) return <div className="AccountPage AccountPage-loading"/>;

    if (user === null) return <Navigate to="/home" replace/>;

    if (accountInfo === null) return <div className="AccountPage AccountPage-loading"/>;

    return <div className="AccountPage">
        <section className="AccountPage-profile">
            <img
                src={user?.photoURL || defaultProfileIcon}
                alt={accountInfo?.name || user?.displayName || 'User'}
                className="AccountPage-avatar"
            />
            <div className="AccountPage-profile-details">
                {!editingName && <div className="AccountPage-name-row">
                    <h1 className="AccountPage-name">{accountInfo?.name || user?.displayName}</h1>
                    <button type="button"
                        className="AccountPage-edit-name-button"
                        onClick={() => { setNameDraft(accountInfo?.name || ""); setEditingName(true); }}
                    >
                        Edit
                    </button>
                </div>}
                {editingName && <div className="AccountPage-name-row">
                    <input
                        className="AccountPage-name-input"
                        type="text"
                        value={nameDraft}
                        onChange={(e) => setNameDraft(e.target.value)}
                        autoFocus
                    />
                    <button type="button"
                        className="AccountPage-save-name-button"
                        onClick={handleSaveName}
                        disabled={savingName || nameDraft.trim() === ""}
                    >
                        Save
                    </button>
                    <button type="button" className="AccountPage-cancel-name-button" onClick={() => setEditingName(false)}>
                        Cancel
                    </button>
                </div>}
                <div className="AccountPage-email">{user?.email}</div>
                <button type="button" className="AccountPage-copy-id-button" onClick={handleCopyPlayerId}>
                    {copiedId ? "Player ID copied" : `Player ID: ${user?.uid}`}
                </button>
            </div>
            <button type="button" className="AccountPage-signout-button" onClick={handleSignOut}>Sign Out</button>
        </section>

        <AccountSection
            title="Your Characters"
            emptyText="You haven't made a character yet."
            createTo="/campaigns"
            createLabel="Start one from a campaign"
        >
            {accountInfo?.characters?.map((character) =>
                <Link to={`/characters/${character.id}`} className="AccountPage-entity-card" key={character.id}>
                    <div className="AccountPage-entity-card-title">{character.character_name}</div>
                    <div className="AccountPage-entity-card-meta">
                        {character.class}{character.campaign ? ` · ${character.campaign}` : ""}
                    </div>
                </Link>
            )}
        </AccountSection>

        <AccountSection
            title="Your Campaigns"
            emptyText="You're not part of a campaign yet."
            createTo="/campaigns/new"
            createLabel="Create a Campaign"
        >
            {accountInfo?.campaigns?.map((campaign) =>
                <Link to={`/campaigns/${campaign.id}`} className="AccountPage-entity-card" key={campaign.id}>
                    <div className="AccountPage-entity-card-title">{campaign.campaign_name}</div>
                    <div className="AccountPage-entity-card-meta">Director: {campaign.director_name}</div>
                </Link>
            )}
        </AccountSection>
    </div>
}

function AccountSection({title, emptyText, createTo, createLabel, children}) {
    const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
    return <section className="AccountPage-section">
        <div className="AccountPage-section-header">
            <h2>{title}</h2>
            <Link to={createTo} className="AccountPage-section-create">+ {createLabel}</Link>
        </div>
        <div className="AccountPage-section-list">
            {hasChildren ? children : <p className="AccountPage-empty">{emptyText}</p>}
        </div>
    </section>
}

import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { collection, getDocs, getDoc, doc, where, query, getCountFromServer, documentId, updateDoc, arrayUnion, arrayRemove, deleteField, serverTimestamp, Timestamp } from "firebase/firestore";
import { auth, db } from "../utils/firebase";
import '../styles/CampaignPage.scss';
import { onAuthStateChanged } from "firebase/auth";
import loadingIcon from '../icons/loading.svg';

// campaigns.players holds three different shapes across live data: the
// current { name, uid } map (e.g. PentGuard), a bare uid string, or a
// Firestore DocumentReference (both seen on "Orto" - a legacy campaign
// predating the { name, uid } convention). Only the map shape is something
// handleKickPlayer's arrayRemove can reliably reverse, since arrayRemove
// needs an exact value match - so this also flags which entries are safe to
// offer a Kick button for.
function resolvePlayerDisplay(rawPlayer) {
    if (rawPlayer && typeof rawPlayer === "object" && "name" in rawPlayer && "uid" in rawPlayer) {
        return { name: rawPlayer.name, uid: rawPlayer.uid, kickable: true };
    }
    if (typeof rawPlayer === "string") {
        return { name: null, uid: rawPlayer, kickable: false };
    }
    if (rawPlayer?.id) {
        // Firestore DocumentReference
        return { name: null, uid: rawPlayer.id, kickable: false };
    }
    return { name: null, uid: null, kickable: false };
}

export function CampaignPage() {
    const [characterList, setCharacterList] = useState([]);
    // undefined = not fetched yet, null = confirmed the campaign doesn't
    // exist (stale/deleted link), object = loaded.
    const [campaignInfo, setCampaignInfo] = useState(undefined);
    const [visibleAddPlayerScreen, setVisibleAddPlayerScreen] = useState(false);
    const [visibleKickPlayerScreen, setVisibleKickPlayerScreen] = useState(false);
    const [visibleScheduleDeletionScreen, setVisibleScheduleDeletionScreen] = useState(false);
    const [kickTarget, setKickTarget] = useState(null);
    const [playerId, setPlayerId] = useState("");
    const [addingPlayer, setAddingPlayer] = useState(false);
    // Distinguishes "haven't checked auth yet" from "confirmed signed out" -
    // see the same pattern in AccountPage.js and why trusting a prop here
    // would flash-redirect a signed-in user on refresh.
    const [user, setUser] = useState(undefined);
    const navigate = useNavigate();
    const location = useLocation();
    const divRef = useRef(null);
    const campaignId = location.pathname.split("/").at(2);

    const getCharacterList = async() => {
        const docSnap = await getDoc(doc(db, "campaigns", campaignId));
        if (!docSnap.exists()) {
            setCampaignInfo(null);
            document.title = "Campaign Not Found";
            return;
        }
        setCampaignInfo(docSnap.data());
        document.title = docSnap.data().campaign_name;
        const characters = query(collection(db, "characters"), where("campaign", "==", campaignId));
        const querySnapshot = await getDocs(characters);
        setCharacterList(querySnapshot.docs.map(doc => ({id: doc.id, ...doc.data()})));
    }

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (authUser) => {
            setUser(authUser || null);
            if (authUser) getCharacterList();
        });
        document.addEventListener('mousedown', clickOutsidePopupScreen);

        return () => {
            unsubscribe();
            document.removeEventListener('mousedown', clickOutsidePopupScreen);
        }
        // eslint-disable-next-line
    },[location]);

    const canWrite = Boolean(user?.uid && campaignInfo?.canWrite?.includes(user.uid));

    const handleNewPlayer = async() => {
        if (playerId === user.uid) return alert("Cannot add yourself as a player!");
        const player = query(collection(db, "players"), where(documentId(), '==', playerId));
        setAddingPlayer(true);
        try {
            const count = await getCountFromServer(player);
            if (count.data().count === 0) {
                alert("Error: player does not exist!")
            } else {
                const playerDoc = await getDoc(doc(db, "players", playerId))
                await updateDoc(doc(db, "campaigns", campaignId), {
                    canRead: arrayUnion(playerId),
                    players: arrayUnion({name: playerDoc.data().name, uid: playerId})
                });
                getCharacterList();
                setPlayerId("");
                setVisibleAddPlayerScreen(false);
            }
        } catch (error) {
            alert(error);
        }
        setAddingPlayer(false);
    }

    const handleKickPlayer = async(name, uid) => {
        try {
            await updateDoc(doc(db, "campaigns", campaignId), {
                canRead: arrayRemove(uid),
                players: arrayRemove({name: name, uid: uid})
            });
            getCharacterList();
        } catch (error) {
            alert(error);
        }
        setKickTarget(null);
        setVisibleKickPlayerScreen(false);
    }

    const handleArchive = async() => {
        try {
            await updateDoc(doc(db, "campaigns", campaignId), {
                archived: true,
                archivedAt: serverTimestamp()
            });
            getCharacterList();
        } catch (error) {
            alert(error);
        }
    }

    // Unarchiving is a full reset back to active - it also cancels any
    // pending deletion, since "restore this campaign" shouldn't leave a
    // countdown quietly still running toward deleting it.
    const handleUnarchive = async() => {
        try {
            await updateDoc(doc(db, "campaigns", campaignId), {
                archived: false,
                archivedAt: deleteField(),
                scheduledDeletionAt: deleteField()
            });
            getCharacterList();
        } catch (error) {
            alert(error);
        }
    }

    const handleScheduleDeletion = async() => {
        try {
            await updateDoc(doc(db, "campaigns", campaignId), {
                scheduledDeletionAt: Timestamp.fromMillis(Date.now() + 30 * 24 * 60 * 60 * 1000)
            });
            getCharacterList();
        } catch (error) {
            alert(error);
        }
        setVisibleScheduleDeletionScreen(false);
    }

    const handleCancelDeletion = async() => {
        try {
            await updateDoc(doc(db, "campaigns", campaignId), {
                scheduledDeletionAt: deleteField()
            });
            getCharacterList();
        } catch (error) {
            alert(error);
        }
    }

    const clickOutsidePopupScreen = (event) => {
        if (divRef.current && !divRef.current.contains(event.target)) {
            setVisibleAddPlayerScreen(false);
            setVisibleKickPlayerScreen(false);
            setVisibleScheduleDeletionScreen(false);
        }
    }

    if (user === null) return <div className="CampaignPage CampaignPage-empty-state">
        Sign in to see this campaign.
    </div>;

    if (user === undefined || campaignInfo === undefined) return <img src={loadingIcon} alt="Loading" className="CampaignPage-loading-icon"/>;

    if (campaignInfo === null) return <div className="CampaignPage CampaignPage-empty-state">
        This campaign doesn't exist, or you don't have access to it.
    </div>;

    return <div className="CampaignPage">
        <div className="CampaignPage-title">
            {campaignInfo.campaign_name}
        </div>

        {campaignInfo.archived && <div className="CampaignPage-archived-banner">
            This campaign is archived.
            {campaignInfo.scheduledDeletionAt && <> It's scheduled for permanent deletion on{" "}
                {campaignInfo.scheduledDeletionAt.toDate().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}.
            </>}
        </div>}

        <div className="CampaignPage-character-grid">
            {characterList.map((character, index) =>
                <button className='CharacterCard' key={index} onClick={() => navigate("/characters/" + character.id)}>
                    <div className="CharacterCard-name">{character.character_name}</div>
                    <div className="CharacterCard-small-text">
                        {character.class}<br/>
                        Player: {character.player_name}
                    </div>
                </button>
            )}
            <button className='CharacterCard CharacterCard-create' onClick={() => navigate("/campaigns/" + campaignId + "/newCharacter")}>
                + New Character
            </button>
        </div>

        <div className="CampaignPage-actions">
            <button className='CampaignPage-secondary-button' onClick={() => navigate("/directors/" + campaignId)}>
                Director Mode
            </button>
            <button className='CampaignPage-secondary-button' onClick={() => navigate("/campaigns/" + campaignId + "/classes")}>
                Manage Classes
            </button>
            <button className='CampaignPage-secondary-button' onClick={() => navigate("/campaigns/" + campaignId + "/statuses")}>
                Manage Statuses
            </button>
        </div>

        <section className="CampaignPage-players">
            <div className="CampaignPage-players-header">
                <h2>Players</h2>
                {canWrite && <button className="CampaignPage-add-player-button" onClick={() => setVisibleAddPlayerScreen(true)}>
                    + Add a Player
                </button>}
            </div>
            {campaignInfo?.players?.length > 0 ? <div className="CampaignPage-players-list">
                {campaignInfo.players.map((rawPlayer, index) => {
                    const player = resolvePlayerDisplay(rawPlayer);
                    return <div className="CampaignPage-player-row" key={index}>
                        <span className="CampaignPage-player-name">{player.name || "Unknown Player"}</span>
                        <span className="CampaignPage-player-id">{player.uid || "—"}</span>
                        {canWrite && player.kickable && <button
                            className="CampaignPage-kick-button"
                            onClick={() => { setKickTarget(player); setVisibleKickPlayerScreen(true); }}
                        >
                            Kick
                        </button>}
                        {canWrite && !player.kickable && <span
                            className="CampaignPage-player-legacy-note"
                            title="This player record predates the current format and can't be removed here."
                        >
                            Legacy record
                        </span>}
                    </div>
                })}
            </div> : <p className="CampaignPage-empty-text">No players yet.</p>}
        </section>

        {canWrite && <section className="CampaignPage-danger-zone">
            <h2>Danger Zone</h2>

            {!campaignInfo.archived && <div className="CampaignPage-danger-row">
                <div>
                    <div className="CampaignPage-danger-title">Archive this campaign</div>
                    <p className="CampaignPage-danger-help">Hides it from the main campaigns list. Fully reversible.</p>
                </div>
                <button className="CampaignPage-danger-button" onClick={handleArchive}>Archive</button>
            </div>}

            {campaignInfo.archived && <div className="CampaignPage-danger-row">
                <div>
                    <div className="CampaignPage-danger-title">Unarchive</div>
                    <p className="CampaignPage-danger-help">Restores it to the main campaigns list{campaignInfo.scheduledDeletionAt ? " and cancels the scheduled deletion." : "."}</p>
                </div>
                <button className="CampaignPage-danger-button" onClick={handleUnarchive}>Unarchive</button>
            </div>}

            {campaignInfo.archived && !campaignInfo.scheduledDeletionAt && <div className="CampaignPage-danger-row">
                <div>
                    <div className="CampaignPage-danger-title">Schedule deletion</div>
                    <p className="CampaignPage-danger-help">Permanently deletes this campaign in 30 days. Its characters are kept - just unlinked, not deleted. You can cancel any time before then.</p>
                </div>
                <button className="CampaignPage-danger-button CampaignPage-danger-button-severe" onClick={() => setVisibleScheduleDeletionScreen(true)}>
                    Schedule Deletion
                </button>
            </div>}

            {campaignInfo.archived && campaignInfo.scheduledDeletionAt && <div className="CampaignPage-danger-row">
                <div>
                    <div className="CampaignPage-danger-title">Cancel deletion</div>
                    <p className="CampaignPage-danger-help">Keeps the campaign archived, but stops the countdown.</p>
                </div>
                <button className="CampaignPage-danger-button" onClick={handleCancelDeletion}>Cancel Deletion</button>
            </div>}
        </section>}

        {visibleScheduleDeletionScreen && <>
            <div className="CampaignPage-scrim"/>
            <div className="CampaignPage-dialog" ref={divRef}>
                <h3>Schedule deletion?</h3>
                <p className="CampaignPage-dialog-help">
                    "{campaignInfo.campaign_name}" will be permanently deleted in 30 days. Its characters won't be
                    deleted - they'll just be unlinked from this campaign. You can cancel any time before then.
                </p>
                <div className="CampaignPage-dialog-actions">
                    <button className="CampaignPage-dialog-button CampaignPage-dialog-button-danger" onClick={handleScheduleDeletion}>
                        Schedule Deletion
                    </button>
                    <button className="CampaignPage-dialog-button" onClick={() => setVisibleScheduleDeletionScreen(false)}>
                        Cancel
                    </button>
                </div>
            </div>
        </>}

        {visibleKickPlayerScreen && <>
            <div className="CampaignPage-scrim"/>
            <div className="CampaignPage-dialog" ref={divRef}>
                <h3>Kick {kickTarget?.name}?</h3>
                <p className="CampaignPage-dialog-help">They'll lose access to this campaign and its characters.</p>
                <div className="CampaignPage-dialog-actions">
                    <button className="CampaignPage-dialog-button CampaignPage-dialog-button-danger" onClick={() => handleKickPlayer(kickTarget.name, kickTarget.uid)}>
                        Kick Player
                    </button>
                    <button className="CampaignPage-dialog-button" onClick={() => setVisibleKickPlayerScreen(false)}>
                        Cancel
                    </button>
                </div>
            </div>
        </>}

        {visibleAddPlayerScreen && <>
            <div className="CampaignPage-scrim"/>
            <div className="CampaignPage-dialog" ref={divRef}>
                <h3>Add a Player</h3>
                <p className="CampaignPage-dialog-help">Paste the player's ID - they can copy it from their Account page.</p>
                <input
                    className="CampaignPage-dialog-input"
                    type="text"
                    required
                    name="player_id"
                    value={playerId}
                    onChange={(e) => setPlayerId(e.target.value)}
                    placeholder="Player ID"
                    autoFocus
                />
                <div className="CampaignPage-dialog-actions">
                    <button
                        className="CampaignPage-dialog-button CampaignPage-dialog-button-primary"
                        onClick={() => handleNewPlayer()}
                        disabled={addingPlayer || playerId.trim() === ""}
                    >
                        {addingPlayer ? "Adding…" : "Add Player"}
                    </button>
                    <button className="CampaignPage-dialog-button" onClick={() => { setVisibleAddPlayerScreen(false); setPlayerId(""); }}>
                        Cancel
                    </button>
                </div>
            </div>
        </>}
    </div>
}

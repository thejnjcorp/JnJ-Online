import { useEffect, useState } from 'react';
import { collection, documentId, getCountFromServer, getDocs, query, updateDoc, where, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../utils/firebase';
import '../styles/DocAdminManager.scss';

const FIRESTORE_IN_LIMIT = 30;

// A document's admins are the only ones who can change who else can read,
// write, or administer it (see firestore.rules) - this is that management
// UI. Entirely invisible to anyone not already listed in `admins`, so a
// regular collaborator never even sees that the tier exists.
//
// `onChanged` is only needed by pages that load their document with a
// one-time getDoc/getDocs rather than a live onSnapshot listener (ClassPage,
// StatusPage, CampaignPage as of this writing) - an onSnapshot-backed page
// picks up the write automatically and can omit it.
export function DocAdminManager({ docRef, admins, userId, onChanged }) {
    const [playerNames, setPlayerNames] = useState({});
    const [namesLoaded, setNamesLoaded] = useState(false);
    const [newAdminId, setNewAdminId] = useState('');
    const [promoting, setPromoting] = useState(false);
    const [revokingId, setRevokingId] = useState(null);

    const adminList = admins || [];
    const isViewerAdmin = adminList.includes(userId);

    // Character docs resolve campaign names the same way (see Characters.js)
    // - a document only stores the bare uid, not a name a person recognizes.
    useEffect(() => {
        if (!isViewerAdmin) return;
        let cancelled = false;
        async function loadNames() {
            if (adminList.length === 0) {
                setNamesLoaded(true);
                return;
            }
            try {
                const chunks = [];
                for (let i = 0; i < adminList.length; i += FIRESTORE_IN_LIMIT) chunks.push(adminList.slice(i, i + FIRESTORE_IN_LIMIT));
                const names = {};
                for (const chunk of chunks) {
                    const snap = await getDocs(query(collection(db, 'players'), where(documentId(), 'in', chunk)));
                    snap.docs.forEach(d => { names[d.id] = d.data().name; });
                }
                if (!cancelled) setPlayerNames(names);
            } catch (e) {
                console.log('Failed to resolve admin names: ' + e);
            }
            if (!cancelled) setNamesLoaded(true);
        }
        loadNames();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isViewerAdmin, adminList.join(',')]);

    if (!isViewerAdmin) return null;

    async function handlePromote() {
        const trimmed = newAdminId.trim();
        if (!trimmed) return;
        if (adminList.includes(trimmed)) return alert('That person is already an admin.');
        setPromoting(true);
        try {
            const count = await getCountFromServer(query(collection(db, 'players'), where(documentId(), '==', trimmed)));
            if (count.data().count === 0) {
                alert('Error: player does not exist!');
            } else {
                await updateDoc(docRef, { admins: arrayUnion(trimmed) });
                setNewAdminId('');
                onChanged?.();
            }
        } catch (e) {
            alert(e);
        }
        setPromoting(false);
    }

    async function handleRevoke(uid) {
        if (adminList.length <= 1) return; // never leave a document with no admin at all
        if (!window.confirm('Remove admin access for this person? They can still read/write normally if listed elsewhere (canRead/canWrite).')) return;
        setRevokingId(uid);
        try {
            await updateDoc(docRef, { admins: arrayRemove(uid) });
            onChanged?.();
        } catch (e) {
            alert(e);
        }
        setRevokingId(null);
    }

    return <div className="DocAdminManager">
        <div className="DocAdminManager-title">Admins</div>
        <p className="DocAdminManager-hint">Admins can change who can read, write, or administer this document. Only visible to admins.</p>
        <ul className="DocAdminManager-list">
            {adminList.map(uid =>
                <li className="DocAdminManager-row" key={uid}>
                    <span className="DocAdminManager-name">{namesLoaded ? (playerNames[uid] || 'Unknown Player') : 'Loading…'}</span>
                    <span className="DocAdminManager-uid">{uid}</span>
                    <button type="button"
                        className="DocAdminManager-revoke-button"
                        onClick={() => handleRevoke(uid)}
                        disabled={adminList.length <= 1 || revokingId === uid}
                    >
                        {revokingId === uid ? 'Removing…' : 'Revoke'}
                    </button>
                </li>
            )}
        </ul>
        <div className="DocAdminManager-promote-row">
            <input
                className="DocAdminManager-promote-input"
                type="text"
                value={newAdminId}
                onChange={e => setNewAdminId(e.target.value)}
                placeholder="Player ID"
            />
            <button type="button"
                className="DocAdminManager-promote-button"
                onClick={handlePromote}
                disabled={promoting || newAdminId.trim() === ''}
            >
                {promoting ? 'Promoting…' : 'Promote to Admin'}
            </button>
        </div>
    </div>;
}

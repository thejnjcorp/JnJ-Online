import { useCallback, useEffect, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { sortPages } from './useDirectorNotes';
import { subscribeShared } from './sharedSnapshot';

// The party's shared notebook: one document per page in
// campaigns/{campaignId}/party_notes, which everyone in the campaign - players and
// directors - can read and write (see the party_notes rule in firestore.rules). It
// works like the director's notebook (useDirectorNotes.js), with each page also
// remembering who made it and who last changed it, since more than one person writes
// in it.

const who = () => ({ uid: auth?.currentUser?.uid || '', name: auth?.currentUser?.displayName || '' });

// status: 'loading' | 'ready' | 'error'
export function usePartyNotes(campaignId) {
    const [pages, setPages] = useState([]);
    const [status, setStatus] = useState('loading');

    useEffect(() => {
        if (!campaignId) return undefined;
        setStatus('loading');
        // shared, so every view of the notebook is one listener (see sharedSnapshot.js)
        return subscribeShared(
            `party_notes:${campaignId}`,
            publish => onSnapshot(
                collection(db, 'campaigns', campaignId, 'party_notes'),
                snapshot => publish({ pages: sortPages(snapshot.docs.map(page => ({ id: page.id, ...page.data() }))), status: 'ready' }),
                error => {
                    console.log('Failed to load party notes: ' + error);
                    publish({ pages: [], status: 'error' });
                },
            ),
            state => { setPages(state.pages); setStatus(state.status); },
        );
    }, [campaignId]);

    const createPage = useCallback(async (title = 'New page') => {
        const author = who();
        const ref = await addDoc(collection(db, 'campaigns', campaignId, 'party_notes'), {
            title,
            body: '',
            order: Date.now(),
            author_uid: author.uid,
            author_name: author.name,
            updated_by_name: author.name,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
        return ref.id;
    }, [campaignId]);

    const savePage = useCallback((pageId, changes) => {
        const author = who();
        return updateDoc(doc(db, 'campaigns', campaignId, 'party_notes', pageId), {
            ...changes,
            updated_by_uid: author.uid,
            updated_by_name: author.name,
            updatedAt: serverTimestamp(),
        });
    }, [campaignId]);

    const deletePage = useCallback(pageId => deleteDoc(doc(db, 'campaigns', campaignId, 'party_notes', pageId)), [campaignId]);

    return { pages, status, createPage, savePage, deletePage };
}

// The party's notebook, worded for the whole party rather than the directors.
export const PARTY_NOTES_TEXT = {
    heading: 'Party notes',
    intro: 'A notebook the whole party shares - everyone in the campaign can read and write in it. Make a page for each thing you want to remember, like a session, a person you met or a place you have been.',
    errorText: "Couldn't load the party notes. Check your connection and that you're in this campaign.",
    storagePrefix: 'jnj-party-notes-page',
};

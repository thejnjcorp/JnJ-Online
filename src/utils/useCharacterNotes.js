import { useCallback, useEffect, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { sortPages } from './useDirectorNotes';

// A player's own private notebook for their character: one document per page
// in characters/{characterId}/notes (see the rule in firestore.rules - the
// character's owner and co-writers only, not the whole campaign the way the
// character doc's own current_health/statuses/etc. are, and not even the
// campaign's director unless they also happen to be a co-writer). Same
// page-per-document pattern as useDirectorNotes.js/usePartyNotes.js.
//
// createPage takes an optional starting body - used once, to carry over
// whatever was in the character's old single-field notes into a first page
// (see CharacterNotes.js), so nothing already written gets lost when a
// character's notebook is opened for the first time.

// status: 'loading' | 'ready' | 'error'
export function useCharacterNotes(characterId) {
    const [pages, setPages] = useState([]);
    const [status, setStatus] = useState('loading');

    useEffect(() => {
        if (!characterId) return undefined;
        setStatus('loading');
        const unsubscribe = onSnapshot(
            collection(db, 'characters', characterId, 'notes'),
            (snapshot) => {
                setPages(sortPages(snapshot.docs.map(page => ({ id: page.id, ...page.data() }))));
                setStatus('ready');
            },
            (error) => {
                console.log('Failed to load character notes: ' + error);
                setStatus('error');
            },
        );
        return () => unsubscribe();
    }, [characterId]);

    const createPage = useCallback(async (title = 'New page', body = '') => {
        const ref = await addDoc(collection(db, 'characters', characterId, 'notes'), {
            title,
            body,
            order: Date.now(),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
        return ref.id;
    }, [characterId]);

    const savePage = useCallback((pageId, changes) => (
        updateDoc(doc(db, 'characters', characterId, 'notes', pageId), { ...changes, updatedAt: serverTimestamp() })
    ), [characterId]);

    const deletePage = useCallback((pageId) => (
        deleteDoc(doc(db, 'characters', characterId, 'notes', pageId))
    ), [characterId]);

    return { pages, status, createPage, savePage, deletePage };
}

import { useCallback, useEffect, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

// A campaign's Director's Page notebook: one document per page in
// campaigns/{campaignId}/notes (see the notes rule in firestore.rules - only
// the campaign's directors can read or write these; players never can).
// Kept in a subcollection rather than on the campaign doc because players can
// read that doc, and because each page then saves on its own instead of
// rewriting every page on every keystroke.

// Pages in the order they were made, oldest first; anything without an order
// (shouldn't happen) sinks to the end, and ties fall back to the title.
export function sortPages(pages) {
    return [...pages].sort((a, b) => {
        const byOrder = (a.order ?? Infinity) - (b.order ?? Infinity);
        if (byOrder !== 0 && !Number.isNaN(byOrder)) return byOrder;
        return String(a.title || '').localeCompare(String(b.title || ''));
    });
}

// status: 'loading' | 'ready' | 'error'
export function useDirectorNotes(campaignId) {
    const [pages, setPages] = useState([]);
    const [status, setStatus] = useState('loading');

    useEffect(() => {
        if (!campaignId) return undefined;
        setStatus('loading');
        const unsubscribe = onSnapshot(
            collection(db, 'campaigns', campaignId, 'notes'),
            (snapshot) => {
                setPages(sortPages(snapshot.docs.map(page => ({ id: page.id, ...page.data() }))));
                setStatus('ready');
            },
            (error) => {
                console.log('Failed to load director notes: ' + error);
                setStatus('error');
            },
        );
        return () => unsubscribe();
    }, [campaignId]);

    // Resolves to the new page's id. Date.now() as the order keeps pages in
    // creation order even when two devices add one at the same time.
    const createPage = useCallback(async (title = 'New page') => {
        const ref = await addDoc(collection(db, 'campaigns', campaignId, 'notes'), {
            title,
            body: '',
            order: Date.now(),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
        return ref.id;
    }, [campaignId]);

    const savePage = useCallback((pageId, changes) => (
        updateDoc(doc(db, 'campaigns', campaignId, 'notes', pageId), { ...changes, updatedAt: serverTimestamp() })
    ), [campaignId]);

    const deletePage = useCallback((pageId) => (
        deleteDoc(doc(db, 'campaigns', campaignId, 'notes', pageId))
    ), [campaignId]);

    return { pages, status, createPage, savePage, deletePage };
}

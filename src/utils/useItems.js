import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, or, query, where } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from './firebase';
import { subscribeItem } from './itemStore';

// One item, by the id an inventory entry keeps, kept up to date. { item, status } - see
// subscribeItem. An id of '' or undefined is no item at all.
export function useItem(itemId) {
    const [state, setState] = useState({ item: null, status: itemId ? 'loading' : 'missing' });
    useEffect(() => {
        if (!itemId) { setState({ item: null, status: 'missing' }); return undefined; }
        return subscribeItem(itemId, setState);
    }, [itemId]);
    return state;
}

// Several items at once: { [id]: { item, status } }, for a list to show them.
export function useItemsById(itemIds) {
    const key = [...new Set(itemIds.filter(Boolean))].sort().join(',');
    const [states, setStates] = useState({});
    useEffect(() => {
        const ids = key === '' ? [] : key.split(',');
        setStates(current => Object.fromEntries(ids.map(id => [id, current[id] ?? { item: null, status: 'loading' }])));
        const stops = ids.map(id => subscribeItem(id, state => setStates(current => (current[id] === state ? current : { ...current, [id]: state }))));
        return () => stops.forEach(stop => stop());
    }, [key]);
    return useMemo(() => states, [states]);
}

// The items the signed-in user can see in the database: public ones, and any they can
// read or write (three plain branches - a bare scan can't be proven safe by the
// rules). Pass false to skip loading until it is needed. `reload` fetches again
// (after an item is added, say).
export function useItemCatalog(enabled = true) {
    const [catalog, setCatalog] = useState({ items: [], status: 'loading' });
    const [round, setRound] = useState(0);

    useEffect(() => {
        if (!enabled) return undefined;
        let cancelled = false;
        const unsubscribe = onAuthStateChanged(auth, user => {
            if (!user) return;
            const itemsQuery = query(collection(db, 'items'),
                or(where('isPublic', '==', true), where('canRead', 'array-contains', user.uid), where('canWrite', 'array-contains', user.uid)));
            getDocs(itemsQuery)
                .then(snapshot => { if (!cancelled) setCatalog({ items: snapshot.docs.map(d => ({ id: d.id, ...d.data() })), status: 'ready' }); })
                .catch(error => {
                    console.log('Failed to load the item database: ' + error);
                    if (!cancelled) setCatalog({ items: [], status: 'error' });
                });
        });
        return () => { cancelled = true; unsubscribe(); };
    }, [enabled, round]);

    return { ...catalog, reload: () => setRound(current => current + 1) };
}

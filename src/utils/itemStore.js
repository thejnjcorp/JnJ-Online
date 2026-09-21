import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';

// Items are looked up one by one, by the id an inventory entry keeps: a list can't
// ask for "these ten items" in one query, because the rules can only allow reading
// an item that is public or that the reader is listed on, and a query over ids
// can't be proven to be only those (see the items block in firestore.rules). So each
// item is its own listener - and, as with the party doc (see party.js), one listener
// per item, shared by everything that shows it and stopped a moment after the last
// has gone, so an inventory that re-renders or remounts doesn't listen again.
const TEARDOWN_DELAY_MS = 30000;
const stores = new Map();

const publish = (store, state) => {
    store.state = state;
    [...store.listeners].forEach(listener => listener(state));
};

// Calls `listener` with { item, status } now (if it is already known) and whenever the
// item changes. `status` is 'loading', 'ready' (`item` is { id, ...fields }), 'missing'
// (there is no such item) or 'error' (it could not be read - no access, say). Returns
// the function that stops listening.
export function subscribeItem(itemId, listener) {
    let store = stores.get(itemId);
    if (!store) {
        store = { listeners: new Set(), state: { item: null, status: 'loading' }, stop: null, timer: null };
        stores.set(itemId, store);
    }
    clearTimeout(store.timer);
    store.timer = null;
    store.listeners.add(listener);

    if (!store.stop) {
        const shared = store;
        store.stop = onSnapshot(
            doc(db, 'items', itemId),
            snapshot => publish(shared, snapshot.exists() ? { item: { id: snapshot.id, ...snapshot.data() }, status: 'ready' } : { item: null, status: 'missing' }),
            () => publish(shared, { item: null, status: 'error' }),
        );
    }
    listener(store.state);

    return () => {
        const current = stores.get(itemId);
        if (!current || !current.listeners.delete(listener)) return;
        if (current.listeners.size > 0) return;
        clearTimeout(current.timer);
        current.timer = setTimeout(() => {
            if (current.listeners.size > 0) return;
            current.stop?.();
            stores.delete(itemId);
        }, TEARDOWN_DELAY_MS);
    };
}

// For tests: forget every item listener.
export function resetItemStore() {
    stores.forEach(store => { clearTimeout(store.timer); store.stop?.(); });
    stores.clear();
}

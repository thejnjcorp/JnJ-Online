// One Firestore listener per thing listened to, shared by everything that asks for it
// and stopped only a moment after the last has gone - the way the party doc's listener
// is (see party.js). React mounts, unmounts and remounts components freely (in
// development it does so on purpose, every time), and starting and stopping a
// listener that fast is what trips an internal assertion in the Firestore SDK
// ("Unexpected state (ID: ca9)") when the server refuses it - a player outside the
// campaign, or rules that haven't been deployed yet. It is also a server round trip
// more than it needs each time.
const TEARDOWN_DELAY_MS = 3000;
const stores = new Map();

function publish(store, state) {
    store.state = state;
    [...store.listeners].forEach(listener => listener(state));
}

// `start(publish)` begins the real listener - it calls `publish(state)` with whatever
// the listener should tell everyone - and returns the function that stops it. It is only
// called when nobody is listening yet. `listener(state)` is called now (with what is
// already known, if anything) and for every published state. Returns the function that
// stops listening.
export function subscribeShared(key, start, listener) {
    let store = stores.get(key);
    if (!store) {
        store = { listeners: new Set(), state: null, stop: null, timer: null };
        stores.set(key, store);
    }
    clearTimeout(store.timer);
    store.timer = null;
    store.listeners.add(listener);

    if (!store.stop) {
        const shared = store;
        store.stop = start(state => publish(shared, state));
    }
    if (store.state) listener(store.state);

    return () => {
        const current = stores.get(key);
        if (!current || !current.listeners.delete(listener)) return; // stopped already
        if (current.listeners.size > 0) return;
        clearTimeout(current.timer);
        current.timer = setTimeout(() => {
            if (current.listeners.size > 0) return;
            current.stop?.();
            stores.delete(key);
        }, TEARDOWN_DELAY_MS);
    };
}

// For tests: stop and forget every shared listener.
export function resetSharedListeners() {
    stores.forEach(store => { clearTimeout(store.timer); store.stop?.(); });
    stores.clear();
}

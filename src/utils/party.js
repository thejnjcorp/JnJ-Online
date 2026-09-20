// The party doc: one shared document per campaign - campaigns/{id}/party/main -
// that everyone in the campaign, players and directors alike, can read and write
// (see the party block in firebase/firestore.rules). It holds what the whole party
// shares and changes together, instead of it living on the campaign doc, which
// only the directors can write:
//   combat_tracker: who is in the fight, the zone each is in and where each one's
//                   token sits on the combat map (utils/mapTokens.js)
// and is the place for the party's inventory and notes.
import { doc, onSnapshot, runTransaction } from 'firebase/firestore';
import { db } from './firebase';

export const PARTY_DOC_ID = 'main';

export const partyDoc = campaignId => doc(db, 'campaigns', campaignId, 'party', PARTY_DOC_ID);

// --- Listening -------------------------------------------------------------------
// Everything on a page that shows the party (the map, the line view, ...) listens to
// the same document, and React mounts, unmounts and remounts components freely (in
// development it does so on purpose, every time). Starting and stopping a Firestore
// listener that fast is what trips an internal assertion in the Firestore SDK
// ("Unexpected state (ID: ca9)") when the server refuses a listener - and it is one
// server round trip more than it needs each time. So there is one listener per party
// doc, shared by everything that asks for it, and it is only stopped a moment after
// the last one has gone, so a component that unmounts and remounts straight away
// finds it still there.
const TEARDOWN_DELAY_MS = 3000;
const stores = new Map();

function publish(store, state) {
    store.state = state;
    [...store.listeners].forEach(listener => listener(state));
}

// Calls `listener` with { party, loaded, error } now (if the party is already
// known) and every time the party doc changes; returns the function that stops
// listening. `party` is {} until there is a doc; `error` is set (and `loaded` true)
// if the listener was refused - no access, or the rules for it aren't deployed.
export function subscribeParty(campaignId, listener) {
    let store = stores.get(campaignId);
    if (!store) {
        store = { listeners: new Set(), state: null, stop: null, timer: null };
        stores.set(campaignId, store);
    }
    clearTimeout(store.timer);
    store.timer = null;
    store.listeners.add(listener);

    if (!store.stop) {
        const shared = store;
        store.stop = onSnapshot(
            partyDoc(campaignId),
            snapshot => publish(shared, { party: snapshot.data() || {}, loaded: true, error: null }),
            error => {
                console.log("Couldn't load the party: " + error);
                publish(shared, { party: {}, loaded: true, error });
            },
        );
    }
    if (store.state) listener(store.state);

    return () => {
        const current = stores.get(campaignId);
        if (!current || !current.listeners.delete(listener)) return; // stopped already
        if (current.listeners.size > 0) return;
        clearTimeout(current.timer);
        current.timer = setTimeout(() => {
            if (current.listeners.size > 0) return;
            current.stop?.();
            stores.delete(campaignId);
        }, TEARDOWN_DELAY_MS);
    };
}

// Make sure the campaign has a party doc: create it, empty, if it doesn't yet.
// A new campaign gets one as it is made, and an older campaign the first time
// anyone opens it, so the party doc is there whatever the campaign is doing - the
// map, the inventory, the notes - instead of appearing only when one of them
// happens to write to it first. Leaves an existing one exactly as it is.
export async function ensureParty(campaignId) {
    const ref = partyDoc(campaignId);
    await runTransaction(db, async transaction => {
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists()) transaction.set(ref, { combat_tracker: [] });
    });
}

// Change the party doc as it is right now. `change` is given the current party
// (an empty one if there is none yet) and returns the fields to set, or null to
// leave it alone. It runs inside a transaction, so two people changing the party
// at the same moment - two players each moving their token - can't overwrite each
// other's change: whoever is second is run again on top of the first.
export function updateParty(campaignId, change) {
    const ref = partyDoc(campaignId);
    return runTransaction(db, async transaction => {
        const snapshot = await transaction.get(ref);
        const patch = change(snapshot.exists() ? snapshot.data() : {});
        if (patch) transaction.set(ref, patch, { merge: true });
    });
}

// The same for the combat tracker: `change` is given its posts (a list, whatever is
// stored) and returns the new list, or null for no change.
export const updateCombatTracker = (campaignId, change) => updateParty(campaignId, party => {
    const next = change(Array.isArray(party.combat_tracker) ? party.combat_tracker : []);
    return next ? { combat_tracker: next } : null;
});

// A change for updateCombatTracker: take these enemies (by enemy id) off the tracker.
// Null - no change - when none of them is on it.
export const removeFromTracker = ids => posts => {
    const gone = new Set(ids.map(id => `npc:${id}`));
    const kept = posts.filter(post => !gone.has(post.id));
    return kept.length === posts.length ? null : kept;
};

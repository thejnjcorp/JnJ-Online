import { doc, runTransaction } from 'firebase/firestore';
import { db } from './firebase';
import { partyDoc, updateParty } from './party';
import {
    MAX_PARTY_ENTRIES, addToEntries, giveToCharacter, removeEntry, removeFromEntries, setEntryQuantity, takeFromCharacter,
} from './inventory';

// Moving items about: into and out of the party inventory (`inventory` on the party
// doc), and into, out of and around a character's own lists. Each is one
// transaction, so two people changing the same inventory at the same moment can't
// overwrite each other, and an item that moves between two documents is never in
// both or neither.
//
// Each rejects with an Error whose message is a sentence to show the person.

const REASON_TEXT = {
    full: "There's no room to carry that.",
    'too-many': "That's more than one stack can hold.",
    missing: "There isn't enough of that.",
    invalid: "That isn't something that can be moved.",
    'party-full': 'The party inventory is full - take something out first.',
};

export const reasonText = reason => REASON_TEXT[reason] ?? 'That could not be done.';

const fail = reason => { throw new Error(reasonText(reason)); };

export const characterDoc = characterId => doc(db, 'characters', characterId);

const partyEntries = party => (Array.isArray(party?.inventory) ? party.inventory : []);

// --- The party inventory --------------------------------------------------------------

// Put `quantity` of an item ({ id, item_name }) in the party inventory, noting who
// put it there.
export function addToParty(campaignId, item, quantity, userId) {
    return updateParty(campaignId, party => {
        const result = addToEntries(partyEntries(party), item, quantity, { extra: { added_by: userId || '' } });
        if (result.reason) fail(result.reason);
        if (result.entries.length > MAX_PARTY_ENTRIES) fail('party-full');
        return { inventory: result.entries };
    });
}

// Set how many of an entry the party has (zero or less takes it out).
export function setPartyQuantity(campaignId, entryId, quantity) {
    return updateParty(campaignId, party => ({ inventory: setEntryQuantity(partyEntries(party), entryId, quantity) }));
}

export function removePartyEntry(campaignId, entryId) {
    return updateParty(campaignId, party => ({ inventory: removeEntry(partyEntries(party), entryId) }));
}

// A character puts `quantity` of an item they are carrying into the party inventory.
export function putInParty({ campaignId, characterId, itemId, title, quantity, userId }) {
    const partyRef = partyDoc(campaignId);
    const characterRef = characterDoc(characterId);
    return runTransaction(db, async transaction => {
        const [partySnap, characterSnap] = await Promise.all([transaction.get(partyRef), transaction.get(characterRef)]);
        if (!characterSnap.exists()) throw new Error("That character can't be found.");
        const taken = takeFromCharacter(characterSnap.data(), itemId, quantity);
        if (taken.reason) fail(taken.reason);
        const added = addToEntries(partyEntries(partySnap.exists() ? partySnap.data() : {}), { id: itemId, item_name: title }, quantity, { extra: { added_by: userId || '' } });
        if (added.reason) fail(added.reason);
        if (added.entries.length > MAX_PARTY_ENTRIES) fail('party-full');
        transaction.update(characterRef, taken.lists);
        transaction.set(partyRef, { inventory: added.entries }, { merge: true });
    });
}

// A character takes `quantity` of an item out of the party inventory into their own.
export function takeFromParty({ campaignId, characterId, itemId, title, quantity }) {
    const partyRef = partyDoc(campaignId);
    const characterRef = characterDoc(characterId);
    return runTransaction(db, async transaction => {
        const [partySnap, characterSnap] = await Promise.all([transaction.get(partyRef), transaction.get(characterRef)]);
        if (!characterSnap.exists()) throw new Error("That character can't be found.");
        const removed = removeFromEntries(partyEntries(partySnap.exists() ? partySnap.data() : {}), itemId, quantity);
        if (!removed.ok) fail('missing');
        const given = giveToCharacter(characterSnap.data(), { id: itemId, item_name: title }, quantity);
        if (given.reason) fail(given.reason);
        transaction.update(characterRef, given.lists);
        transaction.set(partyRef, { inventory: removed.entries }, { merge: true });
    });
}

// --- A character's own inventory ------------------------------------------------------

// Change a character's two lists as they are now: `change` is given { inventory,
// inventory_pocket } and returns the new ones (or throws).
function changeCharacter(characterId, change) {
    const ref = characterDoc(characterId);
    return runTransaction(db, async transaction => {
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists()) throw new Error("That character can't be found.");
        const data = snapshot.data();
        const next = change({
            inventory: Array.isArray(data.inventory) ? data.inventory : [],
            inventory_pocket: Array.isArray(data.inventory_pocket) ? data.inventory_pocket : [],
        });
        transaction.update(ref, next);
    });
}

// Give a character `quantity` of an item ({ id, item_name }): onto a stack they have, or
// into a free backpack slot, or the pocket.
export function addItemToCharacter(characterId, item, quantity) {
    return changeCharacter(characterId, lists => {
        const given = giveToCharacter(lists, item, quantity);
        if (given.reason) fail(given.reason);
        return given.lists;
    });
}

const inList = (lists, entryId) => ['inventory', 'inventory_pocket'].find(name => lists[name].some(entry => entry.id === entryId));

export function setCharacterQuantity(characterId, entryId, quantity) {
    return changeCharacter(characterId, lists => {
        const name = inList(lists, entryId);
        return name ? { ...lists, [name]: setEntryQuantity(lists[name], entryId, quantity) } : lists;
    });
}

export function removeCharacterEntry(characterId, entryId) {
    return changeCharacter(characterId, lists => {
        const name = inList(lists, entryId);
        return name ? { ...lists, [name]: removeEntry(lists[name], entryId) } : lists;
    });
}

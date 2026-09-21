import { arrayUnion, doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

// An item that is not public can only be read by whoever is listed on it. When an
// item goes somewhere the whole party looks at - the party inventory, a trade - the
// party needs to be able to read it. This adds the campaign's members to the ones who
// can read it, if the person doing it is allowed to (they can write the item) and it
// isn't public already; otherwise it does nothing, and the item is shown by the name
// kept on the inventory entry (see inventory.js), which is all that is then needed.

// The uids of everyone in a campaign: its players, its directors, and its admins.
export const membersOf = campaign => [...new Set([campaign?.director_uid, ...(campaign?.canRead || []), ...(campaign?.canWrite || []), ...(campaign?.admins || [])].filter(Boolean))];

// Which of `uids` can't yet read `item`.
export function unreadableBy(item, uids) {
    if (!item || item.isPublic) return [];
    const readers = new Set([...(item.canRead || []), ...(item.canWrite || []), ...(item.admins || [])]);
    return uids.filter(uid => !readers.has(uid));
}

export const canWriteItem = (item, userId) => Boolean(userId) && Boolean(item) && ((item.canWrite || []).includes(userId) || (item.admins || []).includes(userId));

// Let `uids` read `item`, when the person can (see above). Resolves to whether it changed anything.
export async function shareItem(item, uids, userId) {
    const missing = unreadableBy(item, uids);
    if (missing.length === 0 || !canWriteItem(item, userId)) return false;
    try {
        await updateDoc(doc(db, 'items', item.id), { canRead: arrayUnion(...missing) });
        return true;
    } catch (error) {
        console.log("Couldn't share the item with the party: " + error);
        return false;
    }
}

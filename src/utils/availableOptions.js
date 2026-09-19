// The classes and races a campaign offers its characters: what the viewer can
// read (public docs plus anything they can read or write), narrowed to an admin
// default, one the viewer authored, or one the campaign has subscribed to - so
// a character can't be given a class or race outside that set. Used when
// creating a character and when an admin changes one.
import { collection, doc, getDoc, getDocs, or, query, where } from 'firebase/firestore';
import { db } from './firebase';

async function subscribedIds(campaignId, field) {
    try {
        const campaignSnap = await getDoc(doc(db, 'campaigns', campaignId));
        return campaignSnap.data()?.[field] || [];
    } catch (e) {
        console.log(e);
        return [];
    }
}

async function loadAvailable(collectionName, subscribedField, uid, campaignId) {
    const subscribed = await subscribedIds(campaignId, subscribedField);
    const readable = query(collection(db, collectionName),
        or(where('public', '==', true), where('canRead', 'array-contains', uid), where('canWrite', 'array-contains', uid)));
    const snapshot = await getDocs(readable);
    return snapshot.docs
        .map(document => ({ id: document.id, ...document.data() }))
        .filter(item => item.isDefault || item.canWrite?.includes(uid) || subscribed.includes(item.id));
}

export const loadAvailableClasses = (uid, campaignId) => loadAvailable('classes', 'subscribedClassIds', uid, campaignId);
export const loadAvailableRaces = (uid, campaignId) => loadAvailable('races', 'subscribedRaceIds', uid, campaignId);

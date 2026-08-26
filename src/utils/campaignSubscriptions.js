import { arrayUnion, collection, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { db } from './firebase';

// Subscribing a campaign to a class also auto-subscribes any public status
// scoped to that class (status.classes - see StatusPage.js's "Class
// scoping" field - stores class_name strings, not doc ids, so that's what
// this matches against) - a Director adding "Warden" to their campaign
// shouldn't also have to separately go hunt down and subscribe every status
// written specifically for Wardens. Deliberately not symmetric:
// unsubscribing a class does NOT cascade-remove those statuses, since a
// Director may have kept one around on purpose independent of the class
// that originally introduced it - see the plain arrayRemove(classId) calls
// at each call site instead of a matching unsubscribe helper here.
//
// Returns the ids of any statuses that got auto-subscribed, so a caller
// doing its own optimistic local-state update (ClassListPage.js,
// ClassPage.js) can fold them in too; CampaignClassesPage.js listens via
// onSnapshot instead and doesn't need the return value.
export async function subscribeClassToCampaign(campaignId, classDoc) {
    let statusIds = [];
    if (classDoc.class_name) {
        const statusesQuery = query(
            collection(db, 'statuses'),
            where('classes', 'array-contains', classDoc.class_name),
            where('public', '==', true)
        );
        const snap = await getDocs(statusesQuery);
        statusIds = snap.docs.map(d => d.id);
    }
    const payload = { subscribedClassIds: arrayUnion(classDoc.id) };
    if (statusIds.length > 0) {
        payload.subscribedStatusIds = arrayUnion(...statusIds);
    }
    await updateDoc(doc(db, 'campaigns', campaignId), payload);
    return statusIds;
}

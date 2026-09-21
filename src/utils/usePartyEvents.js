import { useCallback, useEffect, useMemo, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { sortEvents } from './calendar';
import { subscribeShared } from './sharedSnapshot';

// The events on the party's calendar: one document per event in
// campaigns/{campaignId}/party_events, for everyone in the campaign to read and
// write (see the party_events rule in firestore.rules). `calendar` is the campaign's
// calendar (see calendar.js), which says how they are ordered.
//
// status: 'loading' | 'ready' | 'error'
export function usePartyEvents(campaignId, calendar) {
    const [events, setEvents] = useState([]);
    const [status, setStatus] = useState('loading');

    useEffect(() => {
        if (!campaignId) return undefined;
        setStatus('loading');
        // shared, so every view of the calendar is one listener (see sharedSnapshot.js)
        return subscribeShared(
            `party_events:${campaignId}`,
            publish => onSnapshot(
                collection(db, 'campaigns', campaignId, 'party_events'),
                snapshot => publish({ events: snapshot.docs.map(item => ({ id: item.id, ...item.data() })), status: 'ready' }),
                error => {
                    console.log('Failed to load the party calendar: ' + error);
                    publish({ events: [], status: 'error' });
                },
            ),
            state => { setEvents(state.events); setStatus(state.status); },
        );
    }, [campaignId]);

    const sorted = useMemo(() => sortEvents(calendar, events), [calendar, events]);

    const author = () => ({ uid: auth?.currentUser?.uid || '', name: auth?.currentUser?.displayName || '' });

    // `fields` is what eventDocFields makes of the form.
    const addEvent = useCallback(fields => {
        const who = author();
        return addDoc(collection(db, 'campaigns', campaignId, 'party_events'), {
            ...fields, created_by_uid: who.uid, created_by_name: who.name, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        });
    }, [campaignId]);

    const saveEvent = useCallback((eventId, fields) => updateDoc(doc(db, 'campaigns', campaignId, 'party_events', eventId), { ...fields, updatedAt: serverTimestamp() }), [campaignId]);

    const deleteEvent = useCallback(eventId => deleteDoc(doc(db, 'campaigns', campaignId, 'party_events', eventId)), [campaignId]);

    return { events: sorted, status, addEvent, saveEvent, deleteEvent };
}

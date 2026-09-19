import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';

// A campaign's encounters, kept up to date. Only its directors can read them
// (the rules enforce it), so for anyone else this ends in an error state.
export function useEncounters(campaignId) {
    const [state, setState] = useState({ encounters: [], status: 'loading' });

    useEffect(() => {
        const unsubscribe = onSnapshot(
            collection(db, 'campaigns', campaignId, 'encounters'),
            snapshot => setState({
                encounters: snapshot.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.name || '').localeCompare(b.name || '')),
                status: 'ready',
            }),
            error => {
                console.log('Failed to load encounters: ' + error);
                setState({ encounters: [], status: 'error' });
            }
        );
        return () => unsubscribe();
    }, [campaignId]);

    return state;
}

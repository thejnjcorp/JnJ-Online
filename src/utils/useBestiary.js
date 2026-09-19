import { useEffect, useState } from 'react';
import { collection, getDocs, or, query, where } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from './firebase';

// The enemies the signed-in user can see: public ones plus anything they can
// read or write (three plain branches - a bare scan can't be proven safe by the
// rules). Pass false to skip loading until it's needed.
export function useBestiary(enabled = true) {
    const [bestiary, setBestiary] = useState({ enemies: [], status: 'loading' });

    useEffect(() => {
        if (!enabled) return;
        const unsubscribe = onAuthStateChanged(auth, user => {
            if (!user) return;
            const enemiesQuery = query(collection(db, 'enemies'),
                or(where('public', '==', true), where('canRead', 'array-contains', user.uid), where('canWrite', 'array-contains', user.uid)));
            getDocs(enemiesQuery)
                .then(snapshot => setBestiary({ enemies: snapshot.docs.map(d => ({ id: d.id, ...d.data() })), status: 'ready' }))
                .catch(error => {
                    console.log('Failed to load the bestiary: ' + error);
                    setBestiary({ enemies: [], status: 'error' });
                });
        });
        return () => unsubscribe();
    }, [enabled]);

    return bestiary;
}

import { useEffect, useState } from 'react';
import { collection, getDocs, or, query, where } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from './firebase';

// The tags the signed-in user can see: public ones plus anything they can read
// or write - three plain branches rather than a bare scan, which the tags read
// rule can't prove safe (see firestore.rules). Waits for auth, which can still
// be settling right after a page load. Pass false to skip loading until it is
// needed (an editor's picker is only used while editing).
export function useTagCatalog(enabled = true) {
    const [catalog, setCatalog] = useState({ tags: [], status: 'loading' });

    useEffect(() => {
        if (!enabled) return;
        const unsubscribe = onAuthStateChanged(auth, user => {
            if (!user) return;
            const tagsQuery = query(collection(db, 'tags'),
                or(where('public', '==', true), where('canRead', 'array-contains', user.uid), where('canWrite', 'array-contains', user.uid)));
            getDocs(tagsQuery)
                .then(snapshot => setCatalog({ tags: snapshot.docs.map(d => ({ id: d.id, ...d.data() })), status: 'ready' }))
                .catch(error => {
                    console.log('Failed to load tags: ' + error);
                    setCatalog({ tags: [], status: 'error' });
                });
        });
        return () => unsubscribe();
    }, [enabled]);

    return catalog;
}

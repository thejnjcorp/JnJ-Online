import { useEffect, useMemo, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { MAX_LIBRARY_TOKENS, libraryCollection, removeFromLibrary, saveToLibrary, validLibraryTokens } from './tokenLibrary';

// The signed-in user's token library (see tokenLibrary.js), kept up to date. It
// only listens while `enabled` - the palette that shows it is closed most of the
// time.
export function useTokenLibrary(userId, enabled = true) {
    const [docs, setDocs] = useState([]);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        if (!userId || !enabled) return undefined;
        return onSnapshot(
            libraryCollection(userId),
            snapshot => {
                setDocs(snapshot.docs.map(item => ({ id: item.id, ...item.data() })));
                setLoaded(true);
            },
            error => {
                console.log("Couldn't load the token library: " + error);
                setLoaded(true);
            }
        );
    }, [userId, enabled]);

    const tokens = useMemo(() => validLibraryTokens(docs), [docs]);

    return {
        tokens,
        loaded,
        full: tokens.length >= MAX_LIBRARY_TOKENS,
        save: fields => saveToLibrary(userId, fields).catch(error => alert("Couldn't save to your token library: " + error.message)),
        remove: tokenId => removeFromLibrary(userId, tokenId).catch(error => alert("Couldn't remove it from your token library: " + error.message)),
    };
}

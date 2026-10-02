import { useCallback, useEffect, useMemo, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { newScene, newSession, withoutUndefined } from './scenes';

// A campaign's sessions and scenes, kept up to date, and what a director can do
// with them. They live in campaigns/{campaignId}/sessions and .../scenes (see the
// rules in firestore.rules: only the campaign's directors can read or write them),
// not on the campaign doc, which players can read - and so each scene saves on its
// own instead of rewriting the whole campaign.
//
// status: 'loading' | 'ready' | 'error'
export function useScenes(campaignId) {
    const [sessions, setSessions] = useState([]);
    const [scenes, setScenes] = useState([]);
    const [loaded, setLoaded] = useState({ sessions: false, scenes: false });
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        if (!campaignId) return undefined;
        setLoaded({ sessions: false, scenes: false });
        setFailed(false);
        const listen = (name, setList) => onSnapshot(
            collection(db, 'campaigns', campaignId, name),
            snapshot => {
                setList(snapshot.docs.map(entry => ({ id: entry.id, ...entry.data() })));
                setLoaded(previous => ({ ...previous, [name]: true }));
            },
            error => {
                console.log(`Failed to load ${name}: ` + error);
                setFailed(true);
            },
        );
        const stops = [listen('sessions', setSessions), listen('scenes', setScenes)];
        return () => stops.forEach(stop => stop());
    }, [campaignId]);

    let status = 'loading';
    if (failed) status = 'error';
    else if (loaded.sessions && loaded.scenes) status = 'ready';

    const createSession = useCallback(async fields => {
        const number = sessions.reduce((highest, session) => Math.max(highest, session.number || 0), 0) + 1;
        const ref = await addDoc(collection(db, 'campaigns', campaignId, 'sessions'), withoutUndefined(newSession(number, fields)));
        return ref.id;
    }, [campaignId, sessions]);

    const updateSession = useCallback((id, patch) =>
        updateDoc(doc(db, 'campaigns', campaignId, 'sessions', id), withoutUndefined(patch)), [campaignId]);

    const createScene = useCallback(async fields => {
        const ref = await addDoc(collection(db, 'campaigns', campaignId, 'scenes'), withoutUndefined(newScene(fields)));
        return ref.id;
    }, [campaignId]);

    const updateScene = useCallback((id, patch) =>
        updateDoc(doc(db, 'campaigns', campaignId, 'scenes', id), withoutUndefined(patch)), [campaignId]);

    const deleteScene = useCallback(id =>
        deleteDoc(doc(db, 'campaigns', campaignId, 'scenes', id)), [campaignId]);

    return useMemo(() => ({
        sessions, scenes, status, createSession, updateSession, createScene, updateScene, deleteScene,
    }), [sessions, scenes, status, createSession, updateSession, createScene, updateScene, deleteScene]);
}

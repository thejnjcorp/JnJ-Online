import { useCallback, useEffect, useRef, useState } from 'react';

export const AUTOSAVE_DELAY_MS = 700;

// Editing a document you don't want to save on every keystroke: `edit(patch)`
// changes the local copy at once and saves just the changed fields after a short
// pause (or straight away with `flush()`). A newer copy arriving from the server
// replaces the local one only while nothing of yours is waiting to be saved, so an
// echo of your own earlier save never wipes what you've typed since.
//
// `remote` is the document as the server has it (null until it loads), `save(patch)`
// returns a promise. state: 'idle' | 'dirty' | 'saving' | 'saved' | 'error'.
export function useAutosavedDoc(remote, save, delay = AUTOSAVE_DELAY_MS) {
    const [draft, setDraft] = useState(remote);
    const [state, setState] = useState('idle');
    const pending = useRef({});
    const timer = useRef(null);
    const saveRef = useRef(save);
    const draftRef = useRef(remote);
    saveRef.current = save;

    const remoteId = remote?.id;
    useEffect(() => {
        pending.current = {};
        clearTimeout(timer.current);
        draftRef.current = remote;
        setDraft(remote);
        setState('idle');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [remoteId]);

    useEffect(() => {
        if (!remote || Object.keys(pending.current).length > 0) return;
        draftRef.current = remote;
        setDraft(remote);
    }, [remote]);

    const flush = useCallback(async () => {
        clearTimeout(timer.current);
        const patch = pending.current;
        if (Object.keys(patch).length === 0) return true;
        pending.current = {};
        setState('saving');
        try {
            await saveRef.current(patch);
            setState(Object.keys(pending.current).length > 0 ? 'dirty' : 'saved');
            return true;
        } catch (error) {
            console.log('Failed to save: ' + error);
            pending.current = { ...patch, ...pending.current };
            setState('error');
            return false;
        }
    }, []);

    const edit = useCallback(patch => {
        pending.current = { ...pending.current, ...patch };
        draftRef.current = { ...draftRef.current, ...patch };
        setDraft(draftRef.current);
        setState('dirty');
        clearTimeout(timer.current);
        timer.current = setTimeout(flush, delay);
    }, [flush, delay]);

    // leaving with something unsaved saves it
    useEffect(() => () => {
        clearTimeout(timer.current);
        if (Object.keys(pending.current).length > 0) saveRef.current(pending.current)?.catch?.(() => {});
    }, []);

    return { draft, edit, flush, state };
}

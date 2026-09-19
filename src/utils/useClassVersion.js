import { useEffect, useMemo, useRef, useState } from 'react';
import { resolveClassVersion } from './classVersions';
import { isLinkedToClass, resolveCharacter } from './characterClass';

// status: 'unlinked' (legacy character, nothing to load), 'loading',
// 'ready', or 'fallback' (the class couldn't be read - someone else's
// Private class, deleted - so callers keep using the saved copy).
export function useClassVersion(classId, version) {
    const linked = isLinkedToClass({ class_id: classId, class_version: version });
    const [state, setState] = useState({ status: linked ? 'loading' : 'unlinked', classData: null, latestVersion: null });

    useEffect(() => {
        if (!linked) {
            setState({ status: 'unlinked', classData: null, latestVersion: null });
            return undefined;
        }
        let cancelled = false;
        setState(previous => ({ ...previous, status: 'loading' }));
        resolveClassVersion(classId, version)
            .then(({ data, latestVersion }) => {
                if (!cancelled) setState({ status: 'ready', classData: data, latestVersion });
            })
            .catch(() => {
                if (!cancelled) setState({ status: 'fallback', classData: null, latestVersion: null });
            });
        return () => { cancelled = true; };
    }, [linked, classId, version]);

    return state;
}

function classKey(character) {
    return `${character.class_id}@${character.class_version}`;
}

// For screens showing many characters at once (Director's Page): one read per
// distinct (class, version) pair rather than one per character. Returns the
// characters in the same order, each resolved against its class when loaded.
export function useResolvedCharacters(characters) {
    // key -> class data, or null once a read has failed (so we don't retry it)
    const [classes, setClasses] = useState({});
    const requested = useRef(new Set());

    const pending = useMemo(() => {
        const wanted = new Map();
        (characters || []).filter(isLinkedToClass).forEach(character => wanted.set(classKey(character), character));
        return [...wanted.entries()];
    }, [characters]);

    useEffect(() => {
        pending.forEach(([key, character]) => {
            if (requested.current.has(key)) return;
            requested.current.add(key);
            resolveClassVersion(character.class_id, character.class_version)
                .then(({ data }) => setClasses(previous => ({ ...previous, [key]: data })))
                .catch(() => setClasses(previous => ({ ...previous, [key]: null })));
        });
    }, [pending]);

    return useMemo(
        () => (characters || []).map(character => resolveCharacter(character, isLinkedToClass(character) ? classes[classKey(character)] : null)),
        [characters, classes]
    );
}

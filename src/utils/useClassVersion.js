import { useEffect, useMemo, useRef, useState } from 'react';
import { resolveClassVersion } from './classVersions';
import { resolveRaceVersion } from './raceVersions';
import { isLinkedToClass, isLinkedToRace, resolveCharacter } from './characterClass';

const UNLINKED = { status: 'unlinked', data: null, latestVersion: null };

function useVersionedDoc(resolve, linked, id, version) {
    const [state, setState] = useState(linked ? { ...UNLINKED, status: 'loading' } : UNLINKED);

    useEffect(() => {
        if (!linked) {
            setState(UNLINKED);
            return undefined;
        }
        let cancelled = false;
        setState(previous => ({ ...previous, status: 'loading' }));
        resolve(id, version)
            .then(({ data, latestVersion }) => {
                if (!cancelled) setState({ status: 'ready', data, latestVersion });
            })
            .catch(() => {
                if (!cancelled) setState({ status: 'fallback', data: null, latestVersion: null });
            });
        return () => { cancelled = true; };
        // resolve is a module-level function, never a changing dependency
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [linked, id, version]);

    return state;
}

// status: 'unlinked' (legacy character, nothing to load), 'loading',
// 'ready', or 'fallback' (the class couldn't be read - someone else's
// Private class, deleted - so callers keep using the saved copy).
export function useClassVersion(classId, version) {
    const linked = isLinkedToClass({ class_id: classId, class_version: version });
    const { status, data, latestVersion } = useVersionedDoc(resolveClassVersion, linked, classId, version);
    return { status, classData: data, latestVersion };
}

export function useRaceVersion(raceId, version) {
    const linked = isLinkedToRace({ race_id: raceId, race_version: version });
    const { status, data, latestVersion } = useVersionedDoc(resolveRaceVersion, linked, raceId, version);
    return { status, raceData: data, latestVersion };
}

function classKey(character) {
    return `${character.class_id}@${character.class_version}`;
}

function raceKey(character) {
    return `${character.race_id}@${character.race_version}`;
}

// Loads each distinct pinned version once, however many characters share it.
// Returns a key -> data map, where data is null once a read has failed (so a
// failed read isn't retried on every render).
function useLoadedVersions(characters, isLinked, keyOf, resolve, idOf, versionOf) {
    const [loaded, setLoaded] = useState({});
    const requested = useRef(new Set());

    const pending = useMemo(() => {
        const wanted = new Map();
        (characters || []).filter(isLinked).forEach(character => wanted.set(keyOf(character), character));
        return [...wanted.entries()];
        // the accessors are module-level functions, never changing dependencies
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [characters]);

    useEffect(() => {
        pending.forEach(([key, character]) => {
            if (requested.current.has(key)) return;
            requested.current.add(key);
            resolve(idOf(character), versionOf(character))
                .then(({ data }) => setLoaded(previous => ({ ...previous, [key]: data })))
                .catch(() => setLoaded(previous => ({ ...previous, [key]: null })));
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pending]);

    return loaded;
}

// For screens showing many characters at once (Director's Page): one read per
// distinct (class, version) and (race, version) pair rather than one per
// character. Returns the characters in the same order, each resolved against
// its class and race when loaded.
export function useResolvedCharacters(characters) {
    const classes = useLoadedVersions(characters, isLinkedToClass, classKey, resolveClassVersion, c => c.class_id, c => c.class_version);
    const races = useLoadedVersions(characters, isLinkedToRace, raceKey, resolveRaceVersion, c => c.race_id, c => c.race_version);

    return useMemo(
        () => (characters || []).map(character => resolveCharacter(
            character,
            isLinkedToClass(character) ? classes[classKey(character)] : null,
            isLinkedToRace(character) ? races[raceKey(character)] : null,
        )),
        [characters, classes, races]
    );
}

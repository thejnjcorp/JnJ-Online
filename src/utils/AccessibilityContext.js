import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { DEFAULT_SETTINGS, applyAccessibility, cacheSettings, loadCachedSettings, normalizeSettings } from './accessibility';

// saveState: 'idle' | 'saving' | 'saved' | 'error'
export const AccessibilityContext = createContext({
    settings: { ...DEFAULT_SETTINGS },
    saveState: 'idle',
    update: async () => {},
    reset: async () => {},
});

export function useAccessibility() {
    return useContext(AccessibilityContext);
}

// Owns the settings for the whole app: applied to <html> as soon as they change,
// cached on the device, and - when someone is signed in - saved to their
// players/{uid} doc, which is also where they're loaded from on sign-in so
// they follow the player to every device.
export function AccessibilityProvider({ userId, children }) {
    const [settings, setSettings] = useState(loadCachedSettings);
    const [saveState, setSaveState] = useState('idle');
    const userIdRef = useRef(userId);
    userIdRef.current = userId;

    useEffect(() => {
        applyAccessibility(settings);
    }, [settings]);

    useEffect(() => {
        if (!userId) return undefined;
        let cancelled = false;
        getDoc(doc(db, 'players', userId))
            .then(snap => {
                const saved = snap.data()?.accessibility;
                if (cancelled || !saved) return;
                const next = normalizeSettings(saved);
                setSettings(next);
                cacheSettings(next);
            })
            .catch(error => console.log('Failed to load reading settings: ' + error));
        return () => { cancelled = true; };
    }, [userId]);

    const save = useCallback(async (next) => {
        setSettings(next);
        cacheSettings(next);
        if (!userIdRef.current) return;
        setSaveState('saving');
        try {
            await setDoc(doc(db, 'players', userIdRef.current), { accessibility: next }, { merge: true });
            setSaveState('saved');
        } catch (error) {
            console.log('Failed to save reading settings: ' + error);
            setSaveState('error');
        }
    }, []);

    const update = useCallback((changes) => save(normalizeSettings({ ...settings, ...changes })), [save, settings]);
    const reset = useCallback(() => save({ ...DEFAULT_SETTINGS }), [save]);

    const value = useMemo(() => ({ settings, saveState, update, reset }), [settings, saveState, update, reset]);
    return <AccessibilityContext.Provider value={value}>{children}</AccessibilityContext.Provider>;
}

import { useEffect, useRef } from 'react';
import { cueRunsItself } from './music';

// Running a scene: when the beat being run changes, its music cue (if it has one that plays by
// itself) is played - once, as the beat begins. Opening a scene that is already going, or
// reloading the page, does not play the cue of the beat it finds: the song is still going from
// when that beat began. Starting a scene plays the first beat's.
export function useBeatMusic(live, beat, onCue) {
    const seen = useRef(live ? beat?.id ?? null : null);
    const cue = beat?.music;
    const onCueRef = useRef(onCue);
    onCueRef.current = onCue;
    const beatId = beat?.id ?? null;

    useEffect(() => {
        if (!live) {
            seen.current = null;
            return;
        }
        if (seen.current === beatId) return;
        seen.current = beatId;
        if (cueRunsItself(cue)) onCueRef.current?.(cue);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [live, beatId]);
}

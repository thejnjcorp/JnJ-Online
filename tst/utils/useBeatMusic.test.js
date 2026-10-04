import { renderHook } from '@testing-library/react';
import { useBeatMusic } from '../../src/utils/useBeatMusic';

const cue = { action: 'play', videoId: 'abcdefghijk', loop: true, auto: true };
const beat = (id, music) => ({ id, ...(music ? { music } : {}) });

const run = (props, onCue = jest.fn()) => {
    const view = renderHook(({ live, current }) => useBeatMusic(live, current, onCue), { initialProps: props });
    return { ...view, onCue };
};

describe('useBeatMusic', () => {
    test('plays the cue of the beat that comes up next, once', () => {
        const { rerender, onCue } = run({ live: true, current: beat('a') });
        rerender({ live: true, current: beat('b', cue) });
        expect(onCue).toHaveBeenCalledTimes(1);
        expect(onCue).toHaveBeenCalledWith(cue);
        rerender({ live: true, current: { ...beat('b', cue), notes: 'edited while it runs' } });
        expect(onCue).toHaveBeenCalledTimes(1);
    });

    test('does not play the cue of the beat a scene that is already going is on - a reload is not a new beat', () => {
        const { onCue } = run({ live: true, current: beat('a', cue) });
        expect(onCue).not.toHaveBeenCalled();
    });

    test('starting the scene plays the first beat\'s', () => {
        const { rerender, onCue } = run({ live: false, current: beat('a', cue) });
        expect(onCue).not.toHaveBeenCalled();
        rerender({ live: true, current: beat('a', cue) });
        expect(onCue).toHaveBeenCalledWith(cue);
    });

    test('going back to a beat plays its cue again', () => {
        const { rerender, onCue } = run({ live: true, current: beat('a', cue) });
        rerender({ live: true, current: beat('b') });
        rerender({ live: true, current: beat('a', cue) });
        expect(onCue).toHaveBeenCalledTimes(1);
    });

    test('a cue that waits for the director is not played by itself', () => {
        const { rerender, onCue } = run({ live: true, current: beat('a') });
        rerender({ live: true, current: beat('b', { ...cue, auto: false }) });
        expect(onCue).not.toHaveBeenCalled();
    });

    test('a beat with no cue, or no beat left, plays nothing', () => {
        const { rerender, onCue } = run({ live: true, current: beat('a', cue) });
        rerender({ live: true, current: beat('b') });
        rerender({ live: true, current: null });
        expect(onCue).not.toHaveBeenCalled();
    });

    test('is fine without anything to tell', () => {
        const view = renderHook(({ current }) => useBeatMusic(true, current, null), { initialProps: { current: beat('a') } });
        expect(() => view.rerender({ current: beat('b', cue) })).not.toThrow();
    });
});

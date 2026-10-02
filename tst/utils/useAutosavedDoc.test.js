// eslint-disable-next-line import/first
import { act, renderHook } from '@testing-library/react';
// eslint-disable-next-line import/first
import { AUTOSAVE_DELAY_MS, useAutosavedDoc } from '../../src/utils/useAutosavedDoc';

beforeEach(() => jest.useFakeTimers());
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

const doc = (fields = {}) => ({ id: 'd1', name: 'One', ...fields });
// the remote document is a stable value between renders, as it is in the app
const stable = doc();

describe('useAutosavedDoc', () => {
    test('starts as the remote document, idle', () => {
        const { result } = renderHook(() => useAutosavedDoc(stable, jest.fn()));
        expect(result.current.draft).toEqual(doc());
        expect(result.current.state).toBe('idle');
    });

    test('an edit shows at once and is saved, as only the changed fields, after the pause', async () => {
        const save = jest.fn().mockResolvedValue(undefined);
        const { result } = renderHook(() => useAutosavedDoc(stable, save));

        act(() => result.current.edit({ name: 'Two' }));
        act(() => result.current.edit({ premise: 'x' }));
        expect(result.current.draft.name).toBe('Two');
        expect(result.current.state).toBe('dirty');
        expect(save).not.toHaveBeenCalled();

        await act(async () => { jest.advanceTimersByTime(AUTOSAVE_DELAY_MS); });

        expect(save).toHaveBeenCalledTimes(1);
        expect(save).toHaveBeenCalledWith({ name: 'Two', premise: 'x' });
        expect(result.current.state).toBe('saved');
    });

    test('flush saves right away and says whether it worked, and with nothing to save does nothing', async () => {
        const save = jest.fn().mockResolvedValue(undefined);
        const { result } = renderHook(() => useAutosavedDoc(stable, save));
        let ok;
        await act(async () => { ok = await result.current.flush(); });
        expect(ok).toBe(true);
        expect(save).not.toHaveBeenCalled();

        act(() => result.current.edit({ name: 'Two' }));
        await act(async () => { ok = await result.current.flush(); });
        expect(ok).toBe(true);
        expect(save).toHaveBeenCalledWith({ name: 'Two' });
    });

    test('a failed save keeps the edit to try again, and says so', async () => {
        jest.spyOn(console, 'log').mockImplementation(() => {});
        const save = jest.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
        const { result } = renderHook(() => useAutosavedDoc(stable, save));

        act(() => result.current.edit({ name: 'Two' }));
        let ok;
        await act(async () => { ok = await result.current.flush(); });
        expect(ok).toBe(false);
        expect(result.current.state).toBe('error');

        await act(async () => { ok = await result.current.flush(); });
        expect(ok).toBe(true);
        expect(save).toHaveBeenLastCalledWith({ name: 'Two' });
    });

    test('an edit made while a save is in flight is still waiting afterwards', async () => {
        let finish;
        const save = jest.fn().mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValue(undefined);
        const { result } = renderHook(() => useAutosavedDoc(stable, save));

        act(() => result.current.edit({ name: 'Two' }));
        let flushing;
        act(() => { flushing = result.current.flush(); });
        act(() => result.current.edit({ name: 'Three' }));
        await act(async () => { finish(); await flushing; });

        expect(result.current.state).toBe('dirty');
        await act(async () => { jest.advanceTimersByTime(AUTOSAVE_DELAY_MS); });
        expect(save).toHaveBeenLastCalledWith({ name: 'Three' });
    });

    test('a newer remote copy replaces the draft while nothing is waiting, but never wipes unsaved edits', () => {
        const save = jest.fn().mockResolvedValue(undefined);
        const { result, rerender } = renderHook(({ remote }) => useAutosavedDoc(remote, save), { initialProps: { remote: doc() } });

        rerender({ remote: doc({ name: 'From server' }) });
        expect(result.current.draft.name).toBe('From server');

        act(() => result.current.edit({ name: 'Mine' }));
        rerender({ remote: doc({ name: 'Echo' }) });
        expect(result.current.draft.name).toBe('Mine');
    });

    test('a different document starts over, dropping anything unsaved for the old one', () => {
        const { result, rerender } = renderHook(({ remote }) => useAutosavedDoc(remote, jest.fn()), { initialProps: { remote: doc() } });
        act(() => result.current.edit({ name: 'Mine' }));
        rerender({ remote: { id: 'd2', name: 'Other' } });
        expect(result.current.draft).toEqual({ id: 'd2', name: 'Other' });
        expect(result.current.state).toBe('idle');
    });

    test('a document that arrives later is picked up', () => {
        const { result, rerender } = renderHook(({ remote }) => useAutosavedDoc(remote, jest.fn()), { initialProps: { remote: null } });
        expect(result.current.draft).toBeNull();
        rerender({ remote: doc() });
        expect(result.current.draft).toEqual(doc());
    });

    test('leaving with something unsaved saves it', () => {
        const save = jest.fn().mockResolvedValue(undefined);
        const { result, unmount } = renderHook(() => useAutosavedDoc(stable, save));
        act(() => result.current.edit({ name: 'Two' }));
        unmount();
        expect(save).toHaveBeenCalledWith({ name: 'Two' });
    });

    test('leaving with nothing unsaved saves nothing', () => {
        const save = jest.fn();
        const { unmount } = renderHook(() => useAutosavedDoc(stable, save));
        unmount();
        expect(save).not.toHaveBeenCalled();
    });
});

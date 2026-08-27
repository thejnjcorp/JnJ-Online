import { renderHook, act } from '@testing-library/react';
import { useIsMobile } from '../../src/utils/useIsMobile';

// jsdom doesn't implement matchMedia at all, so it's stubbed here with a
// minimal fake MediaQueryList: a fixed `matches` value plus an
// addEventListener/removeEventListener pair the hook can register a
// listener with and this file can invoke to simulate a breakpoint crossing.
function installMatchMediaStub(initialMatches) {
    let matches = initialMatches;
    const listeners = new Set();
    const mql = {
        get matches() { return matches; },
        addEventListener: (type, handler) => { if (type === 'change') listeners.add(handler); },
        removeEventListener: (type, handler) => { if (type === 'change') listeners.delete(handler); },
    };
    window.matchMedia = jest.fn(() => mql);
    return {
        mql,
        listenerCount: () => listeners.size,
        fireChange: (nextMatches) => {
            matches = nextMatches;
            listeners.forEach(handler => handler({ matches: nextMatches }));
        },
    };
}

describe('useIsMobile', () => {
    afterEach(() => {
        delete window.matchMedia;
    });

    test('initial value reflects whether the mobile breakpoint currently matches', () => {
        installMatchMediaStub(true);
        const { result } = renderHook(() => useIsMobile());
        expect(result.current).toBe(true);
    });

    test('initial value is false when the mobile breakpoint does not match', () => {
        installMatchMediaStub(false);
        const { result } = renderHook(() => useIsMobile());
        expect(result.current).toBe(false);
    });

    test('queries the (max-width: 640px) breakpoint', () => {
        installMatchMediaStub(false);
        renderHook(() => useIsMobile());
        expect(window.matchMedia).toHaveBeenCalledWith('(max-width: 640px)');
    });

    test('updates when the breakpoint crosses after mount', () => {
        const stub = installMatchMediaStub(false);
        const { result } = renderHook(() => useIsMobile());
        expect(result.current).toBe(false);

        act(() => stub.fireChange(true));
        expect(result.current).toBe(true);

        act(() => stub.fireChange(false));
        expect(result.current).toBe(false);
    });

    test('removes its change listener on unmount', () => {
        const stub = installMatchMediaStub(false);
        const { unmount } = renderHook(() => useIsMobile());
        expect(stub.listenerCount()).toBe(1);

        unmount();
        expect(stub.listenerCount()).toBe(0);
    });
});

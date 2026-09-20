jest.mock('../../src/utils/firebase', () => ({ db: {} }));

const mockSubscribeParty = jest.fn();
jest.mock('../../src/utils/party', () => ({ subscribeParty: (...args) => mockSubscribeParty(...args) }));

// eslint-disable-next-line import/first
import { renderHook, act } from '@testing-library/react';
// eslint-disable-next-line import/first
import { useParty } from '../../src/utils/useParty';

let push;
const stop = jest.fn();

beforeEach(() => {
    push = null;
    stop.mockClear();
    mockSubscribeParty.mockReset();
    mockSubscribeParty.mockImplementation((_campaignId, listener) => {
        push = listener;
        return stop;
    });
});

describe('useParty', () => {
    test('listens to the campaign\'s party, and is empty and not loaded until it hears back', () => {
        const { result } = renderHook(() => useParty('camp-1'));
        expect(mockSubscribeParty).toHaveBeenCalledWith('camp-1', expect.any(Function));
        expect(result.current).toEqual({ party: {}, loaded: false, error: null });
    });

    test('gives the party once it arrives, and follows every change to it', () => {
        const { result } = renderHook(() => useParty('camp-1'));

        act(() => push({ party: { combat_tracker: [{ id: 'a' }] }, loaded: true, error: null }));
        expect(result.current).toEqual({ party: { combat_tracker: [{ id: 'a' }] }, loaded: true, error: null });

        act(() => push({ party: { combat_tracker: [{ id: 'a' }, { id: 'b' }] }, loaded: true, error: null }));
        expect(result.current.party.combat_tracker).toHaveLength(2);
    });

    test('a campaign with no party doc yet is loaded, with an empty party', () => {
        const { result } = renderHook(() => useParty('camp-1'));
        act(() => push({ party: {}, loaded: true, error: null }));
        expect(result.current).toEqual({ party: {}, loaded: true, error: null });
    });

    test('an error (no access, say) comes through, so the page does not wait forever', () => {
        const error = new Error('permission-denied');
        const { result } = renderHook(() => useParty('camp-1'));
        act(() => push({ party: {}, loaded: true, error }));
        expect(result.current).toEqual({ party: {}, loaded: true, error });
    });

    test('stops listening when it goes away, and listens to the new campaign when it changes', () => {
        const { rerender, unmount } = renderHook(({ id }) => useParty(id), { initialProps: { id: 'camp-1' } });
        rerender({ id: 'camp-2' });
        expect(stop).toHaveBeenCalledTimes(1);
        expect(mockSubscribeParty).toHaveBeenLastCalledWith('camp-2', expect.any(Function));
        unmount();
        expect(stop).toHaveBeenCalledTimes(2);
    });

    test('with no campaign it listens to nothing', () => {
        const { result } = renderHook(() => useParty(undefined));
        expect(mockSubscribeParty).not.toHaveBeenCalled();
        expect(result.current).toEqual({ party: {}, loaded: false, error: null });
    });
});

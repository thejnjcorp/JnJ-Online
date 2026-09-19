import { renderHook, act } from '@testing-library/react';

jest.mock('../../src/utils/firebase', () => ({ db: {} }));
const mockOnSnapshot = jest.fn();
jest.mock('firebase/firestore', () => ({
    collection: (_db, ...path) => ({ path }),
    onSnapshot: (...args) => mockOnSnapshot(...args),
}));

// eslint-disable-next-line import/first
import { useEncounters } from '../../src/utils/useEncounters';

const snapshotOf = items => ({ docs: items.map(({ id, ...data }) => ({ id, data: () => data })) });
let onNext;
let onError;
let unsubscribe;

beforeEach(() => {
    unsubscribe = jest.fn();
    mockOnSnapshot.mockImplementation((_ref, next, error) => { onNext = next; onError = error; return unsubscribe; });
    jest.spyOn(console, 'log').mockImplementation(() => {});
});

describe('useEncounters', () => {
    test('listens to the campaign\'s encounters, starting out loading', () => {
        const { result } = renderHook(() => useEncounters('camp-1'));
        expect(mockOnSnapshot.mock.calls[0][0]).toEqual({ path: ['campaigns', 'camp-1', 'encounters'] });
        expect(result.current).toEqual({ encounters: [], status: 'loading' });
    });

    test('has the encounters, with ids, in name order, and updates as they change', () => {
        const { result } = renderHook(() => useEncounters('camp-1'));

        act(() => onNext(snapshotOf([{ id: 'b', name: 'Ambush' }, { id: 'a', name: 'Bandit camp' }, { id: 'c' }])));
        expect(result.current.status).toBe('ready');
        expect(result.current.encounters.map(encounter => encounter.id)).toEqual(['c', 'b', 'a']);

        act(() => onNext(snapshotOf([{ id: 'a', name: 'Bandit camp' }])));
        expect(result.current.encounters).toHaveLength(1);
    });

    test('an error (someone who is not a director) is an error state with nothing in it', () => {
        const { result } = renderHook(() => useEncounters('camp-1'));
        act(() => onError(new Error('permission-denied')));
        expect(result.current).toEqual({ encounters: [], status: 'error' });
    });

    test('stops listening on unmount, and listens to the new campaign when it changes', () => {
        const { rerender, unmount } = renderHook(({ id }) => useEncounters(id), { initialProps: { id: 'camp-1' } });
        rerender({ id: 'camp-2' });
        expect(unsubscribe).toHaveBeenCalledTimes(1);
        expect(mockOnSnapshot.mock.calls[1][0]).toEqual({ path: ['campaigns', 'camp-2', 'encounters'] });
        unmount();
        expect(unsubscribe).toHaveBeenCalledTimes(2);
    });
});

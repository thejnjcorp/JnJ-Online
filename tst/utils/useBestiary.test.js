import { renderHook, waitFor } from '@testing-library/react';

jest.mock('../../src/utils/firebase', () => ({ auth: {}, db: {} }));
const mockOnAuth = jest.fn();
jest.mock('firebase/auth', () => ({ onAuthStateChanged: (...args) => mockOnAuth(...args) }));
const mockGetDocs = jest.fn();
const mockWhere = jest.fn();
jest.mock('firebase/firestore', () => ({
    collection: (_db, name) => ({ collection: name }),
    getDocs: (...args) => mockGetDocs(...args),
    or: (...clauses) => ({ or: clauses }),
    query: (source, filter) => ({ source, filter }),
    where: (...args) => mockWhere(...args),
}));

// eslint-disable-next-line import/first
import { useBestiary } from '../../src/utils/useBestiary';

const docsFrom = items => ({ docs: items.map(({ id, ...data }) => ({ id, data: () => data })) });
let unsubscribe;

beforeEach(() => {
    unsubscribe = jest.fn();
    mockWhere.mockImplementation((...args) => ({ where: args }));
    mockOnAuth.mockImplementation((_auth, callback) => { callback({ uid: 'me' }); return unsubscribe; });
    mockGetDocs.mockResolvedValue(docsFrom([{ id: 'e1', enemy_name: 'Wolf' }]));
    jest.spyOn(console, 'log').mockImplementation(() => {});
});

describe('useBestiary', () => {
    test('starts loading, then has the enemies the viewer can see, with their ids', async () => {
        const { result } = renderHook(() => useBestiary());
        expect(result.current.status).toBe('loading');
        await waitFor(() => expect(result.current.status).toBe('ready'));
        expect(result.current.enemies).toEqual([{ id: 'e1', enemy_name: 'Wolf' }]);
    });

    test('asks for public enemies plus anything the viewer can read or write, in the enemies collection', async () => {
        renderHook(() => useBestiary());
        await waitFor(() => expect(mockGetDocs).toHaveBeenCalled());
        const { source, filter } = mockGetDocs.mock.calls[0][0];
        expect(source).toEqual({ collection: 'enemies' });
        expect(filter.or.map(clause => clause.where)).toEqual([['public', '==', true], ['canRead', 'array-contains', 'me'], ['canWrite', 'array-contains', 'me']]);
    });

    test('a failed load is an error state with no enemies', async () => {
        mockGetDocs.mockRejectedValue(new Error('offline'));
        const { result } = renderHook(() => useBestiary());
        await waitFor(() => expect(result.current.status).toBe('error'));
        expect(result.current.enemies).toEqual([]);
    });

    test('waits for a signed-in user, stops listening on unmount, and loads nothing while disabled', async () => {
        mockOnAuth.mockImplementation((_auth, callback) => { callback(null); return unsubscribe; });
        const { unmount } = renderHook(() => useBestiary());
        expect(mockGetDocs).not.toHaveBeenCalled();
        unmount();
        expect(unsubscribe).toHaveBeenCalled();

        mockOnAuth.mockClear();
        renderHook(() => useBestiary(false));
        expect(mockOnAuth).not.toHaveBeenCalled();
    });
});

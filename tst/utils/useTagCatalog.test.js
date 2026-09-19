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
import { useTagCatalog } from '../../src/utils/useTagCatalog';

const docsFrom = items => ({ docs: items.map(({ id, ...data }) => ({ id, data: () => data })) });
let unsubscribe;

beforeEach(() => {
    unsubscribe = jest.fn();
    mockWhere.mockImplementation((...args) => ({ where: args }));
    mockOnAuth.mockImplementation((_auth, callback) => { callback({ uid: 'me' }); return unsubscribe; });
    mockGetDocs.mockResolvedValue(docsFrom([{ id: 't1', tagInfo: 'Fire' }]));
    jest.spyOn(console, 'log').mockImplementation(() => {});
});

describe('useTagCatalog', () => {
    test('starts loading, then has the tags the viewer can see, with their ids', async () => {
        const { result } = renderHook(() => useTagCatalog());
        expect(result.current.status).toBe('loading');

        await waitFor(() => expect(result.current.status).toBe('ready'));
        expect(result.current.tags).toEqual([{ id: 't1', tagInfo: 'Fire' }]);
    });

    test('asks for public tags plus anything the viewer can read or write, never a bare scan', async () => {
        renderHook(() => useTagCatalog());
        await waitFor(() => expect(mockGetDocs).toHaveBeenCalled());

        const { source, filter } = mockGetDocs.mock.calls[0][0];
        expect(source).toEqual({ collection: 'tags' });
        expect(filter.or.map(clause => clause.where)).toEqual([
            ['public', '==', true], ['canRead', 'array-contains', 'me'], ['canWrite', 'array-contains', 'me'],
        ]);
    });

    test('a failed load is an error state with no tags, not a crash', async () => {
        mockGetDocs.mockRejectedValue(new Error('offline'));
        const { result } = renderHook(() => useTagCatalog());

        await waitFor(() => expect(result.current.status).toBe('error'));
        expect(result.current.tags).toEqual([]);
    });

    test('waits for a signed-in user, and stops listening on unmount', async () => {
        mockOnAuth.mockImplementation((_auth, callback) => { callback(null); return unsubscribe; });
        const { result, unmount } = renderHook(() => useTagCatalog());

        expect(mockGetDocs).not.toHaveBeenCalled();
        expect(result.current.status).toBe('loading');
        unmount();
        expect(unsubscribe).toHaveBeenCalled();
    });

    test('loads nothing while disabled, and loads once enabled', async () => {
        const { result, rerender } = renderHook(({ enabled }) => useTagCatalog(enabled), { initialProps: { enabled: false } });
        expect(mockOnAuth).not.toHaveBeenCalled();
        expect(result.current.status).toBe('loading');

        rerender({ enabled: true });
        await waitFor(() => expect(result.current.status).toBe('ready'));
    });
});

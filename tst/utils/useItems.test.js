jest.mock('../../src/utils/firebase', () => ({ auth: {}, db: {} }));

const mockOnAuthStateChanged = jest.fn();
jest.mock('firebase/auth', () => ({ onAuthStateChanged: (...args) => mockOnAuthStateChanged(...args) }));

const mockGetDocs = jest.fn();
jest.mock('firebase/firestore', () => ({
    collection: (_db, name) => ({ __collection: name }),
    query: (...args) => ({ __query: args }),
    where: (...args) => ({ __where: args }),
    or: (...args) => ({ __or: args }),
    getDocs: (...args) => mockGetDocs(...args),
}));

const mockSubscribeItem = jest.fn();
jest.mock('../../src/utils/itemStore', () => ({ subscribeItem: (...args) => mockSubscribeItem(...args) }));

// eslint-disable-next-line import/first
import { renderHook, act, waitFor } from '@testing-library/react';
// eslint-disable-next-line import/first
import { useItem, useItemCatalog, useItemsById } from '../../src/utils/useItems';

const listeners = {};
const stops = {};

beforeEach(() => {
    Object.keys(listeners).forEach(key => delete listeners[key]);
    Object.keys(stops).forEach(key => delete stops[key]);
    mockSubscribeItem.mockImplementation((id, listener) => {
        listeners[id] = listener;
        stops[id] = jest.fn();
        listener({ item: null, status: 'loading' });
        return stops[id];
    });
    mockOnAuthStateChanged.mockImplementation((_auth, callback) => { Promise.resolve().then(() => callback({ uid: 'user-1' })); return jest.fn(); });
    mockGetDocs.mockResolvedValue({ docs: [{ id: 'torch', data: () => ({ item_name: 'Torch' }) }] });
});

describe('useItem', () => {
    test('is loading, then the item', () => {
        const { result } = renderHook(() => useItem('torch'));
        expect(result.current).toEqual({ item: null, status: 'loading' });
        act(() => listeners.torch({ item: { id: 'torch', item_name: 'Torch' }, status: 'ready' }));
        expect(result.current.item.item_name).toBe('Torch');
    });

    test('no id is no item, and nothing is listened to', () => {
        const { result } = renderHook(() => useItem(''));
        expect(result.current).toEqual({ item: null, status: 'missing' });
        expect(mockSubscribeItem).not.toHaveBeenCalled();
    });

    test('stops listening when it goes, and listens to the new item when the id changes', () => {
        const { rerender, unmount } = renderHook(({ id }) => useItem(id), { initialProps: { id: 'torch' } });
        rerender({ id: 'rope' });
        expect(stops.torch).toHaveBeenCalled();
        expect(mockSubscribeItem).toHaveBeenCalledWith('rope', expect.any(Function));
        unmount();
        expect(stops.rope).toHaveBeenCalled();
    });
});

describe('useItemsById', () => {
    test('gives the state of each item asked for', () => {
        const { result } = renderHook(() => useItemsById(['torch', 'rope']));
        expect(Object.keys(result.current).sort()).toEqual(['rope', 'torch']);
        act(() => listeners.rope({ item: { id: 'rope', item_name: 'Rope' }, status: 'ready' }));
        expect(result.current.rope.item.item_name).toBe('Rope');
        expect(result.current.torch.status).toBe('loading');
    });

    test('listens to an item once however many times it is asked for, and ignores blanks', () => {
        renderHook(() => useItemsById(['torch', 'torch', '', undefined]));
        expect(mockSubscribeItem).toHaveBeenCalledTimes(1);
    });

    test('follows a change of what is asked for, stopping what is no longer needed', () => {
        const { rerender, result } = renderHook(({ ids }) => useItemsById(ids), { initialProps: { ids: ['torch'] } });
        rerender({ ids: ['rope'] });
        expect(stops.torch).toHaveBeenCalled();
        expect(Object.keys(result.current)).toEqual(['rope']);
    });

    test('is empty for none', () => {
        const { result } = renderHook(() => useItemsById([]));
        expect(result.current).toEqual({});
    });
});

describe('useItemCatalog', () => {
    test('loads the public items and the ones the user can read or write', async () => {
        const { result } = renderHook(() => useItemCatalog());
        await waitFor(() => expect(result.current.status).toBe('ready'));
        expect(result.current.items).toEqual([{ id: 'torch', item_name: 'Torch' }]);
        const query = mockGetDocs.mock.calls[0][0].__query;
        expect(JSON.stringify(query)).toContain('isPublic');
        expect(JSON.stringify(query)).toContain('canRead');
        expect(JSON.stringify(query)).toContain('canWrite');
        expect(JSON.stringify(query)).toContain('user-1');
    });

    test('does not load until it is asked to', () => {
        renderHook(() => useItemCatalog(false));
        expect(mockGetDocs).not.toHaveBeenCalled();
    });

    test('says so when it cannot load', async () => {
        const log = jest.spyOn(console, 'log').mockImplementation(() => {});
        mockGetDocs.mockRejectedValue(new Error('offline'));
        const { result } = renderHook(() => useItemCatalog());
        await waitFor(() => expect(result.current.status).toBe('error'));
        expect(result.current.items).toEqual([]);
        log.mockRestore();
    });

    test('can be loaded again', async () => {
        const { result } = renderHook(() => useItemCatalog());
        await waitFor(() => expect(result.current.status).toBe('ready'));
        act(() => result.current.reload());
        await waitFor(() => expect(mockGetDocs).toHaveBeenCalledTimes(2));
    });
});

jest.mock('../../src/utils/firebase', () => ({ db: { __db: true } }));

const mockAddDoc = jest.fn();
const mockCollection = jest.fn();
const mockDeleteDoc = jest.fn();
const mockDoc = jest.fn();
const mockOnSnapshot = jest.fn();
const mockUpdateDoc = jest.fn();
jest.mock('firebase/firestore', () => ({
    addDoc: (...args) => mockAddDoc(...args),
    collection: (...args) => mockCollection(...args),
    deleteDoc: (...args) => mockDeleteDoc(...args),
    doc: (...args) => mockDoc(...args),
    onSnapshot: (...args) => mockOnSnapshot(...args),
    updateDoc: (...args) => mockUpdateDoc(...args),
}));

// eslint-disable-next-line import/first
import { act, renderHook } from '@testing-library/react';
// eslint-disable-next-line import/first
import { useScenes } from '../../src/utils/useScenes';

const listeners = {};
const unsubscribe = jest.fn();

const snapshot = items => ({ docs: items.map(({ id, ...data }) => ({ id, data: () => data })) });

beforeEach(() => {
    Object.keys(listeners).forEach(key => delete listeners[key]);
    mockCollection.mockImplementation((_db, ...path) => ({ __collection: path.join('/') }));
    mockDoc.mockImplementation((_db, ...path) => ({ __doc: path.join('/') }));
    mockAddDoc.mockResolvedValue({ id: 'new-id' });
    mockUpdateDoc.mockResolvedValue(undefined);
    mockDeleteDoc.mockResolvedValue(undefined);
    mockOnSnapshot.mockImplementation((target, onNext, onError) => {
        listeners[target.__collection] = { onNext, onError };
        return unsubscribe;
    });
});

afterEach(() => jest.clearAllMocks());

describe('useScenes', () => {
    test('listens to the campaign\'s sessions and scenes, loading until both have arrived', () => {
        const { result } = renderHook(() => useScenes('camp-1'));
        expect(mockCollection).toHaveBeenCalledWith({ __db: true }, 'campaigns', 'camp-1', 'sessions');
        expect(mockCollection).toHaveBeenCalledWith({ __db: true }, 'campaigns', 'camp-1', 'scenes');
        expect(result.current.status).toBe('loading');

        act(() => listeners['campaigns/camp-1/sessions'].onNext(snapshot([{ id: 's1', number: 1 }])));
        expect(result.current.status).toBe('loading');
        act(() => listeners['campaigns/camp-1/scenes'].onNext(snapshot([{ id: 'sc1', name: 'Ambush' }])));

        expect(result.current.status).toBe('ready');
        expect(result.current.sessions).toEqual([{ id: 's1', number: 1 }]);
        expect(result.current.scenes).toEqual([{ id: 'sc1', name: 'Ambush' }]);
    });

    test('goes to an error state when a listener is refused', () => {
        const { result } = renderHook(() => useScenes('camp-1'));
        jest.spyOn(console, 'log').mockImplementation(() => {});
        act(() => listeners['campaigns/camp-1/scenes'].onError(new Error('denied')));
        expect(result.current.status).toBe('error');
        console.log.mockRestore();
    });

    test('stops listening on unmount, and does nothing without a campaign', () => {
        const { unmount } = renderHook(() => useScenes('camp-1'));
        unmount();
        expect(unsubscribe).toHaveBeenCalledTimes(2);
        mockOnSnapshot.mockClear();
        renderHook(() => useScenes(undefined));
        expect(mockOnSnapshot).not.toHaveBeenCalled();
    });

    test('a new session takes the next number', async () => {
        const { result } = renderHook(() => useScenes('camp-1'));
        act(() => listeners['campaigns/camp-1/sessions'].onNext(snapshot([{ id: 's1', number: 1 }, { id: 's2', number: 4 }])));

        let id;
        await act(async () => { id = await result.current.createSession({ arc: 'Arc 2' }); });

        expect(id).toBe('new-id');
        expect(mockAddDoc).toHaveBeenCalledWith({ __collection: 'campaigns/camp-1/sessions' }, expect.objectContaining({ number: 5, arc: 'Arc 2' }));
    });

    test('the first session is number 1', async () => {
        const { result } = renderHook(() => useScenes('camp-1'));
        await act(async () => { await result.current.createSession({}); });
        expect(mockAddDoc.mock.calls[0][1].number).toBe(1);
    });

    test('creates, updates and deletes scenes in the scenes subcollection, never sending undefined', async () => {
        const { result } = renderHook(() => useScenes('camp-1'));

        let id;
        await act(async () => { id = await result.current.createScene({ sessionId: 's1', name: 'Ambush', premise: undefined }); });
        expect(id).toBe('new-id');
        const created = mockAddDoc.mock.calls[0][1];
        expect(mockAddDoc.mock.calls[0][0]).toEqual({ __collection: 'campaigns/camp-1/scenes' });
        expect(created).toMatchObject({ sessionId: 's1', name: 'Ambush', type: 'roleplay', status: 'draft', beats: [] });
        expect('premise' in created).toBe(false);

        await act(async () => { await result.current.updateScene('sc1', { name: 'Renamed', run: undefined }); });
        expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: 'campaigns/camp-1/scenes/sc1' }, { name: 'Renamed' });

        await act(async () => { await result.current.updateSession('s1', { arc: 'Arc 3' }); });
        expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: 'campaigns/camp-1/sessions/s1' }, { arc: 'Arc 3' });

        await act(async () => { await result.current.deleteScene('sc1'); });
        expect(mockDeleteDoc).toHaveBeenCalledWith({ __doc: 'campaigns/camp-1/scenes/sc1' });
    });
});

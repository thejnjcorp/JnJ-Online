jest.mock('../../src/utils/firebase', () => ({ db: {}, auth: { currentUser: { uid: 'user-1', displayName: 'Sam' } } }));

const mockOnSnapshot = jest.fn();
const mockAddDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockDeleteDoc = jest.fn();
jest.mock('firebase/firestore', () => ({
    collection: (_db, ...path) => ({ __collection: path }),
    doc: (_db, ...path) => ({ __doc: path }),
    onSnapshot: (...args) => mockOnSnapshot(...args),
    addDoc: (...args) => mockAddDoc(...args),
    updateDoc: (...args) => mockUpdateDoc(...args),
    deleteDoc: (...args) => mockDeleteDoc(...args),
    serverTimestamp: () => '__now__',
}));

// eslint-disable-next-line import/first
import { renderHook, act } from '@testing-library/react';
// eslint-disable-next-line import/first
import { resetSharedListeners } from '../../src/utils/sharedSnapshot';
// eslint-disable-next-line import/first
import { PARTY_NOTES_TEXT, usePartyNotes } from '../../src/utils/usePartyNotes';

let deliver;
let fail;
const stop = jest.fn();
const page = (id, extra = {}) => ({ id, data: () => ({ title: id, order: 1, ...extra }) });

beforeEach(() => {
    resetSharedListeners();
    stop.mockReset();
    mockAddDoc.mockResolvedValue({ id: 'new-page' });
    mockUpdateDoc.mockResolvedValue(undefined);
    mockDeleteDoc.mockResolvedValue(undefined);
    mockOnSnapshot.mockImplementation((_ref, onNext, onError) => { deliver = onNext; fail = onError; return stop; });
});

describe('usePartyNotes', () => {
    test('listens to the campaign\'s party notes, loading until they arrive', () => {
        const { result } = renderHook(() => usePartyNotes('camp-1'));
        expect(mockOnSnapshot).toHaveBeenCalledWith({ __collection: ['campaigns', 'camp-1', 'party_notes'] }, expect.any(Function), expect.any(Function));
        expect(result.current.status).toBe('loading');
    });

    test('two views of the notebook share one listener, and one remounting straight away does not start another', () => {
        jest.useFakeTimers();
        const first = renderHook(() => usePartyNotes('camp-1'));
        renderHook(() => usePartyNotes('camp-1'));
        expect(mockOnSnapshot).toHaveBeenCalledTimes(1);
        first.unmount();
        renderHook(() => usePartyNotes('camp-1'));
        expect(mockOnSnapshot).toHaveBeenCalledTimes(1);
        jest.useRealTimers();
    });

    test('gives the pages in the order they were made', () => {
        const { result } = renderHook(() => usePartyNotes('camp-1'));
        act(() => deliver({ docs: [page('b', { order: 20 }), page('a', { order: 10 })] }));
        expect(result.current.status).toBe('ready');
        expect(result.current.pages.map(p => p.id)).toEqual(['a', 'b']);
    });

    test('says so when the notes cannot be read', () => {
        const log = jest.spyOn(console, 'log').mockImplementation(() => {});
        const { result } = renderHook(() => usePartyNotes('camp-1'));
        act(() => fail(new Error('permission-denied')));
        expect(result.current.status).toBe('error');
        log.mockRestore();
    });

    test('stops listening a moment after it goes, and listens to nothing without a campaign', () => {
        jest.useFakeTimers();
        const { unmount } = renderHook(() => usePartyNotes('camp-1'));
        unmount();
        expect(stop).not.toHaveBeenCalled();
        act(() => { jest.advanceTimersByTime(4000); });
        expect(stop).toHaveBeenCalled();
        jest.useRealTimers();
        mockOnSnapshot.mockClear();
        renderHook(() => usePartyNotes(''));
        expect(mockOnSnapshot).not.toHaveBeenCalled();
    });

    test('a new page notes who made it, and comes back as the id', async () => {
        const { result } = renderHook(() => usePartyNotes('camp-1'));
        let id;
        await act(async () => { id = await result.current.createPage('Session 1'); });
        expect(id).toBe('new-page');
        expect(mockAddDoc).toHaveBeenCalledWith({ __collection: ['campaigns', 'camp-1', 'party_notes'] }, expect.objectContaining({
            title: 'Session 1', body: '', author_uid: 'user-1', author_name: 'Sam', updated_by_name: 'Sam', createdAt: '__now__', updatedAt: '__now__',
        }));
    });

    test('saving a page notes who changed it, and when', async () => {
        const { result } = renderHook(() => usePartyNotes('camp-1'));
        await act(async () => { await result.current.savePage('p1', { body: 'We met a dragon.' }); });
        expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['campaigns', 'camp-1', 'party_notes', 'p1'] }, { body: 'We met a dragon.', updated_by_uid: 'user-1', updated_by_name: 'Sam', updatedAt: '__now__' });
    });

    test('deleting a page', async () => {
        const { result } = renderHook(() => usePartyNotes('camp-1'));
        await act(async () => { await result.current.deletePage('p1'); });
        expect(mockDeleteDoc).toHaveBeenCalledWith({ __doc: ['campaigns', 'camp-1', 'party_notes', 'p1'] });
    });

    test('the wording is for the whole party, and remembers the open page separately from the director\'s', () => {
        expect(PARTY_NOTES_TEXT.heading).toBe('Party notes');
        expect(PARTY_NOTES_TEXT.intro).toMatch(/whole party/);
        expect(PARTY_NOTES_TEXT.storagePrefix).not.toBe('jnj-director-notes-page');
    });
});

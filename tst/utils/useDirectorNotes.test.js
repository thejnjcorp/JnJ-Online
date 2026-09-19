jest.mock('../../src/utils/firebase', () => ({ db: { __db: true } }));

const mockAddDoc = jest.fn();
const mockCollection = jest.fn();
const mockDeleteDoc = jest.fn();
const mockDoc = jest.fn();
const mockOnSnapshot = jest.fn();
const mockServerTimestamp = jest.fn();
const mockUpdateDoc = jest.fn();
jest.mock('firebase/firestore', () => ({
    addDoc: (...args) => mockAddDoc(...args),
    collection: (...args) => mockCollection(...args),
    deleteDoc: (...args) => mockDeleteDoc(...args),
    doc: (...args) => mockDoc(...args),
    onSnapshot: (...args) => mockOnSnapshot(...args),
    serverTimestamp: (...args) => mockServerTimestamp(...args),
    updateDoc: (...args) => mockUpdateDoc(...args),
}));

// eslint-disable-next-line import/first
import { act, renderHook } from '@testing-library/react';
// eslint-disable-next-line import/first
import { sortPages, useDirectorNotes } from '../../src/utils/useDirectorNotes';

let emit;
let emitError;
const unsubscribe = jest.fn();

beforeEach(() => {
    mockCollection.mockImplementation((_db, ...path) => ({ __collection: path.join('/') }));
    mockDoc.mockImplementation((_db, ...path) => ({ __doc: path.join('/') }));
    mockServerTimestamp.mockReturnValue('SERVER_TS');
    mockAddDoc.mockResolvedValue({ id: 'new-page' });
    mockUpdateDoc.mockResolvedValue(undefined);
    mockDeleteDoc.mockResolvedValue(undefined);
    mockOnSnapshot.mockImplementation((_target, onNext, onError) => {
        emit = (pages) => act(() => onNext({ docs: pages.map(({ id, ...data }) => ({ id, data: () => data })) }));
        emitError = (error) => act(() => onError(error));
        return unsubscribe;
    });
});

describe('sortPages', () => {
    test('oldest first; a page with no order sinks to the end; ties fall back to the title', () => {
        const sorted = sortPages([{ id: 'c', title: 'C' }, { id: 'b', title: 'B', order: 2 }, { id: 'a2', title: 'Beta', order: 1 }, { id: 'a1', title: 'Alpha', order: 1 }]);
        expect(sorted.map(page => page.id)).toEqual(['a1', 'a2', 'b', 'c']);
    });

    test('does not mutate its input', () => {
        const input = [{ id: 'b', order: 2 }, { id: 'a', order: 1 }];
        sortPages(input);
        expect(input.map(page => page.id)).toEqual(['b', 'a']);
    });
});

describe('useDirectorNotes', () => {
    test("listens to this campaign's notes subcollection, loading until the first snapshot", () => {
        const { result } = renderHook(() => useDirectorNotes('camp-1'));

        expect(mockCollection).toHaveBeenCalledWith({ __db: true }, 'campaigns', 'camp-1', 'notes');
        expect(result.current.status).toBe('loading');
        expect(result.current.pages).toEqual([]);
    });

    test('exposes the pages sorted by creation order, with their ids', () => {
        const { result } = renderHook(() => useDirectorNotes('camp-1'));

        emit([{ id: 'p2', title: 'Second', body: 'b', order: 20 }, { id: 'p1', title: 'First', body: 'a', order: 10 }]);

        expect(result.current.status).toBe('ready');
        expect(result.current.pages.map(page => [page.id, page.title])).toEqual([['p1', 'First'], ['p2', 'Second']]);
    });

    test('an empty notebook is ready, not loading', () => {
        const { result } = renderHook(() => useDirectorNotes('camp-1'));
        emit([]);
        expect(result.current).toMatchObject({ status: 'ready', pages: [] });
    });

    test('a failed listen (say, not a director) reports an error instead of hanging', () => {
        const log = jest.spyOn(console, 'log').mockImplementation(() => {});
        const { result } = renderHook(() => useDirectorNotes('camp-1'));

        emitError(new Error('permission-denied'));

        expect(result.current.status).toBe('error');
        log.mockRestore();
    });

    test('stops listening on unmount, and never listens without a campaign', () => {
        const { unmount } = renderHook(() => useDirectorNotes('camp-1'));
        unmount();
        expect(unsubscribe).toHaveBeenCalledTimes(1);

        mockOnSnapshot.mockClear();
        renderHook(() => useDirectorNotes(undefined));
        expect(mockOnSnapshot).not.toHaveBeenCalled();
    });

    test('switching campaign listens to the new one and drops the old listener', () => {
        const { rerender } = renderHook(({ id }) => useDirectorNotes(id), { initialProps: { id: 'camp-1' } });
        rerender({ id: 'camp-2' });
        expect(unsubscribe).toHaveBeenCalledTimes(1);
        expect(mockCollection).toHaveBeenLastCalledWith({ __db: true }, 'campaigns', 'camp-2', 'notes');
    });

    describe('createPage', () => {
        test('adds an empty page, in creation order, and resolves to its id', async () => {
            jest.spyOn(Date, 'now').mockReturnValue(1234);
            const { result } = renderHook(() => useDirectorNotes('camp-1'));

            let id;
            await act(async () => { id = await result.current.createPage('Session 1'); });

            expect(id).toBe('new-page');
            expect(mockAddDoc).toHaveBeenCalledWith({ __collection: 'campaigns/camp-1/notes' }, {
                title: 'Session 1', body: '', order: 1234, createdAt: 'SERVER_TS', updatedAt: 'SERVER_TS',
            });
            Date.now.mockRestore();
        });

        test('defaults the title to "New page"', async () => {
            const { result } = renderHook(() => useDirectorNotes('camp-1'));
            await act(async () => { await result.current.createPage(); });
            expect(mockAddDoc.mock.calls[0][1].title).toBe('New page');
        });
    });

    test('savePage updates just the given fields on that page and stamps when it was edited', async () => {
        const { result } = renderHook(() => useDirectorNotes('camp-1'));

        await act(async () => { await result.current.savePage('p1', { body: 'New text' }); });

        expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: 'campaigns/camp-1/notes/p1' }, { body: 'New text', updatedAt: 'SERVER_TS' });
    });

    test('deletePage removes that page', async () => {
        const { result } = renderHook(() => useDirectorNotes('camp-1'));
        await act(async () => { await result.current.deletePage('p1'); });
        expect(mockDeleteDoc).toHaveBeenCalledWith({ __doc: 'campaigns/camp-1/notes/p1' });
    });
});

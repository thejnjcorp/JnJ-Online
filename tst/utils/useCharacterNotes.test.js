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
import { useCharacterNotes } from '../../src/utils/useCharacterNotes';

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

describe('useCharacterNotes', () => {
    test("listens to this character's own notes subcollection, loading until the first snapshot", () => {
        const { result } = renderHook(() => useCharacterNotes('aria'));

        expect(mockCollection).toHaveBeenCalledWith({ __db: true }, 'characters', 'aria', 'notes');
        expect(result.current.status).toBe('loading');
        expect(result.current.pages).toEqual([]);
    });

    test('exposes the pages sorted by creation order, with their ids', () => {
        const { result } = renderHook(() => useCharacterNotes('aria'));

        emit([{ id: 'p2', title: 'Second', body: 'b', order: 20 }, { id: 'p1', title: 'First', body: 'a', order: 10 }]);

        expect(result.current.status).toBe('ready');
        expect(result.current.pages.map(page => [page.id, page.title])).toEqual([['p1', 'First'], ['p2', 'Second']]);
    });

    test('a failed listen reports an error instead of hanging', () => {
        const log = jest.spyOn(console, 'log').mockImplementation(() => {});
        const { result } = renderHook(() => useCharacterNotes('aria'));

        emitError(new Error('permission-denied'));

        expect(result.current.status).toBe('error');
        log.mockRestore();
    });

    test('stops listening on unmount, and never listens without a character', () => {
        const { unmount } = renderHook(() => useCharacterNotes('aria'));
        unmount();
        expect(unsubscribe).toHaveBeenCalledTimes(1);

        mockOnSnapshot.mockClear();
        renderHook(() => useCharacterNotes(undefined));
        expect(mockOnSnapshot).not.toHaveBeenCalled();
    });

    describe('createPage', () => {
        test('adds an empty page, in creation order, and resolves to its id', async () => {
            jest.spyOn(Date, 'now').mockReturnValue(1234);
            const { result } = renderHook(() => useCharacterNotes('aria'));

            let id;
            await act(async () => { id = await result.current.createPage('Session 1'); });

            expect(id).toBe('new-page');
            expect(mockAddDoc).toHaveBeenCalledWith({ __collection: 'characters/aria/notes' }, {
                title: 'Session 1', body: '', order: 1234, createdAt: 'SERVER_TS', updatedAt: 'SERVER_TS',
            });
            Date.now.mockRestore();
        });

        test('defaults the title to "New page" and the body to empty', async () => {
            const { result } = renderHook(() => useCharacterNotes('aria'));
            await act(async () => { await result.current.createPage(); });
            expect(mockAddDoc.mock.calls[0][1]).toMatchObject({ title: 'New page', body: '' });
        });

        test('takes an optional starting body - for carrying over the old single-field notes into a first page', async () => {
            const { result } = renderHook(() => useCharacterNotes('aria'));
            await act(async () => { await result.current.createPage('Notes', 'Met a merchant.') });
            expect(mockAddDoc.mock.calls[0][1]).toMatchObject({ title: 'Notes', body: 'Met a merchant.' });
        });
    });

    test('savePage updates just the given fields on that page and stamps when it was edited', async () => {
        const { result } = renderHook(() => useCharacterNotes('aria'));

        await act(async () => { await result.current.savePage('p1', { body: 'New text' }); });

        expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: 'characters/aria/notes/p1' }, { body: 'New text', updatedAt: 'SERVER_TS' });
    });

    test('deletePage removes that page', async () => {
        const { result } = renderHook(() => useCharacterNotes('aria'));
        await act(async () => { await result.current.deletePage('p1'); });
        expect(mockDeleteDoc).toHaveBeenCalledWith({ __doc: 'characters/aria/notes/p1' });
    });
});

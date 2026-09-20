jest.mock('../../src/utils/firebase', () => ({ db: {} }));

const mockAddDoc = jest.fn();
const mockDeleteDoc = jest.fn();
jest.mock('firebase/firestore', () => ({
    collection: (_db, ...path) => ({ __collection: path }),
    doc: (_db, ...path) => ({ __doc: path }),
    addDoc: (...args) => mockAddDoc(...args),
    deleteDoc: (...args) => mockDeleteDoc(...args),
    serverTimestamp: () => '__serverTimestamp__',
}));

// eslint-disable-next-line import/first
import { DRAG_TYPE, dragPayload, libraryCollection, readDragPayload, removeFromLibrary, saveToLibrary, validLibraryTokens } from '../../src/utils/tokenLibrary';
// eslint-disable-next-line import/first
import { DEFAULT_IMAGE_TOKEN_SIZE, MAX_LABEL_LENGTH } from '../../src/utils/mapImageTokens';

const at = millis => ({ toMillis: () => millis });
const saved = (id, extra = {}) => ({ id, image: 'AbC1d2E.png', label: id, size: 0.07, createdAt: at(1), ...extra });

beforeEach(() => {
    mockAddDoc.mockResolvedValue({ id: 'new' });
    mockDeleteDoc.mockResolvedValue(undefined);
});

describe('where the library lives', () => {
    test('with the user, where only they can read it', () => {
        expect(libraryCollection('user-1')).toEqual({ __collection: ['players', 'user-1', 'tokens'] });
    });
});

describe('validLibraryTokens', () => {
    test('keeps well-formed tokens, oldest first', () => {
        const list = validLibraryTokens([saved('later', { createdAt: at(5) }), saved('first', { createdAt: at(1) })]);
        expect(list.map(t => t.id)).toEqual(['first', 'later']);
    });

    test('puts ones saved together in name order, and one still waiting for its time (a fresh write) with the oldest', () => {
        const list = validLibraryTokens([saved('b', { createdAt: at(2) }), saved('a', { createdAt: at(2) }), saved('pending', { createdAt: null })]);
        expect(list.map(t => t.id)).toEqual(['pending', 'a', 'b']);
    });

    test('leaves out anything without a usable picture, rather than breaking the palette', () => {
        const list = validLibraryTokens([saved('ok'), saved('bad', { image: 'javascript:alert(1)' }), { id: 'none' }, null, saved('n', { id: 5 })]);
        expect(list.map(t => t.id)).toEqual(['ok']);
    });

    test('does not change what it was given', () => {
        const docs = [saved('b', { createdAt: at(2) }), saved('a', { createdAt: at(1) })];
        validLibraryTokens(docs);
        expect(docs.map(t => t.id)).toEqual(['b', 'a']);
    });
});

describe('saving and removing', () => {
    test('saving stores the picture ref, its name and its size, and when', async () => {
        await saveToLibrary('user-1', { image: 'AbC1d2E.png', label: 'Fire', size: 0.12 });
        expect(mockAddDoc).toHaveBeenCalledWith({ __collection: ['players', 'user-1', 'tokens'] }, { image: 'AbC1d2E.png', label: 'Fire', size: 0.12, createdAt: '__serverTimestamp__' });
    });

    test('with no name or size it is unnamed and medium; a long name is cut, and trimmed', async () => {
        await saveToLibrary('user-1', { image: 'AbC1d2E.png' });
        expect(mockAddDoc.mock.calls[0][1]).toMatchObject({ label: '', size: DEFAULT_IMAGE_TOKEN_SIZE });
        await saveToLibrary('user-1', { image: 'AbC1d2E.png', label: `  ${'x'.repeat(MAX_LABEL_LENGTH + 10)} ` });
        expect(mockAddDoc.mock.calls[1][1].label).toBe('x'.repeat(MAX_LABEL_LENGTH));
    });

    test('removing deletes that one', async () => {
        await removeFromLibrary('user-1', 'tok-1');
        expect(mockDeleteDoc).toHaveBeenCalledWith({ __doc: ['players', 'user-1', 'tokens', 'tok-1'] });
    });
});

describe('what is dragged onto a map', () => {
    test('is the picture, its name and its size, and reads back the same', () => {
        const token = saved('a', { label: 'Fire', size: 0.12 });
        expect(readDragPayload(dragPayload(token))).toEqual({ image: 'AbC1d2E.png', label: 'Fire', size: 0.12 });
        expect(DRAG_TYPE).toBe('application/x-jnj-image-token');
    });

    test('a token with no name drags with an empty one', () => {
        expect(readDragPayload(dragPayload({ image: 'AbC1d2E.png', size: 0.07 })).label).toBe('');
    });

    test('anything else dropped on the map is refused, not trusted', () => {
        [
            '', 'not json', 'null', '42', '{}',
            JSON.stringify({ image: 'javascript:alert(1)', size: 0.1 }),
            JSON.stringify({ image: 'AbC1d2E.png' }),
            JSON.stringify({ image: 'AbC1d2E.png', size: 0 }),
            JSON.stringify({ image: 'AbC1d2E.png', size: 'big' }),
        ].forEach(text => expect(readDragPayload(text)).toBeNull());
    });

    test('a name that is not text is dropped, not passed on', () => {
        expect(readDragPayload(JSON.stringify({ image: 'AbC1d2E.png', size: 0.1, label: { evil: true } })).label).toBe('');
    });
});

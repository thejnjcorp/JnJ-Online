jest.mock('../../src/utils/firebase', () => ({ db: {} }));

const mockUpdateDoc = jest.fn();
jest.mock('firebase/firestore', () => ({
    doc: (_db, ...path) => ({ __doc: path }),
    updateDoc: (...args) => mockUpdateDoc(...args),
    arrayUnion: (...values) => ({ __arrayUnion: values }),
}));

// eslint-disable-next-line import/first
import { canWriteItem, membersOf, shareItem, unreadableBy } from '../../src/utils/itemAccess';

const campaign = { director_uid: 'dir', canRead: ['p1', 'p2', 'dir'], canWrite: ['dir', 'codir'], admins: ['dir'] };

beforeEach(() => {
    mockUpdateDoc.mockResolvedValue(undefined);
});

describe('membersOf', () => {
    test('is everyone in a campaign once: the director, the players, co-directors and admins', () => {
        expect(membersOf(campaign).sort()).toEqual(['codir', 'dir', 'p1', 'p2']);
    });

    test('is empty for no campaign, or one with nothing on it', () => {
        expect(membersOf(undefined)).toEqual([]);
        expect(membersOf({})).toEqual([]);
    });
});

describe('unreadableBy', () => {
    const item = { id: 'x', isPublic: false, canRead: ['p1'], canWrite: ['author'], admins: ['author'] };

    test('is who among them is not yet allowed to read a private item', () => {
        expect(unreadableBy(item, ['p1', 'p2', 'author'])).toEqual(['p2']);
    });

    test('is nobody for a public item, or no item', () => {
        expect(unreadableBy({ ...item, isPublic: true }, ['p2'])).toEqual([]);
        expect(unreadableBy(undefined, ['p2'])).toEqual([]);
    });

    test('is everybody for an item nobody is listed on', () => {
        expect(unreadableBy({ id: 'x' }, ['p1'])).toEqual(['p1']);
    });
});

describe('canWriteItem', () => {
    test('is whoever is listed to write it, or administer it', () => {
        expect(canWriteItem({ canWrite: ['a'] }, 'a')).toBe(true);
        expect(canWriteItem({ admins: ['b'] }, 'b')).toBe(true);
        expect(canWriteItem({ canWrite: ['a'] }, 'c')).toBe(false);
        expect(canWriteItem({ canWrite: ['a'] }, undefined)).toBe(false);
        expect(canWriteItem(undefined, 'a')).toBe(false);
    });
});

describe('shareItem', () => {
    const item = { id: 'secret', isPublic: false, canRead: ['p1'], canWrite: ['author'], admins: ['author'] };

    test('lets the members who cannot read a private item read it, when the person can write it', async () => {
        expect(await shareItem(item, ['p1', 'p2', 'p3'], 'author')).toBe(true);
        expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['items', 'secret'] }, { canRead: { __arrayUnion: ['p2', 'p3'] } });
    });

    test('does nothing for a public item, or when everyone can read it already', async () => {
        expect(await shareItem({ ...item, isPublic: true }, ['p2'], 'author')).toBe(false);
        expect(await shareItem(item, ['p1', 'author'], 'author')).toBe(false);
        expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    test('does nothing when the person cannot write the item - it is then shown by the name the entry kept', async () => {
        expect(await shareItem(item, ['p2'], 'p1')).toBe(false);
        expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    test('a refused write is logged, not thrown', async () => {
        const log = jest.spyOn(console, 'log').mockImplementation(() => {});
        mockUpdateDoc.mockRejectedValue(new Error('permission-denied'));
        expect(await shareItem(item, ['p2'], 'author')).toBe(false);
        expect(log).toHaveBeenCalledWith("Couldn't share the item with the party: Error: permission-denied");
        log.mockRestore();
    });
});

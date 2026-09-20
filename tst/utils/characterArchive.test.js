jest.mock('../../src/utils/firebase', () => ({ db: {} }));

const mockDoc = jest.fn();
const mockUpdateDoc = jest.fn();
jest.mock('firebase/firestore', () => ({
    doc: (...args) => mockDoc(...args),
    updateDoc: (...args) => mockUpdateDoc(...args),
    serverTimestamp: () => '__serverTimestamp__',
    deleteField: () => '__deleteField__',
    Timestamp: { fromMillis: millis => ({ __millis: millis }) },
}));

// eslint-disable-next-line import/first
import {
    DELETION_GRACE_DAYS, archiveCharacter, cancelCharacterDeletion, canRetireCharacter, deletionDate, formatDeletionDate,
    isArchived, scheduleCharacterDeletion, unarchiveCharacter, withoutArchived,
} from '../../src/utils/characterArchive';

beforeEach(() => {
    mockDoc.mockImplementation((_db, ...path) => ({ __doc: path }));
    mockUpdateDoc.mockResolvedValue(undefined);
});

describe('who is archived', () => {
    test('a character is when its archived flag is set, and characters from before the flag existed are not', () => {
        expect(isArchived({ archived: true })).toBe(true);
        expect(isArchived({ archived: false })).toBe(false);
        expect(isArchived({})).toBe(false);
        expect(isArchived(undefined)).toBe(false);
    });

    test('withoutArchived keeps the rest in order, including characters with no flag at all', () => {
        const list = [{ id: 'a' }, { id: 'b', archived: true }, { id: 'c', archived: false }];
        expect(withoutArchived(list).map(c => c.id)).toEqual(['a', 'c']);
        expect(withoutArchived([])).toEqual([]);
    });
});

describe('canRetireCharacter', () => {
    const character = { playerId: 'alice', admins: ['alice', 'carol'], canWrite: ['alice', 'bob'] };

    test('the character\'s player and its admins can', () => {
        expect(canRetireCharacter(character, 'alice')).toBe(true);
        expect(canRetireCharacter(character, 'carol')).toBe(true);
    });

    test('someone who can only write the sheet cannot, nor can a stranger or nobody', () => {
        expect(canRetireCharacter(character, 'bob')).toBe(false);
        expect(canRetireCharacter(character, 'mallory')).toBe(false);
        expect(canRetireCharacter(character, undefined)).toBe(false);
        expect(canRetireCharacter(undefined, 'alice')).toBe(false);
    });
});

describe('the deletion date', () => {
    test('is read from the timestamp, and there is none when nothing is scheduled', () => {
        const date = new Date(2026, 9, 21);
        expect(deletionDate({ scheduledDeletionAt: { toDate: () => date } })).toBe(date);
        expect(deletionDate({})).toBeNull();
        expect(deletionDate({ scheduledDeletionAt: 'soon' })).toBeNull();
    });

    test('is written out in full', () => {
        expect(formatDeletionDate(new Date(2026, 9, 21))).toBe('October 21, 2026');
    });
});

describe('changing a character\'s standing', () => {
    test('archiving sets the flag and when', async () => {
        await archiveCharacter('char-1');
        expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['characters', 'char-1'] }, { archived: true, archivedAt: '__serverTimestamp__' });
    });

    test('unarchiving puts it all back, including cancelling a deletion', async () => {
        await unarchiveCharacter('char-1');
        expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['characters', 'char-1'] }, { archived: false, archivedAt: '__deleteField__', scheduledDeletionAt: '__deleteField__' });
    });

    test('scheduling deletion sets it the grace period from now', async () => {
        const now = Date.now();
        jest.spyOn(Date, 'now').mockReturnValue(now);
        await scheduleCharacterDeletion('char-1');
        expect(DELETION_GRACE_DAYS).toBe(30);
        expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['characters', 'char-1'] }, { scheduledDeletionAt: { __millis: now + 30 * 24 * 60 * 60 * 1000 } });
        Date.now.mockRestore();
    });

    test('cancelling a deletion only removes the date, leaving it archived', async () => {
        await cancelCharacterDeletion('char-1');
        expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['characters', 'char-1'] }, { scheduledDeletionAt: '__deleteField__' });
    });
});

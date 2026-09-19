jest.mock('../../src/utils/firebase', () => ({ db: { __db: true } }));

const mockDoc = jest.fn();
const mockCollection = jest.fn();
const mockGetDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockRunTransaction = jest.fn();
const mockServerTimestamp = jest.fn();
const mockTx = { get: jest.fn(), set: jest.fn(), update: jest.fn() };

jest.mock('firebase/firestore', () => ({
    doc: (...args) => mockDoc(...args),
    collection: (...args) => mockCollection(...args),
    getDoc: (...args) => mockGetDoc(...args),
    getDocs: (...args) => mockGetDocs(...args),
    runTransaction: (...args) => mockRunTransaction(...args),
    serverTimestamp: (...args) => mockServerTimestamp(...args),
}));

// eslint-disable-next-line import/first
import { classContent, listClassVersions, publishClassVersion, resolveClassVersion, versionOf } from '../../src/utils/classVersions';

const snapshot = (data, id = 'x') => ({ id, exists: () => data !== undefined, data: () => data });

beforeEach(() => {
    mockDoc.mockImplementation((_db, ...path) => ({ __doc: path.join('/') }));
    mockCollection.mockImplementation((_db, ...path) => ({ __collection: path.join('/') }));
    mockServerTimestamp.mockReturnValue('SERVER_TS');
    mockRunTransaction.mockImplementation((_db, fn) => fn(mockTx));
});

describe('versionOf', () => {
    test('a class with no version field is version 1', () => {
        expect(versionOf({ class_name: 'Old' })).toBe(1);
        expect(versionOf({ version: 3 })).toBe(3);
        expect(versionOf(undefined)).toBe(1);
    });
});

describe('classContent', () => {
    test('drops permission/visibility fields and undefined values, keeps content', () => {
        const content = classContent({
            id: 'c1', class_name: 'Monk', actions: [], public: true, isDefault: true,
            canRead: [], canWrite: ['a'], admins: ['a'], visibility: 'public', description: undefined, version: 2,
        });
        expect(content).toEqual({ class_name: 'Monk', actions: [], version: 2 });
    });
});

describe('resolveClassVersion', () => {
    test('with no version asked for, returns the current class', async () => {
        mockGetDoc.mockResolvedValueOnce(snapshot({ class_name: 'Monk', version: 3 }));

        const result = await resolveClassVersion('monk');

        expect(result).toEqual({ data: { class_name: 'Monk', version: 3 }, version: 3, latestVersion: 3 });
        expect(mockGetDoc).toHaveBeenCalledTimes(1);
    });

    test('asking for the current version (even an implicit 1) reads only the class doc', async () => {
        mockGetDoc.mockResolvedValueOnce(snapshot({ class_name: 'Old' }));

        const result = await resolveClassVersion('old', 1);

        expect(result.version).toBe(1);
        expect(result.latestVersion).toBe(1);
        expect(mockGetDoc).toHaveBeenCalledTimes(1);
    });

    test('an older version is read from the versions subcollection', async () => {
        mockGetDoc
            .mockResolvedValueOnce(snapshot({ class_name: 'Monk', version: 3 }))
            .mockResolvedValueOnce(snapshot({ class_name: 'Monk (old)', version: 1 }));

        const result = await resolveClassVersion('monk', 1);

        expect(mockDoc).toHaveBeenLastCalledWith({ __db: true }, 'classes', 'monk', 'versions', '1');
        expect(result).toEqual({ data: { class_name: 'Monk (old)', version: 1 }, version: 1, latestVersion: 3 });
    });

    test('rejects when the class does not exist', async () => {
        mockGetDoc.mockResolvedValueOnce(snapshot(undefined));
        await expect(resolveClassVersion('gone', 1)).rejects.toThrow('Class not found');
    });

    test('rejects when the requested version has no snapshot', async () => {
        mockGetDoc
            .mockResolvedValueOnce(snapshot({ version: 3 }))
            .mockResolvedValueOnce(snapshot(undefined));
        await expect(resolveClassVersion('monk', 2)).rejects.toThrow('Version 2 not found');
    });
});

describe('listClassVersions', () => {
    test('combines the current class and every snapshot, newest first', async () => {
        mockGetDoc.mockResolvedValueOnce(snapshot({ version: 3, versionNotes: 'Now' }));
        mockGetDocs.mockResolvedValueOnce({ docs: [
            snapshot({ version: 1, versionNotes: '' }, '1'),
            snapshot({ version: 2, versionNotes: 'Middle' }, '2'),
        ] });

        const versions = await listClassVersions('monk');

        expect(versions.map(v => v.version)).toEqual([3, 2, 1]);
        expect(versions[0].notes).toBe('Now');
        expect(versions[1].notes).toBe('Middle');
    });

    test('a never-versioned class lists as just v1', async () => {
        mockGetDoc.mockResolvedValueOnce(snapshot({ class_name: 'Old' }));
        mockGetDocs.mockResolvedValueOnce({ docs: [] });

        expect((await listClassVersions('old')).map(v => v.version)).toEqual([1]);
    });
});

describe('publishClassVersion', () => {
    const current = { class_name: 'Monk', version: 2, actions: [{ actionName: 'Old' }], canWrite: ['a'], public: true };

    beforeEach(() => {
        mockTx.get.mockResolvedValue(snapshot(current));
    });

    test('freezes what is currently saved as the old version and writes the new one as the next number', async () => {
        const next = await publishClassVersion('monk', { class_name: 'Monk', actions: [{ actionName: 'New' }] }, 'Rebalanced', 2);

        expect(next).toBe(3);
        expect(mockTx.set).toHaveBeenCalledWith(
            { __doc: 'classes/monk/versions/2' },
            { class_name: 'Monk', version: 2, actions: [{ actionName: 'Old' }] },
        );
        expect(mockTx.update).toHaveBeenCalledWith(
            { __doc: 'classes/monk' },
            { class_name: 'Monk', actions: [{ actionName: 'New' }], version: 3, versionNotes: 'Rebalanced', publishedAt: 'SERVER_TS' },
        );
    });

    test('the frozen snapshot never carries the class\'s permission fields', async () => {
        await publishClassVersion('monk', {}, '', 2);
        const snapshotWritten = mockTx.set.mock.calls[0][1];
        expect(snapshotWritten).not.toHaveProperty('canWrite');
        expect(snapshotWritten).not.toHaveProperty('public');
    });

    test('a never-versioned class is frozen as v1 and becomes v2', async () => {
        mockTx.get.mockResolvedValue(snapshot({ class_name: 'Old' }));

        expect(await publishClassVersion('old', { class_name: 'Old' }, 'n')).toBe(2);
        expect(mockTx.set.mock.calls[0][0]).toEqual({ __doc: 'classes/old/versions/1' });
    });

    test('refuses to publish when someone else already moved the version on', async () => {
        await expect(publishClassVersion('monk', {}, '', 1)).rejects.toThrow(/published by someone else/);
        expect(mockTx.set).not.toHaveBeenCalled();
        expect(mockTx.update).not.toHaveBeenCalled();
    });

    test('a missing changelog note is stored as an empty string', async () => {
        await publishClassVersion('monk', {}, undefined, 2);
        expect(mockTx.update.mock.calls[0][1].versionNotes).toBe('');
    });
});

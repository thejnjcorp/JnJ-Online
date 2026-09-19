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
import { listRaceVersions, publishRaceVersion, raceContent, resolveRaceVersion, versionOf } from '../../src/utils/raceVersions';

const snapshot = (data, id = 'x') => ({ id, exists: () => data !== undefined, data: () => data });

beforeEach(() => {
    mockDoc.mockImplementation((_db, ...path) => ({ __doc: path.join('/') }));
    mockCollection.mockImplementation((_db, ...path) => ({ __collection: path.join('/') }));
    mockServerTimestamp.mockReturnValue('SERVER_TS');
    mockRunTransaction.mockImplementation((_db, fn) => fn(mockTx));
});

describe('race versioning', () => {
    test('a race with no version field is version 1', () => {
        expect(versionOf({ name: 'Kobold' })).toBe(1);
        expect(versionOf({ version: 2 })).toBe(2);
    });

    test('raceContent drops permission fields but keeps content', () => {
        expect(raceContent({ id: 'r', name: 'Kobold', actions: [], public: true, isDefault: true, canWrite: ['a'], admins: ['a'] }))
            .toEqual({ name: 'Kobold', actions: [] });
    });

    test('an older version is read from races/{id}/versions/{n}', async () => {
        mockGetDoc
            .mockResolvedValueOnce(snapshot({ name: 'Kobold', version: 3 }))
            .mockResolvedValueOnce(snapshot({ name: 'Kobold (old)', version: 1 }));

        const result = await resolveRaceVersion('kobold', 1);

        expect(mockDoc).toHaveBeenLastCalledWith({ __db: true }, 'races', 'kobold', 'versions', '1');
        expect(result).toEqual({ data: { name: 'Kobold (old)', version: 1 }, version: 1, latestVersion: 3 });
    });

    test('a missing race rejects with a race-specific message', async () => {
        mockGetDoc.mockResolvedValueOnce(snapshot(undefined));
        await expect(resolveRaceVersion('gone', 1)).rejects.toThrow('Race not found');
    });

    test('lists the current race plus every snapshot from its own versions subcollection, newest first', async () => {
        mockGetDoc.mockResolvedValueOnce(snapshot({ version: 2, versionNotes: 'Now' }));
        mockGetDocs.mockResolvedValueOnce({ docs: [snapshot({ version: 1 }, '1')] });

        const versions = await listRaceVersions('kobold');

        expect(mockCollection).toHaveBeenCalledWith({ __db: true }, 'races', 'kobold', 'versions');
        expect(versions.map(v => v.version)).toEqual([2, 1]);
    });

    test('publishing freezes the current race into races/{id}/versions/{n} and writes the next version', async () => {
        mockTx.get.mockResolvedValue(snapshot({ name: 'Kobold', version: 1, actions: [{ actionName: 'Old' }], canWrite: ['a'] }));

        const next = await publishRaceVersion('kobold', { name: 'Kobold', actions: [{ actionName: 'New' }] }, 'Tweaks', 1);

        expect(next).toBe(2);
        expect(mockTx.set).toHaveBeenCalledWith(
            { __doc: 'races/kobold/versions/1' },
            { name: 'Kobold', version: 1, actions: [{ actionName: 'Old' }] },
        );
        expect(mockTx.update).toHaveBeenCalledWith(
            { __doc: 'races/kobold' },
            { name: 'Kobold', actions: [{ actionName: 'New' }], version: 2, versionNotes: 'Tweaks', publishedAt: 'SERVER_TS' },
        );
    });

    test('refuses to publish when the version moved on, naming the race', async () => {
        mockTx.get.mockResolvedValue(snapshot({ version: 3 }));
        await expect(publishRaceVersion('kobold', {}, '', 1)).rejects.toThrow('This race was published by someone else while you were editing.');
    });
});

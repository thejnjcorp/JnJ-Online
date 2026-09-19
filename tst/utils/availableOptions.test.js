jest.mock('../../src/utils/firebase', () => ({ db: {} }));
const mockGetDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockWhere = jest.fn();
jest.mock('firebase/firestore', () => ({
    collection: (_db, name) => ({ collection: name }),
    doc: (_db, ...path) => ({ path }),
    getDoc: (...args) => mockGetDoc(...args),
    getDocs: (...args) => mockGetDocs(...args),
    or: (...clauses) => ({ or: clauses }),
    query: (source, filter) => ({ source, filter }),
    where: (...args) => mockWhere(...args),
}));

// eslint-disable-next-line import/first
import { loadAvailableClasses, loadAvailableRaces } from '../../src/utils/availableOptions';

const docsFrom = items => ({ docs: items.map(({ id, ...data }) => ({ id, data: () => data })) });

const items = [
    { id: 'default', isDefault: true },
    { id: 'mine', canWrite: ['me'] },
    { id: 'subscribed' },
    { id: 'other', canRead: ['me'] },
];

beforeEach(() => {
    mockWhere.mockImplementation((...args) => ({ where: args }));
    mockGetDocs.mockResolvedValue(docsFrom(items));
    mockGetDoc.mockResolvedValue({ data: () => ({ subscribedClassIds: ['subscribed'], subscribedRaceIds: ['other'] }) });
});

describe('loadAvailableClasses / loadAvailableRaces', () => {
    test('queries what the viewer can read, in the right collection', async () => {
        await loadAvailableClasses('me', 'camp-1');
        expect(mockGetDocs.mock.calls[0][0].source).toEqual({ collection: 'classes' });
        expect(mockGetDocs.mock.calls[0][0].filter.or.map(clause => clause.where)).toEqual([
            ['public', '==', true], ['canRead', 'array-contains', 'me'], ['canWrite', 'array-contains', 'me'],
        ]);

        await loadAvailableRaces('me', 'camp-1');
        expect(mockGetDocs.mock.calls[1][0].source).toEqual({ collection: 'races' });
    });

    test('offers admin defaults, ones the viewer authored, and ones the campaign subscribed to - not other readable ones', async () => {
        const classes = await loadAvailableClasses('me', 'camp-1');
        expect(classes.map(item => item.id)).toEqual(['default', 'mine', 'subscribed']);
    });

    test('races use the campaign\'s race subscriptions', async () => {
        const races = await loadAvailableRaces('me', 'camp-1');
        expect(races.map(item => item.id)).toEqual(['default', 'mine', 'other']);
    });

    test('a campaign that cannot be read just has no subscriptions', async () => {
        jest.spyOn(console, 'log').mockImplementation(() => {});
        mockGetDoc.mockRejectedValue(new Error('denied'));
        const classes = await loadAvailableClasses('me', 'camp-1');
        expect(classes.map(item => item.id)).toEqual(['default', 'mine']);
    });

    test('a failed query is left for the caller to handle', async () => {
        mockGetDocs.mockRejectedValue(new Error('offline'));
        await expect(loadAvailableClasses('me', 'camp-1')).rejects.toThrow('offline');
    });
});

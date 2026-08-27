jest.mock('../../src/utils/firebase', () => ({ db: {} }));

const mockCollection = jest.fn();
const mockDoc = jest.fn();
const mockQuery = jest.fn();
const mockWhere = jest.fn();
const mockGetDocs = jest.fn();
const mockUpdateDoc = jest.fn();
const mockArrayUnion = jest.fn();

jest.mock('firebase/firestore', () => ({
    arrayUnion: (...args) => mockArrayUnion(...args),
    collection: (...args) => mockCollection(...args),
    doc: (...args) => mockDoc(...args),
    getDocs: (...args) => mockGetDocs(...args),
    query: (...args) => mockQuery(...args),
    updateDoc: (...args) => mockUpdateDoc(...args),
    where: (...args) => mockWhere(...args),
}));

// eslint-disable-next-line import/first
import { subscribeClassToCampaign } from '../../src/utils/campaignSubscriptions';

// resetMocks:true (jest.config.js) wipes implementations before every test,
// so defaults live here rather than inline in the jest.fn(impl) calls above.
beforeEach(() => {
    mockCollection.mockImplementation((_db, name) => ({ __collection: name }));
    mockDoc.mockImplementation((_db, ...path) => ({ __doc: path }));
    mockQuery.mockImplementation((...args) => ({ __query: args }));
    mockWhere.mockImplementation((...args) => ({ __where: args }));
    mockArrayUnion.mockImplementation((...args) => ({ __arrayUnion: args }));
    mockGetDocs.mockResolvedValue({ docs: [] });
    mockUpdateDoc.mockResolvedValue(undefined);
});

describe('subscribeClassToCampaign', () => {
    test('a class with no class_name skips the status lookup entirely and only subscribes the class itself', async () => {
        const result = await subscribeClassToCampaign('campaign-1', { id: 'class-1' });

        expect(mockGetDocs).not.toHaveBeenCalled();
        expect(result).toEqual([]);
        expect(mockUpdateDoc).toHaveBeenCalledWith(
            { __doc: ['campaigns', 'campaign-1'] },
            { subscribedClassIds: { __arrayUnion: ['class-1'] } }
        );
    });

    test('a class with a class_name but no matching public statuses subscribes only the class', async () => {
        mockGetDocs.mockResolvedValue({ docs: [] });

        const result = await subscribeClassToCampaign('campaign-1', { id: 'class-1', class_name: 'Warden' });

        expect(mockWhere).toHaveBeenCalledWith('classes', 'array-contains', 'Warden');
        expect(mockWhere).toHaveBeenCalledWith('public', '==', true);
        expect(result).toEqual([]);
        expect(mockUpdateDoc).toHaveBeenCalledWith(
            expect.anything(),
            { subscribedClassIds: { __arrayUnion: ['class-1'] } }
        );
    });

    test('a class with matching public statuses auto-subscribes the campaign to every one of them', async () => {
        mockGetDocs.mockResolvedValue({ docs: [{ id: 'status-1' }, { id: 'status-2' }] });

        const result = await subscribeClassToCampaign('campaign-1', { id: 'class-1', class_name: 'Warden' });

        expect(result).toEqual(['status-1', 'status-2']);
        expect(mockArrayUnion).toHaveBeenCalledWith('status-1', 'status-2');
        expect(mockUpdateDoc).toHaveBeenCalledWith(
            expect.anything(),
            {
                subscribedClassIds: { __arrayUnion: ['class-1'] },
                subscribedStatusIds: { __arrayUnion: ['status-1', 'status-2'] },
            }
        );
    });

    test('queries the statuses collection scoped to db', async () => {
        await subscribeClassToCampaign('campaign-1', { id: 'class-1', class_name: 'Warden' });
        expect(mockCollection).toHaveBeenCalledWith({}, 'statuses');
    });

    test('updates the campaign doc identified by campaignId', async () => {
        await subscribeClassToCampaign('campaign-42', { id: 'class-1' });
        expect(mockDoc).toHaveBeenCalledWith({}, 'campaigns', 'campaign-42');
    });
});

jest.mock('../../src/utils/firebase', () => ({ auth: {}, db: {} }));

const mockOnAuthStateChanged = jest.fn();
jest.mock('firebase/auth', () => ({
    onAuthStateChanged: (...args) => mockOnAuthStateChanged(...args),
}));

const mockArrayRemove = jest.fn();
const mockCollection = jest.fn();
const mockDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockOr = jest.fn();
const mockQuery = jest.fn();
const mockUpdateDoc = jest.fn();
const mockWhere = jest.fn();
jest.mock('firebase/firestore', () => ({
    arrayRemove: (...args) => mockArrayRemove(...args),
    collection: (...args) => mockCollection(...args),
    doc: (...args) => mockDoc(...args),
    getDocs: (...args) => mockGetDocs(...args),
    or: (...args) => mockOr(...args),
    query: (...args) => mockQuery(...args),
    updateDoc: (...args) => mockUpdateDoc(...args),
    where: (...args) => mockWhere(...args),
}));

const mockSubscribeRaceToCampaign = jest.fn();
jest.mock('../../src/utils/campaignSubscriptions', () => ({
    subscribeRaceToCampaign: (...args) => mockSubscribeRaceToCampaign(...args),
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useNavigate: () => mockNavigate,
}));

// eslint-disable-next-line import/first
import { screen, fireEvent, waitFor } from '@testing-library/react';
// eslint-disable-next-line import/first
import { RaceListPage } from '../../src/components/RaceListPage';
// eslint-disable-next-line import/first
import { renderWithRouter } from '../testUtils/renderWithRouter';

const defaultRace = { id: 'race-def', name: 'Kobold', author: 'Admin', isDefault: true, description: 'Small and **scaly**.', actions: [{ actionName: 'Mild Fire' }, { actionName: 'Pack Tactics' }] };
const legacyRace = { id: 'race-old', name: 'Ancient', isDefault: true, feat: { actionName: 'Old Feat' } };
const poolRace = { id: 'race-pool', name: 'Elf', author: 'Sam', public: true, actions: [{ actionName: 'Keen Senses' }] };
const privateRace = { id: 'race-priv', name: 'Secret Folk', author: 'Sam', public: false, actions: [] };

const directedCampaign = { id: 'camp-1', campaign_name: 'The Iron Vale', director_uid: 'user-1', subscribedRaceIds: [] };
const readOnlyCampaign = { id: 'camp-3', campaign_name: 'ReadOnly', canRead: ['user-1'] };

function docsFrom(items) {
    return { docs: items.map(item => ({ id: item.id, data: () => item })) };
}

function signIn(user, { races = [], campaigns = [] } = {}) {
    mockOnAuthStateChanged.mockImplementation((_auth, callback) => {
        Promise.resolve().then(() => callback(user));
        return jest.fn();
    });
    mockGetDocs.mockImplementation((q) => {
        if (q?.__collection === 'campaigns') return Promise.resolve(docsFrom(campaigns));
        return Promise.resolve(docsFrom(races));
    });
}

beforeEach(() => {
    mockCollection.mockImplementation((_db, name) => ({ __collection: name }));
    mockQuery.mockImplementation((collectionArg, ...rest) => ({ __collection: collectionArg?.__collection, args: rest }));
    mockOr.mockImplementation((...args) => ({ __or: args }));
    mockWhere.mockImplementation((...args) => ({ __where: args }));
    mockDoc.mockImplementation((_db, ...path) => ({ __doc: path }));
    mockArrayRemove.mockImplementation((value) => ({ __arrayRemove: value }));
    mockOnAuthStateChanged.mockImplementation(() => jest.fn());
    mockGetDocs.mockResolvedValue(docsFrom([]));
    mockUpdateDoc.mockResolvedValue(undefined);
    mockSubscribeRaceToCampaign.mockResolvedValue(undefined);
    window.alert = jest.fn();
});

afterEach(() => {
    delete window.alert;
});

describe('RaceListPage', () => {
    test('sets the document title and shows the empty state before auth resolves', () => {
        renderWithRouter(<RaceListPage />);
        expect(document.title).toBe('Races');
        expect(screen.getByText('No races match these filters.')).toBeInTheDocument();
    });

    test('queries public races plus ones the user can read or write, never the whole collection', async () => {
        signIn({ uid: 'user-1' }, { races: [defaultRace] });
        renderWithRouter(<RaceListPage />);

        expect(await screen.findByText('Kobold')).toBeInTheDocument();
        expect(mockCollection).toHaveBeenCalledWith({}, 'races');
        expect(mockWhere).toHaveBeenCalledWith('public', '==', true);
        expect(mockWhere).toHaveBeenCalledWith('canRead', 'array-contains', 'user-1');
        expect(mockWhere).toHaveBeenCalledWith('canWrite', 'array-contains', 'user-1');
    });

    test('a failed races query is logged, leaving the list empty instead of crashing', async () => {
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        signIn({ uid: 'user-1' });
        mockGetDocs.mockImplementation((q) => q?.__collection === 'races' ? Promise.reject(new Error('offline')) : Promise.resolve(docsFrom([])));
        renderWithRouter(<RaceListPage />);

        await waitFor(() => expect(consoleSpy).toHaveBeenCalled());
        expect(screen.getByText('No races match these filters.')).toBeInTheDocument();
        consoleSpy.mockRestore();
    });

    describe('cards', () => {
        test('shows the author, the count of racial feats and the markdown lore', async () => {
            signIn({ uid: 'user-1' }, { races: [defaultRace] });
            renderWithRouter(<RaceListPage />);
            await screen.findByText('Kobold');

            expect(screen.getByText(/by Admin/)).toBeInTheDocument();
            expect(screen.getByText(/2 racial feats/)).toBeInTheDocument();
            expect(screen.getByText('scaly').tagName).toBe('STRONG');
        });

        test('a legacy race with a single feat counts it', async () => {
            signIn({ uid: 'user-1' }, { races: [legacyRace] });
            renderWithRouter(<RaceListPage />);
            await screen.findByText('Ancient');
            expect(screen.getByText(/1 racial feat$/)).toBeInTheDocument();
        });

        test.each([
            ['Default', defaultRace],
            ['Pool', poolRace],
            ['Private', privateRace],
        ])('shows the "%s" visibility badge for the right kind of race', async (badgeLabel, race) => {
            signIn({ uid: 'user-1' }, { races: [race] });
            renderWithRouter(<RaceListPage />);
            await screen.findByText(race.name);
            expect(screen.getByText(badgeLabel, { selector: '.ClassListPage-card-vis-badge' })).toBeInTheDocument();
        });

        test('View Race navigates to the race detail route', async () => {
            signIn({ uid: 'user-1' }, { races: [defaultRace] });
            renderWithRouter(<RaceListPage />);
            await screen.findByText('Kobold');

            fireEvent.click(screen.getByRole('button', { name: 'View Race' }));

            expect(mockNavigate).toHaveBeenCalledWith('/races/race-def');
        });

        test('Add to Campaign is hidden for a private race', async () => {
            signIn({ uid: 'user-1' }, { races: [privateRace] });
            renderWithRouter(<RaceListPage />);
            await screen.findByText('Secret Folk');
            expect(screen.queryByRole('button', { name: 'Add to Campaign' })).not.toBeInTheDocument();
        });

        test('+ Create New Race navigates to /races', () => {
            renderWithRouter(<RaceListPage />);
            fireEvent.click(screen.getByRole('button', { name: '+ Create New Race' }));
            expect(mockNavigate).toHaveBeenCalledWith('/races');
        });
    });

    test('filtering by visibility shows only matching cards', async () => {
        signIn({ uid: 'user-1' }, { races: [defaultRace, poolRace, privateRace] });
        renderWithRouter(<RaceListPage />);
        await screen.findByText('Kobold');

        fireEvent.click(screen.getByRole('button', { name: 'Private' }));

        expect(screen.queryByText('Kobold')).not.toBeInTheDocument();
        expect(screen.getByText('Secret Folk')).toBeInTheDocument();
    });

    describe('Add to Campaign popover', () => {
        test('shows a hint when the user directs/writes to no campaigns', async () => {
            signIn({ uid: 'user-1' }, { races: [defaultRace], campaigns: [readOnlyCampaign] });
            renderWithRouter(<RaceListPage />);
            await screen.findByText('Kobold');

            fireEvent.click(screen.getByRole('button', { name: 'Add to Campaign' }));

            expect(screen.getByText("You don't direct (or have write access to) any campaigns yet.")).toBeInTheDocument();
            expect(screen.queryByText('ReadOnly')).not.toBeInTheDocument();
        });

        test('subscribing calls subscribeRaceToCampaign and marks the chip selected', async () => {
            signIn({ uid: 'user-1' }, { races: [poolRace], campaigns: [directedCampaign] });
            renderWithRouter(<RaceListPage />);
            await screen.findByText('Elf');
            fireEvent.click(screen.getByRole('button', { name: 'Add to Campaign' }));

            fireEvent.click(screen.getByRole('button', { name: 'The Iron Vale' }));

            expect(await screen.findByRole('button', { name: /The Iron Vale.*✓/ })).toBeInTheDocument();
            expect(mockSubscribeRaceToCampaign).toHaveBeenCalledWith('camp-1', poolRace);
        });

        test('unsubscribing writes arrayRemove on subscribedRaceIds and clears the checkmark', async () => {
            const subscribed = { ...directedCampaign, subscribedRaceIds: ['race-pool'] };
            signIn({ uid: 'user-1' }, { races: [poolRace], campaigns: [subscribed] });
            renderWithRouter(<RaceListPage />);
            await screen.findByText('Elf');
            fireEvent.click(screen.getByRole('button', { name: 'Add to Campaign' }));
            await screen.findByRole('button', { name: /The Iron Vale.*✓/ });

            fireEvent.click(screen.getByRole('button', { name: /The Iron Vale/ }));

            await waitFor(() => expect(screen.queryByRole('button', { name: /The Iron Vale.*✓/ })).not.toBeInTheDocument());
            expect(mockUpdateDoc).toHaveBeenCalledWith(
                { __doc: ['campaigns', 'camp-1'] },
                { subscribedRaceIds: { __arrayRemove: 'race-pool' } },
            );
            expect(mockSubscribeRaceToCampaign).not.toHaveBeenCalled();
        });

        test('a subscription error is alerted', async () => {
            signIn({ uid: 'user-1' }, { races: [poolRace], campaigns: [directedCampaign] });
            mockSubscribeRaceToCampaign.mockRejectedValue(new Error('offline'));
            renderWithRouter(<RaceListPage />);
            await screen.findByText('Elf');
            fireEvent.click(screen.getByRole('button', { name: 'Add to Campaign' }));

            fireEvent.click(screen.getByRole('button', { name: 'The Iron Vale' }));

            await waitFor(() => expect(window.alert).toHaveBeenCalled());
        });
    });
});

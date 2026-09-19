jest.mock('../../src/utils/firebase', () => ({ auth: {}, db: {} }));

const mockOnAuthStateChanged = jest.fn();
jest.mock('firebase/auth', () => ({
    onAuthStateChanged: (...args) => mockOnAuthStateChanged(...args),
}));

const mockArrayRemove = jest.fn();
const mockCollection = jest.fn();
const mockDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockOnSnapshot = jest.fn();
const mockOr = jest.fn();
const mockQuery = jest.fn();
const mockUpdateDoc = jest.fn();
const mockWhere = jest.fn();
jest.mock('firebase/firestore', () => ({
    arrayRemove: (...args) => mockArrayRemove(...args),
    collection: (...args) => mockCollection(...args),
    doc: (...args) => mockDoc(...args),
    getDocs: (...args) => mockGetDocs(...args),
    onSnapshot: (...args) => mockOnSnapshot(...args),
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
import { screen, fireEvent, waitFor, act } from '@testing-library/react';
// eslint-disable-next-line import/first
import { CampaignRacesPage } from '../../src/components/CampaignRacesPage';
// eslint-disable-next-line import/first
import { renderWithRouter } from '../testUtils/renderWithRouter';

const defaultRace = { id: 'race-def', name: 'Kobold', isDefault: true };
const subscribedRace = { id: 'race-sub', name: 'Elf', public: true, author: 'Sam', description: 'Graceful.' };
const browsableRace = { id: 'race-browse', name: 'Dwarf', public: true, author: 'Sam', description: 'Sturdy.' };
const privateRace = { id: 'race-priv', name: 'Secret Folk', public: false };

const ROUTE = '/campaigns/camp-1/races';

function docsFrom(items) {
    return { docs: items.map(item => ({ id: item.id, data: () => item })) };
}

function fireCampaignSnapshot(data) {
    const callback = mockOnSnapshot.mock.calls[0][1];
    act(() => callback({ exists: () => true, id: 'camp-1', data: () => data }));
}

function signIn(user, races = []) {
    mockOnAuthStateChanged.mockImplementation((_auth, callback) => {
        Promise.resolve().then(() => callback(user));
        return jest.fn();
    });
    mockGetDocs.mockResolvedValue(docsFrom(races));
}

beforeEach(() => {
    mockCollection.mockImplementation((_db, name) => ({ __collection: name }));
    mockDoc.mockImplementation((_db, ...path) => ({ __doc: path }));
    mockQuery.mockImplementation((...args) => ({ __query: args }));
    mockOr.mockImplementation((...args) => ({ __or: args }));
    mockWhere.mockImplementation((...args) => ({ __where: args }));
    mockOnSnapshot.mockImplementation(() => jest.fn());
    mockOnAuthStateChanged.mockImplementation(() => jest.fn());
    mockGetDocs.mockResolvedValue(docsFrom([]));
    mockArrayRemove.mockImplementation((value) => ({ __arrayRemove: value }));
    mockUpdateDoc.mockResolvedValue(undefined);
    mockSubscribeRaceToCampaign.mockResolvedValue(undefined);
    window.alert = jest.fn();
});

afterEach(() => {
    delete window.alert;
});

describe('CampaignRacesPage', () => {
    test('shows a loading state until the campaign doc arrives, and listens to the campaign in the URL', () => {
        renderWithRouter(<CampaignRacesPage />, { route: ROUTE });
        expect(screen.getByText('Loading…')).toBeInTheDocument();
        expect(mockDoc).toHaveBeenCalledWith({}, 'campaigns', 'camp-1');
    });

    test('the breadcrumb navigates back to the campaign page', () => {
        renderWithRouter(<CampaignRacesPage />, { route: ROUTE });
        fireCampaignSnapshot({ campaign_name: 'The Iron Vale', director_uid: 'owner-1' });

        fireEvent.click(screen.getByRole('button', { name: /The Iron Vale/ }));

        expect(mockNavigate).toHaveBeenCalledWith('/campaigns/camp-1');
    });

    test('titles the page Manage Races', () => {
        renderWithRouter(<CampaignRacesPage />, { route: ROUTE });
        expect(document.title).toContain('Manage Races');
        fireCampaignSnapshot({ campaign_name: 'The Iron Vale', director_uid: 'owner-1' });
        expect(screen.getByRole('heading', { name: 'Manage Races' })).toBeInTheDocument();
    });

    describe('write permissions', () => {
        test('a non-writer gets a read-only banner and no action buttons', async () => {
            signIn({ uid: 'stranger-1' }, [subscribedRace, browsableRace]);
            renderWithRouter(<CampaignRacesPage />, { route: ROUTE });
            fireCampaignSnapshot({ campaign_name: 'The Iron Vale', director_uid: 'owner-1', subscribedRaceIds: ['race-sub'] });
            await screen.findByText('Elf');

            expect(screen.getByText("You don't have write access to this campaign, so this view is read-only.")).toBeInTheDocument();
            expect(screen.queryByRole('button', { name: 'Remove from campaign' })).not.toBeInTheDocument();
            expect(screen.queryByRole('button', { name: '+ Add to Campaign' })).not.toBeInTheDocument();
        });

        test('the director gets the action buttons; so does a co-writer', async () => {
            signIn({ uid: 'co-writer-1' }, [subscribedRace, browsableRace]);
            renderWithRouter(<CampaignRacesPage />, { route: ROUTE });
            fireCampaignSnapshot({ campaign_name: 'The Iron Vale', director_uid: 'owner-1', canWrite: ['co-writer-1'], subscribedRaceIds: ['race-sub'] });
            await screen.findByText('Elf');

            expect(screen.queryByText(/read-only/)).not.toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Remove from campaign' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: '+ Add to Campaign' })).toBeInTheDocument();
        });
    });

    describe('sections', () => {
        test('default races are listed as always included', async () => {
            signIn({ uid: 'owner-1' }, [defaultRace]);
            renderWithRouter(<CampaignRacesPage />, { route: ROUTE });
            fireCampaignSnapshot({ campaign_name: 'The Iron Vale', director_uid: 'owner-1' });

            expect(await screen.findByText('Kobold')).toBeInTheDocument();
            expect(screen.getByText('Included')).toBeInTheDocument();
        });

        test('with no default races a hint is shown', async () => {
            signIn({ uid: 'owner-1' }, []);
            renderWithRouter(<CampaignRacesPage />, { route: ROUTE });
            fireCampaignSnapshot({ campaign_name: 'The Iron Vale', director_uid: 'owner-1' });
            expect(await screen.findByText('No default races yet.')).toBeInTheDocument();
        });

        test('subscribed pool races are counted and listed, without the unsubscribed or private ones', async () => {
            signIn({ uid: 'owner-1' }, [subscribedRace, browsableRace, privateRace]);
            renderWithRouter(<CampaignRacesPage />, { route: ROUTE });
            fireCampaignSnapshot({ campaign_name: 'The Iron Vale', director_uid: 'owner-1', subscribedRaceIds: ['race-sub'] });

            expect(await screen.findByText('1 added to this campaign')).toBeInTheDocument();
            expect(screen.getByText('Graceful.')).toBeInTheDocument();
            expect(screen.queryByText('Secret Folk')).not.toBeInTheDocument();
        });

        test('shows an empty-card message when nothing is subscribed', async () => {
            signIn({ uid: 'owner-1' }, [browsableRace]);
            renderWithRouter(<CampaignRacesPage />, { route: ROUTE });
            fireCampaignSnapshot({ campaign_name: 'The Iron Vale', director_uid: 'owner-1' });
            expect(await screen.findByText(/No pool races subscribed yet/)).toBeInTheDocument();
        });

        test('browse lists only unsubscribed pool races, with author and description', async () => {
            signIn({ uid: 'owner-1' }, [defaultRace, subscribedRace, browsableRace]);
            renderWithRouter(<CampaignRacesPage />, { route: ROUTE });
            fireCampaignSnapshot({ campaign_name: 'The Iron Vale', director_uid: 'owner-1', subscribedRaceIds: ['race-sub'] });

            expect(await screen.findByText('Dwarf')).toBeInTheDocument();
            expect(screen.getByText('by Sam')).toBeInTheDocument();
            expect(screen.getByText('Sturdy.')).toBeInTheDocument();
        });

        test('when every pool race is subscribed the browse section says so', async () => {
            signIn({ uid: 'owner-1' }, [subscribedRace]);
            renderWithRouter(<CampaignRacesPage />, { route: ROUTE });
            fireCampaignSnapshot({ campaign_name: 'The Iron Vale', director_uid: 'owner-1', subscribedRaceIds: ['race-sub'] });
            expect(await screen.findByText('Every pool race is already subscribed.')).toBeInTheDocument();
        });
    });

    describe('subscribing', () => {
        test('+ Add to Campaign subscribes the race', async () => {
            signIn({ uid: 'owner-1' }, [browsableRace]);
            renderWithRouter(<CampaignRacesPage />, { route: ROUTE });
            fireCampaignSnapshot({ campaign_name: 'The Iron Vale', director_uid: 'owner-1' });
            await screen.findByText('Dwarf');

            fireEvent.click(screen.getByRole('button', { name: '+ Add to Campaign' }));

            await waitFor(() => expect(mockSubscribeRaceToCampaign).toHaveBeenCalledWith('camp-1', browsableRace));
        });

        test('Remove from campaign writes arrayRemove on subscribedRaceIds', async () => {
            signIn({ uid: 'owner-1' }, [subscribedRace]);
            renderWithRouter(<CampaignRacesPage />, { route: ROUTE });
            fireCampaignSnapshot({ campaign_name: 'The Iron Vale', director_uid: 'owner-1', subscribedRaceIds: ['race-sub'] });
            await screen.findByText('Elf');

            fireEvent.click(screen.getByRole('button', { name: 'Remove from campaign' }));

            await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalledWith(
                { __doc: ['campaigns', 'camp-1'] },
                { subscribedRaceIds: { __arrayRemove: 'race-sub' } },
            ));
        });

        test('a failed subscribe is alerted', async () => {
            mockSubscribeRaceToCampaign.mockRejectedValue(new Error('offline'));
            signIn({ uid: 'owner-1' }, [browsableRace]);
            renderWithRouter(<CampaignRacesPage />, { route: ROUTE });
            fireCampaignSnapshot({ campaign_name: 'The Iron Vale', director_uid: 'owner-1' });
            await screen.findByText('Dwarf');

            fireEvent.click(screen.getByRole('button', { name: '+ Add to Campaign' }));

            await waitFor(() => expect(window.alert).toHaveBeenCalled());
        });
    });

    test('queries public races plus ones the signed-in user can read or write', async () => {
        signIn({ uid: 'owner-1' }, []);
        renderWithRouter(<CampaignRacesPage />, { route: ROUTE });
        fireCampaignSnapshot({ campaign_name: 'The Iron Vale', director_uid: 'owner-1' });

        await waitFor(() => expect(mockGetDocs).toHaveBeenCalled());
        expect(mockCollection).toHaveBeenCalledWith({}, 'races');
        expect(mockWhere).toHaveBeenCalledWith('public', '==', true);
        expect(mockWhere).toHaveBeenCalledWith('canRead', 'array-contains', 'owner-1');
        expect(mockWhere).toHaveBeenCalledWith('canWrite', 'array-contains', 'owner-1');
        await act(async () => { await Promise.resolve(); });
    });
});

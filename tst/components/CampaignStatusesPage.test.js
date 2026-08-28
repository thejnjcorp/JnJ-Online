jest.mock('../../src/utils/firebase', () => ({ auth: {}, db: {} }));

const mockOnAuthStateChanged = jest.fn();
jest.mock('firebase/auth', () => ({
    onAuthStateChanged: (...args) => mockOnAuthStateChanged(...args),
}));

const mockArrayRemove = jest.fn();
const mockArrayUnion = jest.fn();
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
    arrayUnion: (...args) => mockArrayUnion(...args),
    collection: (...args) => mockCollection(...args),
    doc: (...args) => mockDoc(...args),
    getDocs: (...args) => mockGetDocs(...args),
    onSnapshot: (...args) => mockOnSnapshot(...args),
    or: (...args) => mockOr(...args),
    query: (...args) => mockQuery(...args),
    updateDoc: (...args) => mockUpdateDoc(...args),
    where: (...args) => mockWhere(...args),
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useNavigate: () => mockNavigate,
}));

// eslint-disable-next-line import/first
import { screen, fireEvent, waitFor, act } from '@testing-library/react';
// eslint-disable-next-line import/first
import { CampaignStatusesPage } from '../../src/components/CampaignStatusesPage';
// eslint-disable-next-line import/first
import { renderWithRouter } from '../testUtils/renderWithRouter';

const defaultStatus = { id: 'status-def', name: 'Blessed', polarity: 'buff', isDefault: true };
const subscribedStatus = { id: 'status-sub', name: 'Poisoned', polarity: 'debuff', public: true, description: 'Ongoing damage.' };
const browsableStatus = { id: 'status-browse', name: 'Dazed', polarity: 'neutral', public: true, description: 'Confused.' };

function docsFrom(items) {
    return { docs: items.map(item => ({ id: item.id, data: () => item })) };
}

function fireCampaignSnapshot(data) {
    const callback = mockOnSnapshot.mock.calls[0][1];
    act(() => callback({ exists: () => true, id: 'camp-1', data: () => data }));
}

function signIn(user, statuses = []) {
    mockOnAuthStateChanged.mockImplementation((_auth, callback) => {
        Promise.resolve().then(() => callback(user));
        return jest.fn();
    });
    mockGetDocs.mockResolvedValue(docsFrom(statuses));
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
    mockArrayUnion.mockImplementation((value) => ({ __arrayUnion: value }));
    mockUpdateDoc.mockResolvedValue(undefined);
    window.alert = jest.fn();
});

afterEach(() => {
    delete window.alert;
});

describe('CampaignStatusesPage', () => {
    test('shows a loading state until the campaign doc arrives', () => {
        renderWithRouter(<CampaignStatusesPage />, { route: '/campaigns/camp-1/statuses' });
        expect(screen.getByText('Loading…')).toBeInTheDocument();
    });

    test('subscribes to the campaign doc identified by the URL', () => {
        renderWithRouter(<CampaignStatusesPage />, { route: '/campaigns/camp-1/statuses' });
        expect(mockDoc).toHaveBeenCalledWith({}, 'campaigns', 'camp-1');
    });

    test('once loaded, shows a breadcrumb back to the campaign', () => {
        renderWithRouter(<CampaignStatusesPage />, { route: '/campaigns/camp-1/statuses' });
        fireCampaignSnapshot({ campaign_name: 'The Iron Vale', director_uid: 'owner-1' });
        expect(screen.getByRole('button', { name: /The Iron Vale/ })).toBeInTheDocument();
    });

    test('the breadcrumb navigates back to the campaign page', () => {
        renderWithRouter(<CampaignStatusesPage />, { route: '/campaigns/camp-1/statuses' });
        fireCampaignSnapshot({ campaign_name: 'The Iron Vale', director_uid: 'owner-1' });

        fireEvent.click(screen.getByRole('button', { name: /The Iron Vale/ }));

        expect(mockNavigate).toHaveBeenCalledWith('/campaigns/camp-1');
    });

    describe('write permissions', () => {
        test('shows a read-only banner and no action buttons for a non-writer', async () => {
            signIn({ uid: 'stranger-1' }, [subscribedStatus, browsableStatus]);
            renderWithRouter(<CampaignStatusesPage />, { route: '/campaigns/camp-1/statuses' });
            fireCampaignSnapshot({ campaign_name: 'The Iron Vale', director_uid: 'owner-1', subscribedStatusIds: ['status-sub'] });
            await screen.findByText('Poisoned');

            expect(screen.getByText("You don't have write access to this campaign, so this view is read-only.")).toBeInTheDocument();
            expect(screen.queryByRole('button', { name: 'Remove from campaign' })).not.toBeInTheDocument();
            expect(screen.queryByRole('button', { name: '+ Add to Campaign' })).not.toBeInTheDocument();
        });

        test('no banner and action buttons appear for the director', async () => {
            signIn({ uid: 'owner-1' }, [subscribedStatus, browsableStatus]);
            renderWithRouter(<CampaignStatusesPage />, { route: '/campaigns/camp-1/statuses' });
            fireCampaignSnapshot({ campaign_name: 'The Iron Vale', director_uid: 'owner-1', subscribedStatusIds: ['status-sub'] });
            await screen.findByText('Poisoned');

            expect(screen.queryByText(/read-only/)).not.toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Remove from campaign' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: '+ Add to Campaign' })).toBeInTheDocument();
        });

        test('a co-writer (not the director) also gets write access', async () => {
            signIn({ uid: 'co-writer-1' }, [subscribedStatus]);
            renderWithRouter(<CampaignStatusesPage />, { route: '/campaigns/camp-1/statuses' });
            fireCampaignSnapshot({ campaign_name: 'The Iron Vale', director_uid: 'owner-1', canWrite: ['co-writer-1'], subscribedStatusIds: ['status-sub'] });
            await screen.findByText('Poisoned');
            expect(screen.getByRole('button', { name: 'Remove from campaign' })).toBeInTheDocument();
        });
    });

    describe('default statuses', () => {
        test('lists default statuses as always-included, with no remove option', async () => {
            signIn({ uid: 'owner-1' }, [defaultStatus]);
            renderWithRouter(<CampaignStatusesPage />, { route: '/campaigns/camp-1/statuses' });
            fireCampaignSnapshot({ campaign_name: 'The Iron Vale', director_uid: 'owner-1' });

            expect(await screen.findByText('Blessed')).toBeInTheDocument();
            expect(screen.getByText('Included')).toBeInTheDocument();
        });

        test('shows a hint when there are no default statuses', async () => {
            signIn({ uid: 'owner-1' }, []);
            renderWithRouter(<CampaignStatusesPage />, { route: '/campaigns/camp-1/statuses' });
            fireCampaignSnapshot({ campaign_name: 'The Iron Vale', director_uid: 'owner-1' });
            expect(await screen.findByText('No default statuses yet.')).toBeInTheDocument();
        });
    });

    describe('subscribed pool statuses', () => {
        test('shows the subscribed count and only actually-subscribed pool statuses', async () => {
            signIn({ uid: 'owner-1' }, [subscribedStatus, browsableStatus]);
            renderWithRouter(<CampaignStatusesPage />, { route: '/campaigns/camp-1/statuses' });
            fireCampaignSnapshot({ campaign_name: 'The Iron Vale', director_uid: 'owner-1', subscribedStatusIds: ['status-sub'] });

            expect(await screen.findByText('1 added to this campaign')).toBeInTheDocument();
            expect(screen.getByText('Poisoned')).toBeInTheDocument();
        });

        test('shows an empty-card message when nothing is subscribed', async () => {
            signIn({ uid: 'owner-1' }, [browsableStatus]);
            renderWithRouter(<CampaignStatusesPage />, { route: '/campaigns/camp-1/statuses' });
            fireCampaignSnapshot({ campaign_name: 'The Iron Vale', director_uid: 'owner-1' });
            expect(await screen.findByText(/No pool statuses subscribed yet/)).toBeInTheDocument();
        });

        test('Remove from campaign writes arrayRemove for that status id', async () => {
            signIn({ uid: 'owner-1' }, [subscribedStatus]);
            renderWithRouter(<CampaignStatusesPage />, { route: '/campaigns/camp-1/statuses' });
            fireCampaignSnapshot({ campaign_name: 'The Iron Vale', director_uid: 'owner-1', subscribedStatusIds: ['status-sub'] });
            await screen.findByText('Poisoned');

            fireEvent.click(screen.getByRole('button', { name: 'Remove from campaign' }));

            await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalledWith(
                { __doc: ['campaigns', 'camp-1'] },
                { subscribedStatusIds: { __arrayRemove: 'status-sub' } },
            ));
        });

        test('a failed remove is alerted', async () => {
            mockUpdateDoc.mockRejectedValue(new Error('offline'));
            signIn({ uid: 'owner-1' }, [subscribedStatus]);
            renderWithRouter(<CampaignStatusesPage />, { route: '/campaigns/camp-1/statuses' });
            fireCampaignSnapshot({ campaign_name: 'The Iron Vale', director_uid: 'owner-1', subscribedStatusIds: ['status-sub'] });
            await screen.findByText('Poisoned');

            fireEvent.click(screen.getByRole('button', { name: 'Remove from campaign' }));

            await waitFor(() => expect(window.alert).toHaveBeenCalled());
        });
    });

    describe('browse pool statuses', () => {
        test('excludes default and already-subscribed statuses, shows the description', async () => {
            signIn({ uid: 'owner-1' }, [defaultStatus, subscribedStatus, browsableStatus]);
            renderWithRouter(<CampaignStatusesPage />, { route: '/campaigns/camp-1/statuses' });
            fireCampaignSnapshot({ campaign_name: 'The Iron Vale', director_uid: 'owner-1', subscribedStatusIds: ['status-sub'] });

            expect(await screen.findByText('Dazed')).toBeInTheDocument();
            expect(screen.getByText('Confused.')).toBeInTheDocument();
        });

        test('filtering by polarity narrows the browse list', async () => {
            signIn({ uid: 'owner-1' }, [browsableStatus]);
            renderWithRouter(<CampaignStatusesPage />, { route: '/campaigns/camp-1/statuses' });
            fireCampaignSnapshot({ campaign_name: 'The Iron Vale', director_uid: 'owner-1' });
            await screen.findByText('Dazed');

            fireEvent.click(screen.getByRole('button', { name: 'Debuff' }));

            expect(screen.queryByText('Dazed')).not.toBeInTheDocument();
            expect(screen.getByText(/Every pool status matching this filter is already subscribed/)).toBeInTheDocument();
        });

        test('+ Add to Campaign writes arrayUnion for that status id', async () => {
            signIn({ uid: 'owner-1' }, [browsableStatus]);
            renderWithRouter(<CampaignStatusesPage />, { route: '/campaigns/camp-1/statuses' });
            fireCampaignSnapshot({ campaign_name: 'The Iron Vale', director_uid: 'owner-1' });
            await screen.findByText('Dazed');

            fireEvent.click(screen.getByRole('button', { name: '+ Add to Campaign' }));

            await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalledWith(
                { __doc: ['campaigns', 'camp-1'] },
                { subscribedStatusIds: { __arrayUnion: 'status-browse' } },
            ));
        });

        test('a failed subscribe is alerted', async () => {
            mockUpdateDoc.mockRejectedValue(new Error('offline'));
            signIn({ uid: 'owner-1' }, [browsableStatus]);
            renderWithRouter(<CampaignStatusesPage />, { route: '/campaigns/camp-1/statuses' });
            fireCampaignSnapshot({ campaign_name: 'The Iron Vale', director_uid: 'owner-1' });
            await screen.findByText('Dazed');

            fireEvent.click(screen.getByRole('button', { name: '+ Add to Campaign' }));

            await waitFor(() => expect(window.alert).toHaveBeenCalled());
        });
    });

    test('queries public statuses plus ones the signed-in user can read or write', async () => {
        signIn({ uid: 'owner-1' }, []);
        renderWithRouter(<CampaignStatusesPage />, { route: '/campaigns/camp-1/statuses' });
        fireCampaignSnapshot({ campaign_name: 'The Iron Vale', director_uid: 'owner-1' });

        await waitFor(() => expect(mockGetDocs).toHaveBeenCalled());
        expect(mockCollection).toHaveBeenCalledWith({}, 'statuses');
        expect(mockWhere).toHaveBeenCalledWith('public', '==', true);
        expect(mockWhere).toHaveBeenCalledWith('canRead', 'array-contains', 'owner-1');
        expect(mockWhere).toHaveBeenCalledWith('canWrite', 'array-contains', 'owner-1');
        await act(async () => { await Promise.resolve(); });
    });
});

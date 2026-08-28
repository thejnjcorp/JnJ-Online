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

const mockSubscribeClassToCampaign = jest.fn();
jest.mock('../../src/utils/campaignSubscriptions', () => ({
    subscribeClassToCampaign: (...args) => mockSubscribeClassToCampaign(...args),
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useNavigate: () => mockNavigate,
}));

// eslint-disable-next-line import/first
import { screen, fireEvent, waitFor, act } from '@testing-library/react';
// eslint-disable-next-line import/first
import { CampaignClassesPage } from '../../src/components/CampaignClassesPage';
// eslint-disable-next-line import/first
import { renderWithRouter } from '../testUtils/renderWithRouter';

const defaultClass = { id: 'class-def', class_name: 'Warrior', class_type: 'Attrionist', isDefault: true };
const subscribedClass = { id: 'class-sub', class_name: 'Trickster', class_type: 'Manipulator', public: true, author: 'Sam', description: 'Sneaky.' };
const browsableClass = { id: 'class-browse', class_name: 'Cleric', class_type: 'Crit Hunter', public: true, author: 'Sam', description: 'Heals.' };

function docsFrom(items) {
    return { docs: items.map(item => ({ id: item.id, data: () => item })) };
}

function fireCampaignSnapshot(data) {
    const callback = mockOnSnapshot.mock.calls[0][1];
    act(() => callback({ exists: () => true, id: 'camp-1', data: () => data }));
}

function signIn(user, classes = []) {
    mockOnAuthStateChanged.mockImplementation((_auth, callback) => {
        Promise.resolve().then(() => callback(user));
        return jest.fn();
    });
    mockGetDocs.mockResolvedValue(docsFrom(classes));
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
    mockSubscribeClassToCampaign.mockResolvedValue([]);
    window.alert = jest.fn();
});

afterEach(() => {
    delete window.alert;
});

describe('CampaignClassesPage', () => {
    test('shows a loading state until the campaign doc arrives', () => {
        renderWithRouter(<CampaignClassesPage />, { route: '/campaigns/camp-1/classes' });
        expect(screen.getByText('Loading…')).toBeInTheDocument();
    });

    test('subscribes to the campaign doc identified by the URL', () => {
        renderWithRouter(<CampaignClassesPage />, { route: '/campaigns/camp-1/classes' });
        expect(mockDoc).toHaveBeenCalledWith({}, 'campaigns', 'camp-1');
    });

    test('once loaded, shows a breadcrumb back to the campaign', () => {
        renderWithRouter(<CampaignClassesPage />, { route: '/campaigns/camp-1/classes' });
        fireCampaignSnapshot({ campaign_name: 'The Iron Vale', director_uid: 'owner-1' });

        // The per-render "Manage Classes" title assignment at the top of the
        // component body re-runs on every re-render (it isn't gated in an
        // effect), so it always wins over the onSnapshot callback's own
        // "Manage Classes - <name>" assignment by the time this settles -
        // that's existing behavior, not something this test is asserting on.
        expect(screen.getByRole('button', { name: /The Iron Vale/ })).toBeInTheDocument();
    });

    test('the breadcrumb navigates back to the campaign page', () => {
        renderWithRouter(<CampaignClassesPage />, { route: '/campaigns/camp-1/classes' });
        fireCampaignSnapshot({ campaign_name: 'The Iron Vale', director_uid: 'owner-1' });

        fireEvent.click(screen.getByRole('button', { name: /The Iron Vale/ }));

        expect(mockNavigate).toHaveBeenCalledWith('/campaigns/camp-1');
    });

    describe('write permissions', () => {
        test('shows a read-only banner and no action buttons for a non-writer', async () => {
            signIn({ uid: 'stranger-1' }, [subscribedClass, browsableClass]);
            renderWithRouter(<CampaignClassesPage />, { route: '/campaigns/camp-1/classes' });
            fireCampaignSnapshot({ campaign_name: 'The Iron Vale', director_uid: 'owner-1', subscribedClassIds: ['class-sub'] });
            await screen.findByText('Trickster');

            expect(screen.getByText("You don't have write access to this campaign, so this view is read-only.")).toBeInTheDocument();
            expect(screen.queryByRole('button', { name: 'Remove from campaign' })).not.toBeInTheDocument();
            expect(screen.queryByRole('button', { name: '+ Add to Campaign' })).not.toBeInTheDocument();
        });

        test('no banner and action buttons appear for the director', async () => {
            signIn({ uid: 'owner-1' }, [subscribedClass, browsableClass]);
            renderWithRouter(<CampaignClassesPage />, { route: '/campaigns/camp-1/classes' });
            fireCampaignSnapshot({ campaign_name: 'The Iron Vale', director_uid: 'owner-1', subscribedClassIds: ['class-sub'] });
            await screen.findByText('Trickster');

            expect(screen.queryByText(/read-only/)).not.toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Remove from campaign' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: '+ Add to Campaign' })).toBeInTheDocument();
        });

        test('a co-writer (not the director) also gets write access', async () => {
            signIn({ uid: 'co-writer-1' }, [subscribedClass]);
            renderWithRouter(<CampaignClassesPage />, { route: '/campaigns/camp-1/classes' });
            fireCampaignSnapshot({ campaign_name: 'The Iron Vale', director_uid: 'owner-1', canWrite: ['co-writer-1'], subscribedClassIds: ['class-sub'] });
            await screen.findByText('Trickster');
            expect(screen.getByRole('button', { name: 'Remove from campaign' })).toBeInTheDocument();
        });
    });

    describe('default classes', () => {
        test('lists default classes as always-included, with no remove option', async () => {
            signIn({ uid: 'owner-1' }, [defaultClass]);
            renderWithRouter(<CampaignClassesPage />, { route: '/campaigns/camp-1/classes' });
            fireCampaignSnapshot({ campaign_name: 'The Iron Vale', director_uid: 'owner-1' });

            expect(await screen.findByText('Warrior')).toBeInTheDocument();
            expect(screen.getByText('Included')).toBeInTheDocument();
        });

        test('shows a hint when there are no default classes', async () => {
            signIn({ uid: 'owner-1' }, []);
            renderWithRouter(<CampaignClassesPage />, { route: '/campaigns/camp-1/classes' });
            fireCampaignSnapshot({ campaign_name: 'The Iron Vale', director_uid: 'owner-1' });
            expect(await screen.findByText('No default classes yet.')).toBeInTheDocument();
        });
    });

    describe('subscribed pool classes', () => {
        test('shows the subscribed count and only actually-subscribed pool classes', async () => {
            signIn({ uid: 'owner-1' }, [subscribedClass, browsableClass]);
            renderWithRouter(<CampaignClassesPage />, { route: '/campaigns/camp-1/classes' });
            fireCampaignSnapshot({ campaign_name: 'The Iron Vale', director_uid: 'owner-1', subscribedClassIds: ['class-sub'] });

            expect(await screen.findByText('1 added to this campaign')).toBeInTheDocument();
            expect(screen.getByText('Trickster')).toBeInTheDocument();
        });

        test('shows an empty-card message when nothing is subscribed', async () => {
            signIn({ uid: 'owner-1' }, [browsableClass]);
            renderWithRouter(<CampaignClassesPage />, { route: '/campaigns/camp-1/classes' });
            fireCampaignSnapshot({ campaign_name: 'The Iron Vale', director_uid: 'owner-1' });
            expect(await screen.findByText(/No pool classes subscribed yet/)).toBeInTheDocument();
        });

        test('Remove from campaign writes arrayRemove for that class', async () => {
            signIn({ uid: 'owner-1' }, [subscribedClass]);
            renderWithRouter(<CampaignClassesPage />, { route: '/campaigns/camp-1/classes' });
            fireCampaignSnapshot({ campaign_name: 'The Iron Vale', director_uid: 'owner-1', subscribedClassIds: ['class-sub'] });
            await screen.findByText('Trickster');

            fireEvent.click(screen.getByRole('button', { name: 'Remove from campaign' }));

            await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalledWith(
                { __doc: ['campaigns', 'camp-1'] },
                { subscribedClassIds: { __arrayRemove: 'class-sub' } },
            ));
        });

        test('a failed remove is alerted', async () => {
            mockUpdateDoc.mockRejectedValue(new Error('offline'));
            signIn({ uid: 'owner-1' }, [subscribedClass]);
            renderWithRouter(<CampaignClassesPage />, { route: '/campaigns/camp-1/classes' });
            fireCampaignSnapshot({ campaign_name: 'The Iron Vale', director_uid: 'owner-1', subscribedClassIds: ['class-sub'] });
            await screen.findByText('Trickster');

            fireEvent.click(screen.getByRole('button', { name: 'Remove from campaign' }));

            await waitFor(() => expect(window.alert).toHaveBeenCalled());
        });
    });

    describe('browse pool classes', () => {
        test('excludes default and already-subscribed classes, shows author and description', async () => {
            signIn({ uid: 'owner-1' }, [defaultClass, subscribedClass, browsableClass]);
            renderWithRouter(<CampaignClassesPage />, { route: '/campaigns/camp-1/classes' });
            fireCampaignSnapshot({ campaign_name: 'The Iron Vale', director_uid: 'owner-1', subscribedClassIds: ['class-sub'] });

            expect(await screen.findByText('Cleric')).toBeInTheDocument();
            expect(screen.getByText('by Sam')).toBeInTheDocument();
            expect(screen.getByText('Heals.')).toBeInTheDocument();
        });

        test('filtering by type narrows the browse list', async () => {
            signIn({ uid: 'owner-1' }, [browsableClass]);
            renderWithRouter(<CampaignClassesPage />, { route: '/campaigns/camp-1/classes' });
            fireCampaignSnapshot({ campaign_name: 'The Iron Vale', director_uid: 'owner-1' });
            await screen.findByText('Cleric');

            fireEvent.click(screen.getByRole('button', { name: 'Manipulator' }));

            expect(screen.queryByText('Cleric')).not.toBeInTheDocument();
            expect(screen.getByText(/Every pool class matching this filter is already subscribed/)).toBeInTheDocument();
        });

        test('+ Add to Campaign subscribes the class', async () => {
            signIn({ uid: 'owner-1' }, [browsableClass]);
            renderWithRouter(<CampaignClassesPage />, { route: '/campaigns/camp-1/classes' });
            fireCampaignSnapshot({ campaign_name: 'The Iron Vale', director_uid: 'owner-1' });
            await screen.findByText('Cleric');

            fireEvent.click(screen.getByRole('button', { name: '+ Add to Campaign' }));

            await waitFor(() => expect(mockSubscribeClassToCampaign).toHaveBeenCalledWith('camp-1', browsableClass));
        });

        test('a failed subscribe is alerted', async () => {
            mockSubscribeClassToCampaign.mockRejectedValue(new Error('offline'));
            signIn({ uid: 'owner-1' }, [browsableClass]);
            renderWithRouter(<CampaignClassesPage />, { route: '/campaigns/camp-1/classes' });
            fireCampaignSnapshot({ campaign_name: 'The Iron Vale', director_uid: 'owner-1' });
            await screen.findByText('Cleric');

            fireEvent.click(screen.getByRole('button', { name: '+ Add to Campaign' }));

            await waitFor(() => expect(window.alert).toHaveBeenCalled());
        });
    });

    test('queries public classes plus ones the signed-in user can read or write', async () => {
        signIn({ uid: 'owner-1' }, []);
        renderWithRouter(<CampaignClassesPage />, { route: '/campaigns/camp-1/classes' });
        fireCampaignSnapshot({ campaign_name: 'The Iron Vale', director_uid: 'owner-1' });

        await waitFor(() => expect(mockGetDocs).toHaveBeenCalled());
        expect(mockCollection).toHaveBeenCalledWith({}, 'classes');
        expect(mockWhere).toHaveBeenCalledWith('public', '==', true);
        expect(mockWhere).toHaveBeenCalledWith('canRead', 'array-contains', 'owner-1');
        expect(mockWhere).toHaveBeenCalledWith('canWrite', 'array-contains', 'owner-1');
        await act(async () => { await Promise.resolve(); });
    });
});

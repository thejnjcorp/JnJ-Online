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
import { screen, fireEvent, waitFor } from '@testing-library/react';
// eslint-disable-next-line import/first
import { ClassListPage } from '../../src/components/ClassListPage';
// eslint-disable-next-line import/first
import { renderWithRouter } from '../testUtils/renderWithRouter';

const defaultClass = { id: 'class-def', class_name: 'Warrior', class_type: 'Attrionist', author: 'Admin', isDefault: true, description: 'A **tank**.' };
const poolClass = { id: 'class-pool', class_name: 'Trickster', class_type: 'Manipulator', author: 'Sam', public: true, class_weapons: 'Daggers' };
const privateClass = { id: 'class-priv', class_name: 'Secret', class_type: 'Snowballer', author: 'Sam', public: false };

const directedCampaign = { id: 'camp-1', campaign_name: 'The Iron Vale', director_uid: 'user-1', subscribedClassIds: [] };
const writableCampaign = { id: 'camp-2', campaign_name: 'Solo', canWrite: ['user-1'], subscribedClassIds: ['class-pool'] };
const readOnlyCampaign = { id: 'camp-3', campaign_name: 'ReadOnly', canRead: ['user-1'] };

function docsFrom(items) {
    return { docs: items.map(item => ({ id: item.id, data: () => item })) };
}

function signIn(user, { classes = [], campaigns = [] } = {}) {
    mockOnAuthStateChanged.mockImplementation((_auth, callback) => {
        Promise.resolve().then(() => callback(user));
        return jest.fn();
    });
    mockGetDocs.mockImplementation((q) => {
        if (q?.__collection === 'campaigns') return Promise.resolve(docsFrom(campaigns));
        return Promise.resolve(docsFrom(classes));
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
    mockSubscribeClassToCampaign.mockResolvedValue([]);
    window.alert = jest.fn();
});

afterEach(() => {
    delete window.alert;
});

describe('ClassListPage', () => {
    test('sets the document title', () => {
        renderWithRouter(<ClassListPage />);
        expect(document.title).toBe('Classes');
    });

    test('shows the empty state before auth resolves', () => {
        renderWithRouter(<ClassListPage />);
        expect(screen.getByText('No classes match these filters.')).toBeInTheDocument();
    });

    test('queries public classes plus ones the user can read or write', async () => {
        signIn({ uid: 'user-1' }, { classes: [defaultClass] });
        renderWithRouter(<ClassListPage />);

        expect(await screen.findByText('Warrior')).toBeInTheDocument();
        expect(mockCollection).toHaveBeenCalledWith({}, 'classes');
        expect(mockWhere).toHaveBeenCalledWith('public', '==', true);
        expect(mockWhere).toHaveBeenCalledWith('canRead', 'array-contains', 'user-1');
        expect(mockWhere).toHaveBeenCalledWith('canWrite', 'array-contains', 'user-1');
    });

    test('a failed classes query is logged, leaving the list empty instead of crashing', async () => {
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        signIn({ uid: 'user-1' });
        mockGetDocs.mockImplementation((q) => q?.__collection === 'classes' ? Promise.reject(new Error('offline')) : Promise.resolve(docsFrom([])));
        renderWithRouter(<ClassListPage />);

        await waitFor(() => expect(consoleSpy).toHaveBeenCalled());
        expect(screen.getByText('No classes match these filters.')).toBeInTheDocument();
        consoleSpy.mockRestore();
    });

    describe('cards', () => {
        test('shows author, type, and markdown description', async () => {
            signIn({ uid: 'user-1' }, { classes: [defaultClass] });
            renderWithRouter(<ClassListPage />);
            await screen.findByText('Warrior');

            expect(screen.getByText(/by Admin/)).toBeInTheDocument();
            expect(screen.getByText('tank').tagName).toBe('STRONG');
        });

        test('shows weapons only when present', async () => {
            signIn({ uid: 'user-1' }, { classes: [defaultClass, poolClass] });
            renderWithRouter(<ClassListPage />);
            await screen.findByText('Warrior');

            expect(screen.getByText('Weapons: Daggers')).toBeInTheDocument();
        });

        test.each([
            ['Default', defaultClass],
            ['Pool', poolClass],
            ['Private', privateClass],
        ])('shows the "%s" visibility badge for the right kind of class', async (badgeLabel, classDoc) => {
            signIn({ uid: 'user-1' }, { classes: [classDoc] });
            renderWithRouter(<ClassListPage />);
            await screen.findByText(classDoc.class_name);
            expect(screen.getByText(badgeLabel, { selector: '.ClassListPage-card-vis-badge' })).toBeInTheDocument();
        });

        test('View Class navigates to the class detail route', async () => {
            signIn({ uid: 'user-1' }, { classes: [defaultClass] });
            renderWithRouter(<ClassListPage />);
            await screen.findByText('Warrior');

            fireEvent.click(screen.getByRole('button', { name: 'View Class' }));

            expect(mockNavigate).toHaveBeenCalledWith('/classes/class-def');
        });

        test('Add to Campaign is hidden for a private class', async () => {
            signIn({ uid: 'user-1' }, { classes: [privateClass] });
            renderWithRouter(<ClassListPage />);
            await screen.findByText('Secret');
            expect(screen.queryByRole('button', { name: 'Add to Campaign' })).not.toBeInTheDocument();
        });

        test('+ Create New Class navigates to /classes', async () => {
            renderWithRouter(<ClassListPage />);
            fireEvent.click(screen.getByRole('button', { name: '+ Create New Class' }));
            expect(mockNavigate).toHaveBeenCalledWith('/classes');
        });
    });

    describe('filters', () => {
        beforeEach(() => signIn({ uid: 'user-1' }, { classes: [defaultClass, poolClass, privateClass] }));

        test('filtering by type shows only matching cards', async () => {
            renderWithRouter(<ClassListPage />);
            await screen.findByText('Warrior');

            fireEvent.click(screen.getByRole('button', { name: 'Manipulator' }));

            expect(screen.queryByText('Warrior')).not.toBeInTheDocument();
            expect(screen.getByText('Trickster')).toBeInTheDocument();
        });

        test('filtering by visibility shows only matching cards', async () => {
            renderWithRouter(<ClassListPage />);
            await screen.findByText('Warrior');

            fireEvent.click(screen.getByRole('button', { name: 'Private' }));

            expect(screen.queryByText('Warrior')).not.toBeInTheDocument();
            expect(screen.getByText('Secret')).toBeInTheDocument();
        });

        test('a filter combination with no matches shows the empty state', async () => {
            renderWithRouter(<ClassListPage />);
            await screen.findByText('Warrior');

            fireEvent.click(screen.getByRole('button', { name: 'Crit Hunter' }));

            expect(screen.getByText('No classes match these filters.')).toBeInTheDocument();
        });
    });

    describe('Add to Campaign popover', () => {
        test('shows a hint when the user directs/writes to no campaigns', async () => {
            signIn({ uid: 'user-1' }, { classes: [defaultClass], campaigns: [readOnlyCampaign] });
            renderWithRouter(<ClassListPage />);
            await screen.findByText('Warrior');

            fireEvent.click(screen.getByRole('button', { name: 'Add to Campaign' }));

            expect(screen.getByText("You don't direct (or have write access to) any campaigns yet.")).toBeInTheDocument();
        });

        test('lists only campaigns the user directs or can write to, not merely reads', async () => {
            signIn({ uid: 'user-1' }, { classes: [defaultClass], campaigns: [directedCampaign, writableCampaign, readOnlyCampaign] });
            renderWithRouter(<ClassListPage />);
            await screen.findByText('Warrior');

            fireEvent.click(screen.getByRole('button', { name: 'Add to Campaign' }));

            expect(screen.getByText('The Iron Vale')).toBeInTheDocument();
            expect(screen.getByText('Solo')).toBeInTheDocument();
            expect(screen.queryByText('ReadOnly')).not.toBeInTheDocument();
        });

        test('clicking Done closes the popover', async () => {
            signIn({ uid: 'user-1' }, { classes: [defaultClass], campaigns: [directedCampaign] });
            renderWithRouter(<ClassListPage />);
            await screen.findByText('Warrior');
            fireEvent.click(screen.getByRole('button', { name: 'Add to Campaign' }));

            fireEvent.click(screen.getByRole('button', { name: 'Done' }));

            expect(screen.queryByText('The Iron Vale')).not.toBeInTheDocument();
        });

        test('subscribing a not-yet-subscribed campaign calls subscribeClassToCampaign and marks the chip selected', async () => {
            signIn({ uid: 'user-1' }, { classes: [defaultClass], campaigns: [directedCampaign] });
            mockSubscribeClassToCampaign.mockResolvedValue(['status-a']);
            renderWithRouter(<ClassListPage />);
            await screen.findByText('Warrior');
            fireEvent.click(screen.getByRole('button', { name: 'Add to Campaign' }));

            fireEvent.click(screen.getByRole('button', { name: 'The Iron Vale' }));

            expect(await screen.findByRole('button', { name: /The Iron Vale.*✓/ })).toBeInTheDocument();
            expect(mockSubscribeClassToCampaign).toHaveBeenCalledWith('camp-1', defaultClass);
        });

        test('unsubscribing an already-subscribed campaign writes arrayRemove and clears the checkmark', async () => {
            const subscribedCampaign = { ...directedCampaign, subscribedClassIds: ['class-def'] };
            signIn({ uid: 'user-1' }, { classes: [defaultClass], campaigns: [subscribedCampaign] });
            renderWithRouter(<ClassListPage />);
            await screen.findByText('Warrior');
            fireEvent.click(screen.getByRole('button', { name: 'Add to Campaign' }));
            await screen.findByRole('button', { name: /The Iron Vale.*✓/ });

            fireEvent.click(screen.getByRole('button', { name: /The Iron Vale/ }));

            await waitFor(() => expect(screen.queryByRole('button', { name: /The Iron Vale.*✓/ })).not.toBeInTheDocument());
            expect(mockUpdateDoc).toHaveBeenCalledWith(
                { __doc: ['campaigns', 'camp-1'] },
                { subscribedClassIds: { __arrayRemove: 'class-def' } },
            );
            expect(mockSubscribeClassToCampaign).not.toHaveBeenCalled();
        });

        test('a subscription error is alerted', async () => {
            signIn({ uid: 'user-1' }, { classes: [defaultClass], campaigns: [directedCampaign] });
            mockSubscribeClassToCampaign.mockRejectedValue(new Error('offline'));
            renderWithRouter(<ClassListPage />);
            await screen.findByText('Warrior');
            fireEvent.click(screen.getByRole('button', { name: 'Add to Campaign' }));

            fireEvent.click(screen.getByRole('button', { name: 'The Iron Vale' }));

            await waitFor(() => expect(window.alert).toHaveBeenCalled());
        });
    });
});

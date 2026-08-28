jest.mock('../../src/utils/firebase', () => ({ auth: {}, db: {} }));

const mockOnAuthStateChanged = jest.fn();
jest.mock('firebase/auth', () => ({
    onAuthStateChanged: (...args) => mockOnAuthStateChanged(...args),
}));

const mockCollection = jest.fn();
const mockGetDocs = jest.fn();
const mockQuery = jest.fn();
const mockOr = jest.fn();
const mockWhere = jest.fn();
jest.mock('firebase/firestore', () => ({
    collection: (...args) => mockCollection(...args),
    getDocs: (...args) => mockGetDocs(...args),
    query: (...args) => mockQuery(...args),
    or: (...args) => mockOr(...args),
    where: (...args) => mockWhere(...args),
}));

// eslint-disable-next-line import/first
import { screen } from '@testing-library/react';
// eslint-disable-next-line import/first
import { Homepage } from '../../src/components/Homepage';
// eslint-disable-next-line import/first
import { renderWithRouter } from '../testUtils/renderWithRouter';

const character = { id: 'char-a', character_name: 'Aria', class: 'Fighter', campaign: 'The Iron Vale' };
const campaign = { id: 'camp-a', campaign_name: 'The Iron Vale', director_name: 'Sam' };

function docsFrom(items) {
    return { docs: items.map(item => ({ id: item.id, data: () => item })) };
}

function signIn(user, { characters = [], campaigns = [] } = {}) {
    mockOnAuthStateChanged.mockImplementation((_auth, callback) => {
        Promise.resolve().then(() => callback(user));
        return jest.fn();
    });
    mockGetDocs.mockImplementation((q) => {
        if (q?.__collection === 'campaigns') return Promise.resolve(docsFrom(campaigns));
        return Promise.resolve(docsFrom(characters));
    });
}

beforeEach(() => {
    mockCollection.mockImplementation((_db, name) => ({ __collection: name }));
    mockQuery.mockImplementation((collectionArg, ...rest) => ({ __collection: collectionArg?.__collection, args: rest }));
    mockOr.mockImplementation((...args) => ({ __or: args }));
    mockWhere.mockImplementation((...args) => ({ __where: args }));
    mockOnAuthStateChanged.mockImplementation(() => jest.fn());
});

describe('Homepage', () => {
    test('sets the document title', () => {
        renderWithRouter(<Homepage />);
        expect(document.title).toBe('JnJ Online');
    });

    test('renders an empty shell before the auth listener resolves', () => {
        renderWithRouter(<Homepage />);
        expect(screen.queryByText('Play JnJ, together, anywhere.')).not.toBeInTheDocument();
        expect(screen.queryByText('Welcome back', { exact: false })).not.toBeInTheDocument();
    });

    describe('signed out', () => {
        beforeEach(() => {
            mockOnAuthStateChanged.mockImplementation((_auth, callback) => { Promise.resolve().then(() => callback(null)); return jest.fn(); });
        });

        test('shows the landing hero, feature cards, and CTA', async () => {
            renderWithRouter(<Homepage />);
            expect(await screen.findByText('Play JnJ, together, anywhere.')).toBeInTheDocument();
            expect(screen.getByText('Tempo Combat')).toBeInTheDocument();
            expect(screen.getByText('Built-in Class Builder')).toBeInTheDocument();
            expect(screen.getByText('Skills & Flaws')).toBeInTheDocument();
            expect(screen.getByText('Live Character Sheets')).toBeInTheDocument();
            expect(screen.getByText('Ready to roll?')).toBeInTheDocument();
        });

        test('the hero actions link to class list and the ruleset blog page', async () => {
            renderWithRouter(<Homepage />);
            await screen.findByText('Play JnJ, together, anywhere.');
            expect(screen.getByRole('link', { name: 'Browse Classes' })).toHaveAttribute('href', '/class-list');
            expect(screen.getByRole('link', { name: 'Read the Rules' })).toHaveAttribute('href', '/blog/JnJ_Ruleset');
        });

        test('never queries characters or campaigns', async () => {
            renderWithRouter(<Homepage />);
            await screen.findByText('Play JnJ, together, anywhere.');
            expect(mockGetDocs).not.toHaveBeenCalled();
        });
    });

    describe('signed in', () => {
        test('greets the user by their first name', async () => {
            signIn({ uid: 'user-1', displayName: 'Sam Rivers' });
            renderWithRouter(<Homepage />);
            expect(await screen.findByText('Welcome back, Sam')).toBeInTheDocument();
        });

        test('drops the comma and name entirely when there is no displayName', async () => {
            signIn({ uid: 'user-1', displayName: null });
            renderWithRouter(<Homepage />);
            expect(await screen.findByText('Welcome back')).toBeInTheDocument();
        });

        test('queries characters the user owns, can read, or can write, and campaigns they can read or write', async () => {
            signIn({ uid: 'user-1' });
            renderWithRouter(<Homepage />);
            await screen.findByText('Welcome back');

            expect(mockCollection).toHaveBeenCalledWith({}, 'characters');
            expect(mockCollection).toHaveBeenCalledWith({}, 'campaigns');
            expect(mockWhere).toHaveBeenCalledWith('playerId', '==', 'user-1');
            expect(mockWhere).toHaveBeenCalledWith('canRead', 'array-contains', 'user-1');
            expect(mockWhere).toHaveBeenCalledWith('canWrite', 'array-contains', 'user-1');
        });

        test('renders up to 4 characters and campaigns as dashboard cards', async () => {
            signIn({ uid: 'user-1' }, { characters: [character], campaigns: [campaign] });
            renderWithRouter(<Homepage />);

            expect(await screen.findByText('Aria')).toBeInTheDocument();
            expect(screen.getByText(/Fighter/)).toBeInTheDocument();
            expect(screen.getByText('The Iron Vale')).toBeInTheDocument();
            expect(screen.getByText('Director: Sam')).toBeInTheDocument();
        });

        test('shows empty-state text when there are no characters or campaigns', async () => {
            signIn({ uid: 'user-1' });
            renderWithRouter(<Homepage />);
            expect(await screen.findByText('No characters yet.')).toBeInTheDocument();
            expect(screen.getByText('No campaigns yet.')).toBeInTheDocument();
        });

        test('a character card links to its character page', async () => {
            signIn({ uid: 'user-1' }, { characters: [character] });
            renderWithRouter(<Homepage />);
            const link = await screen.findByRole('link', { name: /Aria/ });
            expect(link).toHaveAttribute('href', '/characters/char-a');
        });

        test('a campaign card links to its campaign page', async () => {
            signIn({ uid: 'user-1' }, { campaigns: [campaign] });
            renderWithRouter(<Homepage />);
            const link = await screen.findByRole('link', { name: /The Iron Vale/ });
            expect(link).toHaveAttribute('href', '/campaigns/camp-a');
        });

        test('a failed dashboard load is swallowed, leaving empty lists instead of crashing', async () => {
            mockOnAuthStateChanged.mockImplementation((_auth, callback) => { Promise.resolve().then(() => callback({ uid: 'user-1' })); return jest.fn(); });
            mockGetDocs.mockRejectedValue(new Error('offline'));
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

            renderWithRouter(<Homepage />);

            expect(await screen.findByText('No characters yet.')).toBeInTheDocument();
            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });

        test('quick links point at the class list, ruleset, and account page', async () => {
            signIn({ uid: 'user-1' });
            renderWithRouter(<Homepage />);
            await screen.findByText('Welcome back');

            expect(screen.getByRole('link', { name: /Browse Classes/ })).toHaveAttribute('href', '/class-list');
            expect(screen.getByRole('link', { name: /Read the Rules/ })).toHaveAttribute('href', '/blog/JnJ_Ruleset');
            expect(screen.getByRole('link', { name: /Your Account/ })).toHaveAttribute('href', '/account');
        });

        test('"View All" and "+ Create" links target the right routes for each section', async () => {
            signIn({ uid: 'user-1' });
            renderWithRouter(<Homepage />);
            await screen.findByText('Welcome back');

            const viewAllLinks = screen.getAllByText('View All');
            expect(viewAllLinks[0]).toHaveAttribute('href', '/characters');
            expect(viewAllLinks[1]).toHaveAttribute('href', '/campaigns');

            expect(screen.getByRole('link', { name: '+ Create one from a campaign' })).toHaveAttribute('href', '/campaigns');
            expect(screen.getByRole('link', { name: '+ Create a Campaign' })).toHaveAttribute('href', '/campaigns/new');
        });
    });
});

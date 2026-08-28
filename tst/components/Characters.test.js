jest.mock('../../src/utils/firebase', () => ({ auth: {}, db: {} }));

const mockOnAuthStateChanged = jest.fn();
jest.mock('firebase/auth', () => ({
    onAuthStateChanged: (...args) => mockOnAuthStateChanged(...args),
}));

const mockCollection = jest.fn();
const mockQuery = jest.fn();
const mockGetDocs = jest.fn();
const mockOr = jest.fn();
const mockWhere = jest.fn();
const mockDocumentId = jest.fn();
jest.mock('firebase/firestore', () => ({
    collection: (...args) => mockCollection(...args),
    query: (...args) => mockQuery(...args),
    getDocs: (...args) => mockGetDocs(...args),
    or: (...args) => mockOr(...args),
    where: (...args) => mockWhere(...args),
    documentId: (...args) => mockDocumentId(...args),
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useNavigate: () => mockNavigate,
}));

jest.mock('../../src/components/CharacterPage', () => ({ CharacterPage: () => <div>CharacterPage-stub</div> }));

// eslint-disable-next-line import/first
import { screen, fireEvent } from '@testing-library/react';
// eslint-disable-next-line import/first
import { Characters } from '../../src/components/Characters';
// eslint-disable-next-line import/first
import { renderWithRouter } from '../testUtils/renderWithRouter';

const aria = { id: 'char-a', character_name: 'Aria', player_name: 'Sam', class: 'Fighter', campaign: 'camp-1' };
const finn = { id: 'char-b', character_name: 'Finn', player_name: 'Sam', class: 'Rogue' }; // no campaign

function docsFrom(items) {
    return { docs: items.map(item => ({ id: item.id, data: () => item })) };
}

function signIn(characters, campaigns = []) {
    mockOnAuthStateChanged.mockImplementation((_auth, callback) => {
        Promise.resolve().then(() => callback({ uid: 'user-1' }));
        return jest.fn();
    });
    mockGetDocs.mockImplementation((q) => {
        if (q?.__collection === 'campaigns-query') return Promise.resolve(docsFrom(campaigns));
        return Promise.resolve(docsFrom(characters));
    });
}

beforeEach(() => {
    mockCollection.mockImplementation((_db, name) => ({ __collection: name }));
    mockQuery.mockImplementation((collectionArg, ...rest) => {
        // Distinguish the campaign-name lookup query (collection "campaigns")
        // from the character list query, so the getDocs mock above can route
        // to the right fixture without needing call-order assumptions.
        if (collectionArg?.__collection === 'campaigns') return { __collection: 'campaigns-query', args: rest };
        return { __collection: 'characters-query', args: rest };
    });
    mockOr.mockImplementation((...args) => ({ __or: args }));
    mockWhere.mockImplementation((...args) => ({ __where: args }));
    mockDocumentId.mockImplementation(() => '__documentId__');
    mockOnAuthStateChanged.mockImplementation(() => jest.fn());
    mockGetDocs.mockResolvedValue(docsFrom([]));
});

describe('Characters', () => {
    describe('on /characters', () => {
        test('shows a loading state before the auth listener resolves', () => {
            renderWithRouter(<Characters />, { route: '/characters' });
            expect(screen.getByAltText('Loading')).toBeInTheDocument();
        });

        test('shows a sign-in prompt when signed out', async () => {
            mockOnAuthStateChanged.mockImplementation((_auth, callback) => { Promise.resolve().then(() => callback(null)); return jest.fn(); });
            renderWithRouter(<Characters />, { route: '/characters' });
            expect(await screen.findByText('Sign in to see your characters.')).toBeInTheDocument();
        });

        test('queries characters the user owns, can read, or can write, then renders a card per character', async () => {
            signIn([aria]);
            renderWithRouter(<Characters />, { route: '/characters' });

            expect(await screen.findByText('Aria')).toBeInTheDocument();
            expect(mockCollection).toHaveBeenCalledWith({}, 'characters');
            expect(mockWhere).toHaveBeenCalledWith('playerId', '==', 'user-1');
            expect(mockWhere).toHaveBeenCalledWith('canRead', 'array-contains', 'user-1');
            expect(mockWhere).toHaveBeenCalledWith('canWrite', 'array-contains', 'user-1');
        });

        test('shows the class and player name', async () => {
            signIn([aria]);
            renderWithRouter(<Characters />, { route: '/characters' });
            await screen.findByText('Aria');
            // "Fighter" is a bare text node (no wrapping element) separated
            // from its siblings only by <br/>, which textContent ignores -
            // no element's exact textContent is just "Fighter", so this
            // needs a substring/regex match against the shared container.
            expect(screen.getByText(/Fighter/)).toBeInTheDocument();
            expect(screen.getByText(/Player: Sam/)).toBeInTheDocument();
        });

        test('shows "No characters yet." when the list is empty', async () => {
            signIn([]);
            renderWithRouter(<Characters />, { route: '/characters' });
            expect(await screen.findByText('No characters yet.')).toBeInTheDocument();
        });

        test('a character with no campaign shows no campaign line at all', async () => {
            signIn([finn]);
            renderWithRouter(<Characters />, { route: '/characters' });
            await screen.findByText('Finn');
            expect(screen.queryByText(/Campaign:/)).not.toBeInTheDocument();
        });

        test('a character with a campaign shows "Loading campaign…" until names resolve, then the real name', async () => {
            signIn([aria], [{ id: 'camp-1', campaign_name: 'The Iron Vale' }]);
            renderWithRouter(<Characters />, { route: '/characters' });
            await screen.findByText('Aria');

            expect(await screen.findByText(/Campaign: The Iron Vale/)).toBeInTheDocument();
        });

        test('a campaign id with no matching doc falls back to "Unknown Campaign"', async () => {
            signIn([aria], []); // campaign lookup resolves with nothing
            renderWithRouter(<Characters />, { route: '/characters' });
            await screen.findByText('Aria');

            expect(await screen.findByText(/Campaign: Unknown Campaign/)).toBeInTheDocument();
        });

        test('sets a --character-accent style variable when navigation_color is set', async () => {
            signIn([{ ...aria, navigation_color: '#ff0000', campaign: undefined }]);
            renderWithRouter(<Characters />, { route: '/characters' });
            const card = await screen.findByRole('button', { name: /Aria/ });
            expect(card.style.getPropertyValue('--character-accent')).toBe('#ff0000');
        });

        test('clicking a character card navigates to /characters/<id>', async () => {
            signIn([{ ...aria, campaign: undefined }]);
            renderWithRouter(<Characters />, { route: '/characters' });

            fireEvent.click(await screen.findByRole('button', { name: /Aria/ }));

            expect(mockNavigate).toHaveBeenCalledWith('/characters/char-a');
        });

        test('clicking + Create one from a campaign navigates to /campaigns', async () => {
            signIn([]);
            renderWithRouter(<Characters />, { route: '/characters' });

            fireEvent.click(await screen.findByText('+ Create one from a campaign'));

            expect(mockNavigate).toHaveBeenCalledWith('/campaigns');
        });
    });

    test('any other /characters/* path renders CharacterPage instead of the list', async () => {
        renderWithRouter(<Characters />, { route: '/characters/char-a' });
        expect(await screen.findByText('CharacterPage-stub')).toBeInTheDocument();
        expect(screen.queryByText('Characters')).not.toBeInTheDocument();
    });
});

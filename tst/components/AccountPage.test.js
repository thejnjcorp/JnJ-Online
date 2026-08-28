jest.mock('../../src/utils/firebase', () => ({ auth: {}, db: {} }));

const mockOnAuthStateChanged = jest.fn();
const mockSignOut = jest.fn();
jest.mock('firebase/auth', () => ({
    onAuthStateChanged: (...args) => mockOnAuthStateChanged(...args),
    signOut: (...args) => mockSignOut(...args),
}));

const mockCollection = jest.fn();
const mockWhere = jest.fn();
const mockGetDoc = jest.fn();
const mockDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockQuery = jest.fn();
const mockOr = jest.fn();
const mockUpdateDoc = jest.fn();
jest.mock('firebase/firestore', () => ({
    collection: (...args) => mockCollection(...args),
    where: (...args) => mockWhere(...args),
    getDoc: (...args) => mockGetDoc(...args),
    doc: (...args) => mockDoc(...args),
    getDocs: (...args) => mockGetDocs(...args),
    query: (...args) => mockQuery(...args),
    or: (...args) => mockOr(...args),
    updateDoc: (...args) => mockUpdateDoc(...args),
}));

const mockNavigate = jest.fn();
const mockNavigateComponent = jest.fn();
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useNavigate: () => mockNavigate,
    Navigate: (props) => { mockNavigateComponent(props); return <div>Navigate-stub</div>; },
}));

// eslint-disable-next-line import/first
import { screen, fireEvent, waitFor, act } from '@testing-library/react';
// eslint-disable-next-line import/first
import { AccountPage } from '../../src/components/AccountPage';
// eslint-disable-next-line import/first
import { renderWithRouter } from '../testUtils/renderWithRouter';

const authUser = { uid: 'user-1', email: 'sam@example.com', displayName: 'Sam Google', photoURL: null };
const character = { id: 'char-a', character_name: 'Aria', class: 'Fighter', campaign: 'The Iron Vale' };
const campaign = { id: 'camp-a', campaign_name: 'The Iron Vale', director_name: 'Sam' };

function docsFrom(items) {
    return { docs: items.map(item => ({ id: item.id, data: () => item })) };
}

function signIn(user, { playerData = { name: 'Sam' }, characters = [], campaigns = [] } = {}) {
    mockOnAuthStateChanged.mockImplementation((_auth, callback) => {
        Promise.resolve().then(() => callback(user));
        return jest.fn();
    });
    mockGetDoc.mockResolvedValue({ data: () => playerData });
    mockGetDocs.mockImplementation((q) => {
        if (q?.__collection === 'campaigns') return Promise.resolve(docsFrom(campaigns));
        return Promise.resolve(docsFrom(characters));
    });
}

beforeEach(() => {
    mockCollection.mockImplementation((_db, name) => ({ __collection: name }));
    mockWhere.mockImplementation((...args) => ({ __where: args }));
    mockDoc.mockImplementation((_db, ...path) => ({ __doc: path }));
    mockQuery.mockImplementation((collectionArg, ...rest) => ({ __collection: collectionArg?.__collection, args: rest }));
    mockOr.mockImplementation((...args) => ({ __or: args }));
    mockOnAuthStateChanged.mockImplementation(() => jest.fn());
    mockGetDoc.mockResolvedValue({ data: () => ({}) });
    mockGetDocs.mockResolvedValue(docsFrom([]));
    mockUpdateDoc.mockResolvedValue(undefined);
    mockSignOut.mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText: jest.fn().mockResolvedValue(undefined) } });
    jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
    console.log.mockRestore();
});

describe('AccountPage', () => {
    test('sets the document title', () => {
        renderWithRouter(<AccountPage setUserInfo={jest.fn()} />);
        expect(document.title).toBe('Account');
    });

    test('shows no account content before the auth listener has resolved', () => {
        renderWithRouter(<AccountPage setUserInfo={jest.fn()} />);
        expect(screen.queryByRole('button', { name: 'Sign Out' })).not.toBeInTheDocument();
        expect(screen.queryByText('Navigate-stub')).not.toBeInTheDocument();
    });

    test('a signed-out user is redirected to /home', async () => {
        mockOnAuthStateChanged.mockImplementation((_auth, callback) => { Promise.resolve().then(() => callback(null)); return jest.fn(); });
        renderWithRouter(<AccountPage setUserInfo={jest.fn()} />);

        expect(await screen.findByText('Navigate-stub')).toBeInTheDocument();
        expect(mockNavigateComponent).toHaveBeenCalledWith({ to: '/home', replace: true });
    });

    test('shows no account content while the account doc is still loading', async () => {
        mockOnAuthStateChanged.mockImplementation((_auth, callback) => { Promise.resolve().then(() => callback(authUser)); return jest.fn(); });
        mockGetDoc.mockReturnValue(new Promise(() => {})); // never resolves within this test
        renderWithRouter(<AccountPage setUserInfo={jest.fn()} />);

        await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
        expect(screen.queryByRole('button', { name: 'Sign Out' })).not.toBeInTheDocument();
    });

    describe('once loaded', () => {
        test('shows the player name from the players doc, the email, and the player id', async () => {
            signIn(authUser);
            renderWithRouter(<AccountPage setUserInfo={jest.fn()} />);

            expect(await screen.findByText('Sam')).toBeInTheDocument();
            expect(screen.getByText('sam@example.com')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Player ID: user-1' })).toBeInTheDocument();
        });

        test('falls back to the Google display name when there is no players doc name', async () => {
            signIn(authUser, { playerData: {} });
            renderWithRouter(<AccountPage setUserInfo={jest.fn()} />);
            expect(await screen.findByText('Sam Google')).toBeInTheDocument();
        });

        test('queries characters by playerId and campaigns the user can read or write', async () => {
            signIn(authUser);
            renderWithRouter(<AccountPage setUserInfo={jest.fn()} />);
            await screen.findByRole('button', { name: 'Sign Out' });

            expect(mockCollection).toHaveBeenCalledWith({}, 'characters');
            expect(mockCollection).toHaveBeenCalledWith({}, 'campaigns');
            expect(mockWhere).toHaveBeenCalledWith('playerId', '==', 'user-1');
            expect(mockWhere).toHaveBeenCalledWith('canRead', 'array-contains', 'user-1');
            expect(mockWhere).toHaveBeenCalledWith('canWrite', 'array-contains', 'user-1');
        });

        test('renders a card for each character and campaign, and empty text otherwise', async () => {
            signIn(authUser, { characters: [character] });
            renderWithRouter(<AccountPage setUserInfo={jest.fn()} />);

            expect(await screen.findByText('Aria')).toBeInTheDocument();
            expect(screen.getByText(/Fighter/)).toBeInTheDocument();
            expect(screen.getByText("You're not part of a campaign yet.")).toBeInTheDocument();
        });

        test('a character card links to its character page, a campaign card to its campaign page', async () => {
            signIn(authUser, { characters: [character], campaigns: [campaign] });
            renderWithRouter(<AccountPage setUserInfo={jest.fn()} />);

            expect(await screen.findByRole('link', { name: /Aria/ })).toHaveAttribute('href', '/characters/char-a');
            expect(screen.getByRole('link', { name: /Director: Sam/ })).toHaveAttribute('href', '/campaigns/camp-a');
        });

        test('a failed campaign lookup falls back to an empty campaign list instead of crashing', async () => {
            signIn(authUser, { characters: [character] });
            mockGetDocs.mockImplementation((q) => q?.__collection === 'campaigns'
                ? Promise.reject(new Error('offline'))
                : Promise.resolve(docsFrom([character])));
            renderWithRouter(<AccountPage setUserInfo={jest.fn()} />);

            expect(await screen.findByText('Aria')).toBeInTheDocument();
            expect(screen.getByText("You're not part of a campaign yet.")).toBeInTheDocument();
            expect(console.log).toHaveBeenCalled();
        });

        describe('editing your name', () => {
            async function renderReady() {
                signIn(authUser);
                renderWithRouter(<AccountPage setUserInfo={jest.fn()} />);
                await screen.findByRole('button', { name: 'Sign Out' });
            }

            test('Edit opens an input pre-filled with the current name', async () => {
                await renderReady();
                fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
                expect(screen.getByDisplayValue('Sam')).toBeInTheDocument();
            });

            test('Save is disabled once the draft is blank', async () => {
                await renderReady();
                fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
                fireEvent.change(screen.getByDisplayValue('Sam'), { target: { value: '  ' } });
                expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
            });

            test('Cancel discards the draft without writing', async () => {
                await renderReady();
                fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
                fireEvent.change(screen.getByDisplayValue('Sam'), { target: { value: 'Sammy' } });

                fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

                expect(screen.getByText('Sam')).toBeInTheDocument();
                expect(mockUpdateDoc).not.toHaveBeenCalled();
            });

            test('saving an unchanged (trimmed) name just closes the editor without writing', async () => {
                await renderReady();
                fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
                fireEvent.change(screen.getByDisplayValue('Sam'), { target: { value: '  Sam  ' } });

                fireEvent.click(screen.getByRole('button', { name: 'Save' }));

                expect(screen.getByText('Sam')).toBeInTheDocument();
                expect(mockUpdateDoc).not.toHaveBeenCalled();
            });

            test('saving a changed name writes it and updates the displayed name', async () => {
                await renderReady();
                fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
                fireEvent.change(screen.getByDisplayValue('Sam'), { target: { value: 'Sammy' } });

                fireEvent.click(screen.getByRole('button', { name: 'Save' }));

                expect(await screen.findByText('Sammy')).toBeInTheDocument();
                expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['players', 'user-1'] }, { name: 'Sammy' });
            });

            test('a failed save is logged and leaves the editor open', async () => {
                mockUpdateDoc.mockRejectedValue(new Error('offline'));
                await renderReady();
                fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
                fireEvent.change(screen.getByDisplayValue('Sam'), { target: { value: 'Sammy' } });

                fireEvent.click(screen.getByRole('button', { name: 'Save' }));

                await waitFor(() => expect(console.log).toHaveBeenCalled());
                expect(screen.getByDisplayValue('Sammy')).toBeInTheDocument();
            });
        });

        test('Copy Player ID copies the uid and shows a confirmation', async () => {
            signIn(authUser);
            renderWithRouter(<AccountPage setUserInfo={jest.fn()} />);
            await screen.findByRole('button', { name: 'Player ID: user-1' });

            fireEvent.click(screen.getByRole('button', { name: 'Player ID: user-1' }));

            expect(navigator.clipboard.writeText).toHaveBeenCalledWith('user-1');
            expect(await screen.findByRole('button', { name: 'Player ID copied' })).toBeInTheDocument();
        });

        test('Sign Out signs the user out, clears app state, and navigates home', async () => {
            const setUserInfo = jest.fn();
            signIn(authUser);
            renderWithRouter(<AccountPage setUserInfo={setUserInfo} />);
            await screen.findByRole('button', { name: 'Sign Out' });

            fireEvent.click(screen.getByRole('button', { name: 'Sign Out' }));

            await waitFor(() => expect(setUserInfo).toHaveBeenCalledWith(null));
            expect(mockSignOut).toHaveBeenCalled();
            expect(mockNavigate).toHaveBeenCalledWith('/home');
        });

        test('a failed sign-out is logged and does not clear app state or navigate', async () => {
            mockSignOut.mockRejectedValue(new Error('network'));
            const setUserInfo = jest.fn();
            signIn(authUser);
            renderWithRouter(<AccountPage setUserInfo={setUserInfo} />);
            await screen.findByRole('button', { name: 'Sign Out' });

            fireEvent.click(screen.getByRole('button', { name: 'Sign Out' }));

            await waitFor(() => expect(console.log).toHaveBeenCalled());
            expect(setUserInfo).not.toHaveBeenCalled();
            expect(mockNavigate).not.toHaveBeenCalled();
        });
    });
});

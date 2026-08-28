const mockSignInWithGooglePopup = jest.fn();
jest.mock('../../src/utils/firebase', () => ({
    auth: { currentUser: null },
    db: {},
    signInWithGooglePopup: (...args) => mockSignInWithGooglePopup(...args),
}));

const mockDoc = jest.fn();
const mockGetDoc = jest.fn();
const mockSetDoc = jest.fn();
jest.mock('firebase/firestore', () => ({
    doc: (...args) => mockDoc(...args),
    getDoc: (...args) => mockGetDoc(...args),
    setDoc: (...args) => mockSetDoc(...args),
}));

const mockSignOut = jest.fn();
jest.mock('firebase/auth', () => ({
    signOut: (...args) => mockSignOut(...args),
}));

// eslint-disable-next-line import/first
import { screen, fireEvent, waitFor } from '@testing-library/react';
// eslint-disable-next-line import/first
import { Navigation } from '../../src/components/Navigation';
// eslint-disable-next-line import/first
import { renderWithRouter } from '../testUtils/renderWithRouter';
// eslint-disable-next-line import/first
import { auth } from '../../src/utils/firebase';

const signedInUser = { uid: 'user-1', displayName: 'Sam Google', email: 'sam@example.com', photoURL: null };

beforeEach(() => {
    mockDoc.mockImplementation((_db, ...path) => ({ __doc: path }));
    mockGetDoc.mockResolvedValue({ exists: () => false, data: () => ({}) });
    mockSetDoc.mockResolvedValue(undefined);
    mockSignOut.mockResolvedValue(undefined);
    auth.currentUser = null;
    Object.assign(navigator, { clipboard: { writeText: jest.fn().mockResolvedValue(undefined) } });
    jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
    console.log.mockRestore();
});

describe('Navigation', () => {
    test('renders the brand link and all nav links with the right routes', () => {
        renderWithRouter(<Navigation userInfo={null} setUserInfo={jest.fn()} />);

        expect(screen.getByRole('link', { name: /JnJ\s*Online/ })).toHaveAttribute('href', '/home');
        [
            ['Home', '/home'], ['Characters', '/characters'], ['Campaigns', '/campaigns'],
            ['Classes', '/class-list'], ['Statuses', '/status-list'], ['Rules', '/blog/JnJ_Ruleset'],
        ].forEach(([label, href]) => {
            expect(screen.getAllByRole('link', { name: label })[0]).toHaveAttribute('href', href);
        });
    });

    describe('signed out', () => {
        test('shows a Sign In button and no avatar', () => {
            renderWithRouter(<Navigation userInfo={null} setUserInfo={jest.fn()} />);
            expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
            expect(screen.queryByAltText('User')).not.toBeInTheDocument();
        });

        test('clicking Sign In, when a player doc already exists, signs the user in directly', async () => {
            mockSignInWithGooglePopup.mockResolvedValue({ user: signedInUser });
            mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ name: 'Sam' }) });
            const setUserInfo = jest.fn();
            renderWithRouter(<Navigation userInfo={null} setUserInfo={setUserInfo} />);

            fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

            await waitFor(() => expect(setUserInfo).toHaveBeenCalledWith(signedInUser));
            expect(screen.queryByText('Create your player')).not.toBeInTheDocument();
        });

        test('clicking Sign In, with no existing player doc, shows the new-player screen instead', async () => {
            mockSignInWithGooglePopup.mockResolvedValue({ user: signedInUser });
            mockGetDoc.mockResolvedValue({ exists: () => false });
            renderWithRouter(<Navigation userInfo={null} setUserInfo={jest.fn()} />);

            fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

            expect(await screen.findByText('Create your player')).toBeInTheDocument();
        });

        test('a failed popup sign-in is logged and swallowed, no new-player screen shown', async () => {
            mockSignInWithGooglePopup.mockRejectedValue(new Error('popup closed'));
            renderWithRouter(<Navigation userInfo={null} setUserInfo={jest.fn()} />);

            fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

            await waitFor(() => expect(console.log).toHaveBeenCalled());
            expect(screen.queryByText('Create your player')).not.toBeInTheDocument();
        });

        describe('new-player screen', () => {
            async function openNewPlayerScreen() {
                mockSignInWithGooglePopup.mockResolvedValue({ user: signedInUser });
                mockGetDoc.mockResolvedValue({ exists: () => false });
                auth.currentUser = signedInUser;
                const setUserInfo = jest.fn();
                renderWithRouter(<Navigation userInfo={null} setUserInfo={setUserInfo} />);
                fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));
                await screen.findByText('Create your player');
                return setUserInfo;
            }

            test('Create Player is disabled until a non-blank name is entered', async () => {
                await openNewPlayerScreen();
                expect(screen.getByRole('button', { name: 'Create Player' })).toBeDisabled();

                fireEvent.change(screen.getByPlaceholderText('Player name'), { target: { value: '  ' } });
                expect(screen.getByRole('button', { name: 'Create Player' })).toBeDisabled();

                fireEvent.change(screen.getByPlaceholderText('Player name'), { target: { value: 'Sam' } });
                expect(screen.getByRole('button', { name: 'Create Player' })).toBeEnabled();
            });

            test('submitting creates the player doc and signs the user in', async () => {
                const setUserInfo = await openNewPlayerScreen();
                fireEvent.change(screen.getByPlaceholderText('Player name'), { target: { value: 'Sam' } });

                fireEvent.click(screen.getByRole('button', { name: 'Create Player' }));

                await waitFor(() => expect(screen.queryByText('Create your player')).not.toBeInTheDocument());
                expect(mockSetDoc).toHaveBeenCalledWith(
                    { __doc: ['players', 'user-1'] },
                    { name: 'Sam', characters: [], campaigns: [] },
                );
                expect(setUserInfo).toHaveBeenCalledWith(signedInUser);
            });
        });
    });

    describe('signed in', () => {
        test('shows the avatar with the Google display name until the player doc loads', () => {
            renderWithRouter(<Navigation userInfo={signedInUser} setUserInfo={jest.fn()} />);
            expect(screen.getByText('Sam Google')).toBeInTheDocument();
        });

        test('once the players doc loads, its name overrides the Google display name', async () => {
            mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ name: 'Sammy' }) });
            renderWithRouter(<Navigation userInfo={signedInUser} setUserInfo={jest.fn()} />);
            expect(await screen.findByText('Sammy')).toBeInTheDocument();
            expect(mockDoc).toHaveBeenCalledWith({}, 'players', 'user-1');
        });

        test('clicking the avatar opens a menu with the name and email; clicking again closes it', () => {
            renderWithRouter(<Navigation userInfo={signedInUser} setUserInfo={jest.fn()} />);
            const avatarButton = screen.getByRole('button', { name: /Sam Google/ });

            fireEvent.click(avatarButton);
            expect(screen.getByRole('menu')).toBeInTheDocument();
            expect(screen.getByText('sam@example.com')).toBeInTheDocument();

            fireEvent.click(avatarButton);
            expect(screen.queryByRole('menu')).not.toBeInTheDocument();
        });

        test('pressing Escape closes the open menu', () => {
            renderWithRouter(<Navigation userInfo={signedInUser} setUserInfo={jest.fn()} />);
            fireEvent.click(screen.getByRole('button', { name: /Sam Google/ }));
            expect(screen.getByRole('menu')).toBeInTheDocument();

            fireEvent.keyDown(document, { key: 'Escape' });

            expect(screen.queryByRole('menu')).not.toBeInTheDocument();
        });

        test('clicking outside the account menu closes it', () => {
            renderWithRouter(<Navigation userInfo={signedInUser} setUserInfo={jest.fn()} />);
            fireEvent.click(screen.getByRole('button', { name: /Sam Google/ }));
            expect(screen.getByRole('menu')).toBeInTheDocument();

            fireEvent.mouseDown(document.body);

            expect(screen.queryByRole('menu')).not.toBeInTheDocument();
        });

        test('the menu has an Account link to /account', () => {
            renderWithRouter(<Navigation userInfo={signedInUser} setUserInfo={jest.fn()} />);
            fireEvent.click(screen.getByRole('button', { name: /Sam Google/ }));
            expect(screen.getByRole('menuitem', { name: 'Account' })).toHaveAttribute('href', '/account');
        });

        test('Copy Player ID copies the uid to the clipboard and shows a confirmation', async () => {
            renderWithRouter(<Navigation userInfo={signedInUser} setUserInfo={jest.fn()} />);
            fireEvent.click(screen.getByRole('button', { name: /Sam Google/ }));

            fireEvent.click(screen.getByRole('menuitem', { name: 'Copy Player ID' }));

            expect(navigator.clipboard.writeText).toHaveBeenCalledWith('user-1');
            expect(await screen.findByRole('menuitem', { name: 'Player ID copied' })).toBeInTheDocument();
        });

        test('Sign Out calls signOut and clears the user, closing the menu', async () => {
            const setUserInfo = jest.fn();
            renderWithRouter(<Navigation userInfo={signedInUser} setUserInfo={setUserInfo} />);
            fireEvent.click(screen.getByRole('button', { name: /Sam Google/ }));

            fireEvent.click(screen.getByRole('menuitem', { name: 'Sign Out' }));

            await waitFor(() => expect(setUserInfo).toHaveBeenCalledWith(null));
            expect(mockSignOut).toHaveBeenCalled();
        });

        test('a failed sign-out is logged and swallowed', async () => {
            mockSignOut.mockRejectedValue(new Error('network'));
            const setUserInfo = jest.fn();
            renderWithRouter(<Navigation userInfo={signedInUser} setUserInfo={setUserInfo} />);
            fireEvent.click(screen.getByRole('button', { name: /Sam Google/ }));

            fireEvent.click(screen.getByRole('menuitem', { name: 'Sign Out' }));

            await waitFor(() => expect(console.log).toHaveBeenCalled());
            expect(setUserInfo).not.toHaveBeenCalledWith(null);
        });
    });

    describe('mobile drawer', () => {
        test('the hamburger button toggles the drawer open and closed', () => {
            renderWithRouter(<Navigation userInfo={null} setUserInfo={jest.fn()} />);
            const hamburger = screen.getByRole('button', { name: 'Menu' });
            expect(screen.getAllByRole('link', { name: 'Home' })).toHaveLength(1);

            fireEvent.click(hamburger);
            expect(screen.getAllByRole('link', { name: 'Home' })).toHaveLength(2);

            fireEvent.click(hamburger);
            expect(screen.getAllByRole('link', { name: 'Home' })).toHaveLength(1);
        });

        test('the drawer includes an Account link only when signed in', () => {
            renderWithRouter(<Navigation userInfo={signedInUser} setUserInfo={jest.fn()} />);
            fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
            expect(screen.getByRole('link', { name: 'Account' })).toHaveAttribute('href', '/account');
        });
    });
});

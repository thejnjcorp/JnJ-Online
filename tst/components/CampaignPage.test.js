jest.mock('../../src/utils/firebase', () => ({ auth: {}, db: {} }));

const mockOnAuthStateChanged = jest.fn();
jest.mock('firebase/auth', () => ({
    onAuthStateChanged: (...args) => mockOnAuthStateChanged(...args),
}));

const mockArrayRemove = jest.fn();
const mockArrayUnion = jest.fn();
const mockCollection = jest.fn();
const mockDeleteField = jest.fn();
const mockDoc = jest.fn();
const mockDocumentId = jest.fn();
const mockGetCountFromServer = jest.fn();
const mockGetDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockQuery = jest.fn();
const mockServerTimestamp = jest.fn();
const mockTimestampFromMillis = jest.fn();
const mockUpdateDoc = jest.fn();
const mockWhere = jest.fn();
jest.mock('firebase/firestore', () => ({
    arrayRemove: (...args) => mockArrayRemove(...args),
    arrayUnion: (...args) => mockArrayUnion(...args),
    collection: (...args) => mockCollection(...args),
    deleteField: (...args) => mockDeleteField(...args),
    doc: (...args) => mockDoc(...args),
    documentId: (...args) => mockDocumentId(...args),
    getCountFromServer: (...args) => mockGetCountFromServer(...args),
    getDoc: (...args) => mockGetDoc(...args),
    getDocs: (...args) => mockGetDocs(...args),
    query: (...args) => mockQuery(...args),
    serverTimestamp: (...args) => mockServerTimestamp(...args),
    Timestamp: { fromMillis: (...args) => mockTimestampFromMillis(...args) },
    updateDoc: (...args) => mockUpdateDoc(...args),
    where: (...args) => mockWhere(...args),
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useNavigate: () => mockNavigate,
}));

jest.mock('../../src/components/DocAdminManager', () => ({
    DocAdminManager: ({ admins, userId }) => <div>DocAdminManager-stub:{JSON.stringify(admins)}:{userId}</div>,
}));

// eslint-disable-next-line import/first
import { screen, fireEvent, waitFor, act } from '@testing-library/react';
// eslint-disable-next-line import/first
import { CampaignPage } from '../../src/components/CampaignPage';
// eslint-disable-next-line import/first
import { renderWithRouter } from '../testUtils/renderWithRouter';

const character = { id: 'char-a', character_name: 'Aria', class: 'Fighter', player_name: 'Sam' };

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

function docsFrom(items) {
    return { docs: items.map(item => ({ id: item.id, data: () => item })) };
}

function signIn(user, campaign, characters = []) {
    mockOnAuthStateChanged.mockImplementation((_auth, callback) => {
        Promise.resolve().then(() => callback(user));
        return jest.fn();
    });
    mockGetDoc.mockImplementation((target) => {
        if (target?.__doc?.[0] === 'campaigns') {
            return Promise.resolve(campaign ? { exists: () => true, data: () => campaign } : { exists: () => false });
        }
        return Promise.resolve({ data: () => ({ name: 'Sam' }) });
    });
    mockGetDocs.mockResolvedValue(docsFrom(characters));
}

beforeEach(() => {
    mockCollection.mockImplementation((_db, name) => ({ __collection: name }));
    mockDoc.mockImplementation((_db, ...path) => ({ __doc: path }));
    mockQuery.mockImplementation((...args) => ({ __query: args }));
    mockWhere.mockImplementation((...args) => ({ __where: args }));
    mockDocumentId.mockImplementation(() => '__documentId__');
    mockArrayUnion.mockImplementation((value) => ({ __arrayUnion: value }));
    mockArrayRemove.mockImplementation((value) => ({ __arrayRemove: value }));
    mockDeleteField.mockImplementation(() => ({ __deleteField: true }));
    mockServerTimestamp.mockImplementation(() => ({ __serverTimestamp: true }));
    mockTimestampFromMillis.mockImplementation((ms) => ({ __timestamp: ms }));
    mockOnAuthStateChanged.mockImplementation(() => jest.fn());
    mockGetDoc.mockResolvedValue({ exists: () => false });
    mockGetDocs.mockResolvedValue(docsFrom([]));
    mockGetCountFromServer.mockResolvedValue({ data: () => ({ count: 1 }) });
    mockUpdateDoc.mockResolvedValue(undefined);
    window.alert = jest.fn();
});

afterEach(() => {
    delete window.alert;
});

describe('CampaignPage', () => {
    test('shows a loading icon before auth or the campaign doc has resolved', () => {
        renderWithRouter(<CampaignPage />, { route: '/campaigns/camp-1' });
        expect(screen.getByAltText('Loading')).toBeInTheDocument();
    });

    test('a signed-out user sees a sign-in prompt', async () => {
        mockOnAuthStateChanged.mockImplementation((_auth, callback) => { Promise.resolve().then(() => callback(null)); return jest.fn(); });
        renderWithRouter(<CampaignPage />, { route: '/campaigns/camp-1' });
        expect(await screen.findByText('Sign in to see this campaign.')).toBeInTheDocument();
    });

    test('a campaign that doesn\'t exist shows a not-found message and sets the title', async () => {
        signIn({ uid: 'user-1' }, null);
        renderWithRouter(<CampaignPage />, { route: '/campaigns/camp-1' });

        expect(await screen.findByText("This campaign doesn't exist, or you don't have access to it.")).toBeInTheDocument();
        expect(document.title).toBe('Campaign Not Found');
    });

    describe('once loaded', () => {
        test('sets the document title and shows a character card per character', async () => {
            signIn({ uid: 'user-1' }, { campaign_name: 'The Iron Vale' }, [character]);
            renderWithRouter(<CampaignPage />, { route: '/campaigns/camp-1' });

            expect(await screen.findByText('Aria')).toBeInTheDocument();
            expect(document.title).toBe('The Iron Vale');
            expect(screen.getByText(/Fighter/)).toBeInTheDocument();
            expect(screen.getByText(/Player: Sam/)).toBeInTheDocument();
        });

        test('passes the campaign\'s admins list and the signed-in user down to DocAdminManager', async () => {
            signIn({ uid: 'user-1' }, { campaign_name: 'The Iron Vale', admins: ['director-1'] }, [character]);
            renderWithRouter(<CampaignPage />, { route: '/campaigns/camp-1' });
            await screen.findByText('Aria');
            expect(screen.getByText('DocAdminManager-stub:["director-1"]:user-1')).toBeInTheDocument();
        });

        test('queries characters belonging to this campaign', async () => {
            signIn({ uid: 'user-1' }, { campaign_name: 'The Iron Vale' }, [character]);
            renderWithRouter(<CampaignPage />, { route: '/campaigns/camp-1' });
            await screen.findByText('Aria');
            expect(mockWhere).toHaveBeenCalledWith('campaign', '==', 'camp-1');
        });

        test('clicking a character card navigates to it', async () => {
            signIn({ uid: 'user-1' }, { campaign_name: 'The Iron Vale' }, [character]);
            renderWithRouter(<CampaignPage />, { route: '/campaigns/camp-1' });
            fireEvent.click(await screen.findByText('Aria'));
            expect(mockNavigate).toHaveBeenCalledWith('/characters/char-a');
        });

        test('+ New Character navigates to this campaign\'s new-character route', async () => {
            signIn({ uid: 'user-1' }, { campaign_name: 'The Iron Vale' });
            renderWithRouter(<CampaignPage />, { route: '/campaigns/camp-1' });
            fireEvent.click(await screen.findByText('+ New Character'));
            expect(mockNavigate).toHaveBeenCalledWith('/campaigns/camp-1/newCharacter');
        });

        test.each([
            ['Director Mode', '/directors/camp-1'],
            ['Manage Classes', '/campaigns/camp-1/classes'],
            ['Manage Statuses', '/campaigns/camp-1/statuses'],
        ])('%s navigates to %s', async (label, route) => {
            signIn({ uid: 'user-1' }, { campaign_name: 'The Iron Vale' });
            renderWithRouter(<CampaignPage />, { route: '/campaigns/camp-1' });
            fireEvent.click(await screen.findByText(label));
            expect(mockNavigate).toHaveBeenCalledWith(route);
        });

        describe('archived banner', () => {
            test('hidden for an active campaign', async () => {
                signIn({ uid: 'user-1' }, { campaign_name: 'The Iron Vale' });
                renderWithRouter(<CampaignPage />, { route: '/campaigns/camp-1' });
                await screen.findByText('The Iron Vale');
                expect(screen.queryByText(/archived/)).not.toBeInTheDocument();
            });

            test('shown, with no date, when archived but no deletion scheduled', async () => {
                signIn({ uid: 'user-1' }, { campaign_name: 'The Iron Vale', archived: true });
                renderWithRouter(<CampaignPage />, { route: '/campaigns/camp-1' });
                expect(await screen.findByText('This campaign is archived.')).toBeInTheDocument();
            });

            test('includes the formatted deletion date when scheduled', async () => {
                const scheduledDeletionAt = { toDate: () => new Date(2026, 0, 15) };
                signIn({ uid: 'user-1' }, { campaign_name: 'The Iron Vale', archived: true, scheduledDeletionAt });
                renderWithRouter(<CampaignPage />, { route: '/campaigns/camp-1' });
                expect(await screen.findByText(/permanent deletion on January 15, 2026/)).toBeInTheDocument();
            });
        });

        describe('players list', () => {
            test('shows "No players yet." when the list is empty', async () => {
                signIn({ uid: 'user-1' }, { campaign_name: 'The Iron Vale', players: [] });
                renderWithRouter(<CampaignPage />, { route: '/campaigns/camp-1' });
                expect(await screen.findByText('No players yet.')).toBeInTheDocument();
            });

            test('renders a {name, uid} player normally', async () => {
                signIn({ uid: 'user-1' }, { campaign_name: 'The Iron Vale', players: [{ name: 'Sam', uid: 'user-2' }] });
                renderWithRouter(<CampaignPage />, { route: '/campaigns/camp-1' });
                expect(await screen.findByText('Sam')).toBeInTheDocument();
                expect(screen.getByText('user-2')).toBeInTheDocument();
            });

            test('renders a legacy bare-uid-string player as "Unknown Player"', async () => {
                signIn({ uid: 'user-1' }, { campaign_name: 'The Iron Vale', players: ['user-3'] });
                renderWithRouter(<CampaignPage />, { route: '/campaigns/camp-1' });
                expect(await screen.findByText('Unknown Player')).toBeInTheDocument();
                expect(screen.getByText('user-3')).toBeInTheDocument();
            });

            test('renders a legacy DocumentReference-shaped player using its id', async () => {
                signIn({ uid: 'user-1' }, { campaign_name: 'The Iron Vale', players: [{ id: 'user-4' }] });
                renderWithRouter(<CampaignPage />, { route: '/campaigns/camp-1' });
                expect(await screen.findByText('Unknown Player')).toBeInTheDocument();
                expect(screen.getByText('user-4')).toBeInTheDocument();
            });

            describe('with write access', () => {
                test('shows + Add a Player, a Kick button for a kickable player, and a legacy note for a non-kickable one', async () => {
                    signIn({ uid: 'user-1' }, {
                        campaign_name: 'The Iron Vale', canWrite: ['user-1'],
                        players: [{ name: 'Sam', uid: 'user-2' }, 'user-3'],
                    });
                    renderWithRouter(<CampaignPage />, { route: '/campaigns/camp-1' });
                    await screen.findByText('Sam');

                    expect(screen.getByRole('button', { name: '+ Add a Player' })).toBeInTheDocument();
                    expect(screen.getByRole('button', { name: 'Kick' })).toBeInTheDocument();
                    expect(screen.getByText('Legacy record')).toBeInTheDocument();
                });
            });

            describe('without write access', () => {
                test('shows neither Add a Player nor any Kick/legacy affordance', async () => {
                    signIn({ uid: 'user-1' }, { campaign_name: 'The Iron Vale', players: [{ name: 'Sam', uid: 'user-2' }, 'user-3'] });
                    renderWithRouter(<CampaignPage />, { route: '/campaigns/camp-1' });
                    await screen.findByText('Sam');

                    expect(screen.queryByRole('button', { name: '+ Add a Player' })).not.toBeInTheDocument();
                    expect(screen.queryByRole('button', { name: 'Kick' })).not.toBeInTheDocument();
                    expect(screen.queryByText('Legacy record')).not.toBeInTheDocument();
                });
            });
        });

        describe('danger zone', () => {
            test('hidden entirely without admin access', async () => {
                signIn({ uid: 'user-1' }, { campaign_name: 'The Iron Vale' });
                renderWithRouter(<CampaignPage />, { route: '/campaigns/camp-1' });
                await screen.findByText('The Iron Vale');
                expect(screen.queryByText('Danger Zone')).not.toBeInTheDocument();
            });

            test('hidden for a plain canWrite collaborator who is not a doc admin', async () => {
                signIn({ uid: 'user-1' }, { campaign_name: 'The Iron Vale', canWrite: ['user-1'], admins: ['director-1'] });
                renderWithRouter(<CampaignPage />, { route: '/campaigns/camp-1' });
                await screen.findByText('The Iron Vale');
                expect(screen.queryByText('Danger Zone')).not.toBeInTheDocument();
            });

            test('an active campaign shows only Archive', async () => {
                signIn({ uid: 'user-1' }, { campaign_name: 'The Iron Vale', canWrite: ['user-1'], admins: ['user-1'] });
                renderWithRouter(<CampaignPage />, { route: '/campaigns/camp-1' });
                await screen.findByText('The Iron Vale');
                expect(screen.getByRole('button', { name: 'Archive' })).toBeInTheDocument();
                expect(screen.queryByRole('button', { name: 'Unarchive' })).not.toBeInTheDocument();
            });

            test('an archived campaign with no scheduled deletion shows Unarchive and Schedule Deletion', async () => {
                signIn({ uid: 'user-1' }, { campaign_name: 'The Iron Vale', canWrite: ['user-1'], admins: ['user-1'], archived: true });
                renderWithRouter(<CampaignPage />, { route: '/campaigns/camp-1' });
                await screen.findByText('The Iron Vale');
                expect(screen.getByRole('button', { name: 'Unarchive' })).toBeInTheDocument();
                expect(screen.getByRole('button', { name: 'Schedule Deletion' })).toBeInTheDocument();
                expect(screen.queryByRole('button', { name: 'Cancel Deletion' })).not.toBeInTheDocument();
            });

            test('an archived campaign with a scheduled deletion shows Unarchive and Cancel Deletion, and mentions canceling in the Unarchive help text', async () => {
                signIn({ uid: 'user-1' }, {
                    campaign_name: 'The Iron Vale', canWrite: ['user-1'], admins: ['user-1'], archived: true,
                    scheduledDeletionAt: { toDate: () => new Date(2026, 0, 15) },
                });
                renderWithRouter(<CampaignPage />, { route: '/campaigns/camp-1' });
                await screen.findByText('The Iron Vale');
                expect(screen.getByRole('button', { name: 'Cancel Deletion' })).toBeInTheDocument();
                expect(screen.queryByRole('button', { name: 'Schedule Deletion' })).not.toBeInTheDocument();
                expect(screen.getByText(/and cancels the scheduled deletion\./)).toBeInTheDocument();
            });

            test('Archive writes archived + archivedAt and refreshes the campaign', async () => {
                signIn({ uid: 'user-1' }, { campaign_name: 'The Iron Vale', canWrite: ['user-1'], admins: ['user-1'] });
                renderWithRouter(<CampaignPage />, { route: '/campaigns/camp-1' });
                await screen.findByText('The Iron Vale');

                fireEvent.click(screen.getByRole('button', { name: 'Archive' }));

                await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalledWith(
                    { __doc: ['campaigns', 'camp-1'] },
                    { archived: true, archivedAt: { __serverTimestamp: true } },
                ));
                await flush();
            });

            test('Unarchive clears archived, archivedAt, and scheduledDeletionAt', async () => {
                signIn({ uid: 'user-1' }, { campaign_name: 'The Iron Vale', canWrite: ['user-1'], admins: ['user-1'], archived: true });
                renderWithRouter(<CampaignPage />, { route: '/campaigns/camp-1' });
                await screen.findByText('The Iron Vale');

                fireEvent.click(screen.getByRole('button', { name: 'Unarchive' }));

                await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalledWith(
                    { __doc: ['campaigns', 'camp-1'] },
                    { archived: false, archivedAt: { __deleteField: true }, scheduledDeletionAt: { __deleteField: true } },
                ));
                await flush();
            });

            test('a failed danger-zone action is alerted', async () => {
                mockUpdateDoc.mockRejectedValue(new Error('offline'));
                signIn({ uid: 'user-1' }, { campaign_name: 'The Iron Vale', canWrite: ['user-1'], admins: ['user-1'] });
                renderWithRouter(<CampaignPage />, { route: '/campaigns/camp-1' });
                await screen.findByText('The Iron Vale');

                fireEvent.click(screen.getByRole('button', { name: 'Archive' }));

                await waitFor(() => expect(window.alert).toHaveBeenCalled());
            });

            describe('schedule/cancel deletion dialog', () => {
                test('Schedule Deletion opens a confirmation dialog naming the campaign; Cancel dismisses it', async () => {
                    signIn({ uid: 'user-1' }, { campaign_name: 'The Iron Vale', canWrite: ['user-1'], admins: ['user-1'], archived: true });
                    renderWithRouter(<CampaignPage />, { route: '/campaigns/camp-1' });
                    await screen.findByText('The Iron Vale');
                    fireEvent.click(screen.getByRole('button', { name: 'Schedule Deletion' }));
                    expect(screen.getByText('Schedule deletion?')).toBeInTheDocument();

                    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

                    expect(screen.queryByText('Schedule deletion?')).not.toBeInTheDocument();
                });

                test('confirming writes a scheduledDeletionAt roughly 30 days out', async () => {
                    signIn({ uid: 'user-1' }, { campaign_name: 'The Iron Vale', canWrite: ['user-1'], admins: ['user-1'], archived: true });
                    renderWithRouter(<CampaignPage />, { route: '/campaigns/camp-1' });
                    await screen.findByText('The Iron Vale');
                    fireEvent.click(screen.getByRole('button', { name: 'Schedule Deletion' }));

                    const dialogConfirmButton = screen.getAllByRole('button', { name: 'Schedule Deletion' }).pop();
                    fireEvent.click(dialogConfirmButton);

                    await waitFor(() => expect(screen.queryByText('Schedule deletion?')).not.toBeInTheDocument());
                    const ms = mockTimestampFromMillis.mock.calls[0][0];
                    expect(ms).toBeGreaterThan(Date.now() + 29 * 24 * 60 * 60 * 1000);
                });

                test('Cancel Deletion clears scheduledDeletionAt', async () => {
                    signIn({ uid: 'user-1' }, {
                        campaign_name: 'The Iron Vale', canWrite: ['user-1'], admins: ['user-1'], archived: true,
                        scheduledDeletionAt: { toDate: () => new Date(2026, 0, 15) },
                    });
                    renderWithRouter(<CampaignPage />, { route: '/campaigns/camp-1' });
                    await screen.findByText('The Iron Vale');

                    fireEvent.click(screen.getByRole('button', { name: 'Cancel Deletion' }));

                    await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalledWith(
                        { __doc: ['campaigns', 'camp-1'] },
                        { scheduledDeletionAt: { __deleteField: true } },
                    ));
                    await flush();
                });
            });
        });

        describe('kick player dialog', () => {
            async function openKickDialog() {
                signIn({ uid: 'user-1' }, { campaign_name: 'The Iron Vale', canWrite: ['user-1'], players: [{ name: 'Sam', uid: 'user-2' }] });
                renderWithRouter(<CampaignPage />, { route: '/campaigns/camp-1' });
                await screen.findByText('Sam');
                fireEvent.click(screen.getByRole('button', { name: 'Kick' }));
            }

            test('names the target player, and Cancel dismisses it without writing', async () => {
                await openKickDialog();
                expect(screen.getByText('Kick Sam?')).toBeInTheDocument();

                fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

                expect(screen.queryByText('Kick Sam?')).not.toBeInTheDocument();
                expect(mockUpdateDoc).not.toHaveBeenCalled();
            });

            test('confirming removes the player from canRead and players', async () => {
                await openKickDialog();

                fireEvent.click(screen.getByRole('button', { name: 'Kick Player' }));

                await waitFor(() => expect(screen.queryByText('Kick Sam?')).not.toBeInTheDocument());
                expect(mockUpdateDoc).toHaveBeenCalledWith(
                    { __doc: ['campaigns', 'camp-1'] },
                    { canRead: { __arrayRemove: 'user-2' }, players: { __arrayRemove: { name: 'Sam', uid: 'user-2' } } },
                );
            });

            test('a failed kick is alerted', async () => {
                mockUpdateDoc.mockRejectedValue(new Error('offline'));
                await openKickDialog();

                fireEvent.click(screen.getByRole('button', { name: 'Kick Player' }));

                await waitFor(() => expect(window.alert).toHaveBeenCalled());
            });
        });

        describe('add player dialog', () => {
            async function openAddDialog() {
                signIn({ uid: 'user-1' }, { campaign_name: 'The Iron Vale', canWrite: ['user-1'] });
                renderWithRouter(<CampaignPage />, { route: '/campaigns/camp-1' });
                await screen.findByText('The Iron Vale');
                fireEvent.click(screen.getByRole('button', { name: '+ Add a Player' }));
            }

            test('Add Player is disabled until an id is entered; Cancel dismisses and clears the draft', async () => {
                await openAddDialog();
                expect(screen.getByRole('button', { name: 'Add Player' })).toBeDisabled();

                fireEvent.change(screen.getByPlaceholderText('Player ID'), { target: { value: 'user-5' } });
                expect(screen.getByRole('button', { name: 'Add Player' })).toBeEnabled();

                fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
                expect(screen.queryByText('Add a Player')).not.toBeInTheDocument();
            });

            test('adding yourself is rejected without a Firestore call', async () => {
                await openAddDialog();
                fireEvent.change(screen.getByPlaceholderText('Player ID'), { target: { value: 'user-1' } });

                fireEvent.click(screen.getByRole('button', { name: 'Add Player' }));

                expect(window.alert).toHaveBeenCalledWith('Cannot add yourself as a player!');
                expect(mockGetCountFromServer).not.toHaveBeenCalled();
            });

            test('a nonexistent player id is alerted and not added', async () => {
                mockGetCountFromServer.mockResolvedValue({ data: () => ({ count: 0 }) });
                await openAddDialog();
                fireEvent.change(screen.getByPlaceholderText('Player ID'), { target: { value: 'ghost-1' } });

                fireEvent.click(screen.getByRole('button', { name: 'Add Player' }));

                await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Error: player does not exist!'));
                expect(mockUpdateDoc).not.toHaveBeenCalled();
            });

            test('a valid player id adds the player and closes the dialog', async () => {
                await openAddDialog();
                fireEvent.change(screen.getByPlaceholderText('Player ID'), { target: { value: 'user-5' } });

                fireEvent.click(screen.getByRole('button', { name: 'Add Player' }));

                await waitFor(() => expect(screen.queryByText('Add a Player')).not.toBeInTheDocument());
                expect(mockUpdateDoc).toHaveBeenCalledWith(
                    { __doc: ['campaigns', 'camp-1'] },
                    { canRead: { __arrayUnion: 'user-5' }, players: { __arrayUnion: { name: 'Sam', uid: 'user-5' } } },
                );
            });

            test('a failed add is alerted', async () => {
                mockGetCountFromServer.mockRejectedValue(new Error('offline'));
                await openAddDialog();
                fireEvent.change(screen.getByPlaceholderText('Player ID'), { target: { value: 'user-5' } });

                fireEvent.click(screen.getByRole('button', { name: 'Add Player' }));

                await waitFor(() => expect(window.alert).toHaveBeenCalled());
            });
        });
    });
});

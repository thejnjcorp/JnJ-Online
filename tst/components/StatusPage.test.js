jest.mock('../../src/utils/firebase', () => ({ auth: {}, db: {} }));

const mockOnAuthStateChanged = jest.fn();
jest.mock('firebase/auth', () => ({
    onAuthStateChanged: (...args) => mockOnAuthStateChanged(...args),
}));

const mockAddDoc = jest.fn();
const mockArrayRemove = jest.fn();
const mockArrayUnion = jest.fn();
const mockCollection = jest.fn();
const mockDeleteDoc = jest.fn();
const mockDoc = jest.fn();
const mockGetDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockOr = jest.fn();
const mockQuery = jest.fn();
const mockUpdateDoc = jest.fn();
const mockWhere = jest.fn();
jest.mock('firebase/firestore', () => ({
    addDoc: (...args) => mockAddDoc(...args),
    arrayRemove: (...args) => mockArrayRemove(...args),
    arrayUnion: (...args) => mockArrayUnion(...args),
    collection: (...args) => mockCollection(...args),
    deleteDoc: (...args) => mockDeleteDoc(...args),
    doc: (...args) => mockDoc(...args),
    getDoc: (...args) => mockGetDoc(...args),
    getDocs: (...args) => mockGetDocs(...args),
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
import { screen, fireEvent, waitFor } from '@testing-library/react';
// eslint-disable-next-line import/first
import { StatusPage } from '../../src/components/StatusPage';
// eslint-disable-next-line import/first
import { renderWithRouter } from '../testUtils/renderWithRouter';

const ADMIN_UID = 'wmJQbIlzX9RydXFmh3DzSBpIqHa2';

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
    mockDoc.mockImplementation((_db, ...path) => ({ __doc: path }));
    mockQuery.mockImplementation((collectionArg, ...rest) => ({ __collection: collectionArg?.__collection, args: rest }));
    mockOr.mockImplementation((...args) => ({ __or: args }));
    mockWhere.mockImplementation((...args) => ({ __where: args }));
    mockOnAuthStateChanged.mockImplementation(() => jest.fn());
    mockGetDocs.mockResolvedValue(docsFrom([]));
    mockGetDoc.mockResolvedValue({ exists: () => false });
    mockAddDoc.mockResolvedValue({ id: 'new-status-id' });
    mockUpdateDoc.mockResolvedValue(undefined);
    mockDeleteDoc.mockResolvedValue(undefined);
    mockArrayUnion.mockImplementation((value) => ({ __arrayUnion: value }));
    mockArrayRemove.mockImplementation((value) => ({ __arrayRemove: value }));
    window.alert = jest.fn();
    window.confirm = jest.fn(() => true);
});

afterEach(() => {
    delete window.alert;
    delete window.confirm;
});

describe('StatusPage', () => {
    describe('creating a new status', () => {
        function renderNew() {
            renderWithRouter(<StatusPage />, { route: '/statuses' });
        }

        test('sets the document title and shows Create Status with no Delete button', () => {
            renderNew();
            expect(document.title).toBe('New Status');
            expect(screen.getByRole('button', { name: 'Create Status' })).toBeInTheDocument();
            expect(screen.queryByRole('button', { name: 'Delete Status' })).not.toBeInTheDocument();
        });

        test('fields are enabled (a brand-new status has no canWrite to be excluded from)', () => {
            renderNew();
            expect(screen.getByLabelText('Name')).toBeEnabled();
        });

        describe('validation', () => {
            test('a blank name alerts and does not submit', () => {
                renderNew();
                fireEvent.click(screen.getByRole('button', { name: 'Create Status' }));
                expect(window.alert).toHaveBeenCalledWith('A status needs a name.');
                expect(mockAddDoc).not.toHaveBeenCalled();
            });

            test('campaign-locked visibility with no campaign chosen alerts', () => {
                renderNew();
                fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Haste' } });
                fireEvent.click(screen.getByRole('button', { name: 'Campaign-locked' }));

                fireEvent.click(screen.getByRole('button', { name: 'Create Status' }));

                expect(window.alert).toHaveBeenCalledWith('Pick a campaign to lock this status to.');
                expect(mockAddDoc).not.toHaveBeenCalled();
            });

            test('a granted action left unnamed alerts', () => {
                renderNew();
                fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Haste' } });
                fireEvent.click(screen.getByLabelText('Grants a special action while active'));

                fireEvent.click(screen.getByRole('button', { name: 'Create Status' }));

                expect(window.alert).toHaveBeenCalledWith('The granted action needs a name (or turn off "Grants a special action").');
            });
        });

        describe('successful create', () => {
            test('creates the status, marks it public+pool for a non-admin, and navigates to it', async () => {
                signIn({ uid: 'user-1' });
                renderNew();
                await screen.findByLabelText('Name');
                fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Haste' } });

                fireEvent.click(screen.getByRole('button', { name: 'Create Status' }));

                await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/statuses/new-status-id'));
                const [, payload] = mockAddDoc.mock.calls[0];
                expect(payload.name).toBe('Haste');
                expect(payload.public).toBe(true);
                expect(payload.isDefault).toBe(false);
                expect(payload.canWrite).toEqual(['user-1']);
                expect(window.alert).toHaveBeenCalledWith('Status created.');
            });

            test('an admin creating a public status is marked isDefault', async () => {
                signIn({ uid: ADMIN_UID });
                renderNew();
                await screen.findByText(/Public \(Default\)/);
                fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Haste' } });

                fireEvent.click(screen.getByRole('button', { name: 'Create Status' }));

                await waitFor(() => expect(mockAddDoc).toHaveBeenCalled());
                const [, payload] = mockAddDoc.mock.calls[0];
                expect(payload.isDefault).toBe(true);
            });

            test('a creator-locked status sets canRead to just the creator', async () => {
                signIn({ uid: 'user-1' });
                renderNew();
                await screen.findByLabelText('Name');
                fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Haste' } });
                fireEvent.click(screen.getByRole('button', { name: 'Creator-locked' }));

                fireEvent.click(screen.getByRole('button', { name: 'Create Status' }));

                await waitFor(() => expect(mockAddDoc).toHaveBeenCalled());
                const [, payload] = mockAddDoc.mock.calls[0];
                expect(payload.public).toBe(false);
                expect(payload.canRead).toEqual(['user-1']);
            });

            test('a campaign-locked status snapshots that campaign\'s current members into canRead', async () => {
                const campaign = { id: 'camp-1', campaign_name: 'The Iron Vale', canRead: ['p1'], canWrite: ['director-1'] };
                signIn({ uid: 'user-1' }, { campaigns: [campaign] });
                renderNew();
                await screen.findByLabelText('Name');
                fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Haste' } });
                fireEvent.click(screen.getByRole('button', { name: 'Campaign-locked' }));
                fireEvent.change(screen.getByRole('combobox'), { target: { value: 'camp-1' } });

                fireEvent.click(screen.getByRole('button', { name: 'Create Status' }));

                await waitFor(() => expect(mockAddDoc).toHaveBeenCalled());
                const [, payload] = mockAddDoc.mock.calls[0];
                expect(payload.campaignId).toBe('camp-1');
                expect(payload.canRead.sort()).toEqual(['director-1', 'p1']);
            });

            test('a failed create is alerted with the error message', async () => {
                mockAddDoc.mockRejectedValue(new Error('offline'));
                renderNew();
                fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Haste' } });

                fireEvent.click(screen.getByRole('button', { name: 'Create Status' }));

                await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Failed to save status: offline'));
            });
        });

        describe('class scoping', () => {
            test('shows a hint when no classes exist yet', () => {
                renderNew();
                expect(screen.getByText('No classes exist yet.')).toBeInTheDocument();
            });

            test('toggling a class chip selects and deselects it', async () => {
                signIn({ uid: 'user-1' }, { classes: [{ class_name: 'Fighter' }] });
                renderNew();
                const chip = await screen.findByRole('button', { name: 'Fighter' });
                expect(chip.className).not.toMatch(/selected/);

                fireEvent.click(chip);
                expect(chip.className).toMatch(/selected/);

                fireEvent.click(chip);
                expect(chip.className).not.toMatch(/selected/);
            });
        });

        describe('mechanical effects', () => {
            test('+ Add Effect adds a flat-mode effect for the first stat (Action Points, a turn_start trigger)', () => {
                renderNew();
                fireEvent.click(screen.getByRole('button', { name: '+ Add Effect' }));
                expect(screen.getByText('per turn')).toBeInTheDocument();
                expect(screen.getByLabelText('Counts down by 1 stack each "Next Turn"')).toBeChecked();
            });

            test('Remove deletes an effect row', () => {
                renderNew();
                fireEvent.click(screen.getByRole('button', { name: '+ Add Effect' }));
                fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
                expect(screen.queryByText('per turn')).not.toBeInTheDocument();
            });

            test('switching to Scaled shows a stack-level table with one starting row', () => {
                renderNew();
                fireEvent.click(screen.getByRole('button', { name: '+ Add Effect' }));

                fireEvent.click(screen.getByRole('button', { name: 'Scaled by stacks' }));

                expect(screen.getByText('Stacks ≥')).toBeInTheDocument();
                expect(screen.getByRole('button', { name: '+ Add Level' })).toBeInTheDocument();
            });

            test('+ Add Level adds another table row, and Remove deletes one', () => {
                renderNew();
                fireEvent.click(screen.getByRole('button', { name: '+ Add Effect' }));
                fireEvent.click(screen.getByRole('button', { name: 'Scaled by stacks' }));

                fireEvent.click(screen.getByRole('button', { name: '+ Add Level' }));
                expect(screen.getAllByText('Stacks ≥')).toHaveLength(2);

                // index 0 is the effect row's own "Remove" (deletes the
                // whole effect); table-level "Remove" buttons start at 1.
                fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[1]);
                expect(screen.getAllByText('Stacks ≥')).toHaveLength(1);
            });

            test('switching an effect back to the Action Points stat re-enables "counts down each turn"', () => {
                renderNew();
                fireEvent.click(screen.getByRole('button', { name: '+ Add Effect' })); // defaults to Action Points, which auto-checks the box
                const decaysCheckbox = screen.getByLabelText('Counts down by 1 stack each "Next Turn"');
                expect(decaysCheckbox).toBeChecked();
                fireEvent.click(decaysCheckbox); // turn it back off by hand
                fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'base_armor_class' } }); // a passive stat leaves it alone
                expect(decaysCheckbox).not.toBeChecked();

                fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'action_points' } });

                expect(decaysCheckbox).toBeChecked();
            });
        });

        describe('granted action', () => {
            test('the fields only appear once the checkbox is checked', () => {
                renderNew();
                expect(screen.queryByPlaceholderText('Action name')).not.toBeInTheDocument();

                fireEvent.click(screen.getByLabelText('Grants a special action while active'));

                expect(screen.getByPlaceholderText('Action name')).toBeInTheDocument();
            });

            test('toggling "To-hit action" swaps between a to-hit modifier field and a DC field', () => {
                renderNew();
                fireEvent.click(screen.getByLabelText('Grants a special action while active'));
                expect(screen.getByPlaceholderText('DC modifier, e.g. Int,0')).toBeInTheDocument();

                fireEvent.click(screen.getByLabelText('To-hit action (unchecked = DC check)'));

                expect(screen.getByPlaceholderText('To-hit modifier')).toBeInTheDocument();
                expect(screen.queryByPlaceholderText('DC modifier, e.g. Int,0')).not.toBeInTheDocument();
            });
        });
    });

    describe('editing an existing status', () => {
        function statusDoc(overrides = {}) {
            return {
                name: 'Haste', description: '', polarity: 'buff', defaultStacks: 2,
                classes: [], effects: [], public: true, canWrite: ['user-1'],
                ...overrides,
            };
        }

        function renderExisting(data) {
            mockGetDoc.mockResolvedValue({ exists: () => true, data: () => data });
            renderWithRouter(<StatusPage />, { route: '/statuses/status-1' });
        }

        test('fetches the status doc and sets the title to its name', async () => {
            renderExisting(statusDoc());
            expect(await screen.findByDisplayValue('Haste')).toBeInTheDocument();
            expect(mockDoc).toHaveBeenCalledWith({}, 'statuses', 'status-1');
            expect(document.title).toBe('Haste');
        });

        test('fields are enabled for a writer (the current user is on canWrite)', async () => {
            signIn({ uid: 'user-1' });
            renderExisting(statusDoc({ canWrite: ['user-1'] }));
            await screen.findByDisplayValue('Haste');
            await screen.findByLabelText('Name'); // ensure post-auth render settled
            expect(screen.getByLabelText('Name')).toBeEnabled();
            expect(screen.getByRole('button', { name: 'Delete Status' })).toBeInTheDocument();
        });

        test('fields are disabled and read-only for a non-writer, and no Delete button appears', async () => {
            signIn({ uid: 'stranger-1' });
            renderExisting(statusDoc({ canWrite: ['user-1'] }));
            await screen.findByDisplayValue('Haste');
            await waitFor(() => expect(screen.getByLabelText('Name')).toBeDisabled());
            expect(screen.queryByRole('button', { name: 'Delete Status' })).not.toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Update Status' })).toBeDisabled();
        });

        test('Update Status writes via updateDoc and alerts', async () => {
            signIn({ uid: 'user-1' });
            renderExisting(statusDoc({ canWrite: ['user-1'] }));
            await screen.findByDisplayValue('Haste');
            await screen.findByLabelText('Name');

            fireEvent.click(screen.getByRole('button', { name: 'Update Status' }));

            await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Status updated.'));
            expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['statuses', 'status-1'] }, expect.objectContaining({ name: 'Haste' }));
        });

        describe('Delete Status', () => {
            async function renderReadyToDelete() {
                signIn({ uid: 'user-1' });
                renderExisting(statusDoc({ canWrite: ['user-1'] }));
                await screen.findByDisplayValue('Haste');
                await screen.findByRole('button', { name: 'Delete Status' });
            }

            test('confirmed, deletes the doc and navigates to the status list', async () => {
                await renderReadyToDelete();
                fireEvent.click(screen.getByRole('button', { name: 'Delete Status' }));
                await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/status-list'));
                expect(mockDeleteDoc).toHaveBeenCalledWith({ __doc: ['statuses', 'status-1'] });
            });

            test('declined via confirm, deletes nothing', async () => {
                window.confirm = jest.fn(() => false);
                await renderReadyToDelete();
                fireEvent.click(screen.getByRole('button', { name: 'Delete Status' }));
                expect(mockDeleteDoc).not.toHaveBeenCalled();
                expect(mockNavigate).not.toHaveBeenCalled();
            });

            test('a failed delete is alerted', async () => {
                mockDeleteDoc.mockRejectedValue(new Error('offline'));
                await renderReadyToDelete();
                fireEvent.click(screen.getByRole('button', { name: 'Delete Status' }));
                await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Failed to delete status: offline'));
            });
        });

        describe('subscribe your campaigns', () => {
            test('hidden for a creator-locked status', async () => {
                signIn({ uid: 'user-1' });
                renderExisting(statusDoc({ public: false }));
                await screen.findByDisplayValue('Haste');
                expect(screen.queryByText('Subscribe your campaigns')).not.toBeInTheDocument();
            });

            test('hidden for an admin-default status', async () => {
                signIn({ uid: 'user-1' });
                renderExisting(statusDoc({ isDefault: true }));
                await screen.findByDisplayValue('Haste');
                expect(screen.queryByText('Subscribe your campaigns')).not.toBeInTheDocument();
            });

            test('lists only campaigns the viewer directs or can write to, for a public non-default status', async () => {
                const directed = { id: 'camp-1', campaign_name: 'The Iron Vale', director_uid: 'user-1' };
                const readOnly = { id: 'camp-2', campaign_name: 'ReadOnly' };
                signIn({ uid: 'user-1' }, { campaigns: [directed, readOnly] });
                renderExisting(statusDoc());
                await screen.findByDisplayValue('Haste');

                expect(await screen.findByText('The Iron Vale')).toBeInTheDocument();
                expect(screen.queryByText('ReadOnly')).not.toBeInTheDocument();
            });

            test('clicking an unsubscribed campaign subscribes it via arrayUnion', async () => {
                const directed = { id: 'camp-1', campaign_name: 'The Iron Vale', director_uid: 'user-1' };
                signIn({ uid: 'user-1' }, { campaigns: [directed] });
                renderExisting(statusDoc());
                await screen.findByDisplayValue('Haste');
                await screen.findByText('The Iron Vale');

                fireEvent.click(screen.getByRole('button', { name: 'The Iron Vale' }));

                await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalledWith(
                    { __doc: ['campaigns', 'camp-1'] },
                    { subscribedStatusIds: { __arrayUnion: 'status-1' } },
                ));
                expect(await screen.findByRole('button', { name: /The Iron Vale.*✓/ })).toBeInTheDocument();
            });

            test('clicking an already-subscribed campaign unsubscribes it via arrayRemove', async () => {
                const directed = { id: 'camp-1', campaign_name: 'The Iron Vale', director_uid: 'user-1', subscribedStatusIds: ['status-1'] };
                signIn({ uid: 'user-1' }, { campaigns: [directed] });
                renderExisting(statusDoc());
                await screen.findByDisplayValue('Haste');
                await screen.findByRole('button', { name: /The Iron Vale.*✓/ });

                fireEvent.click(screen.getByRole('button', { name: /The Iron Vale/ }));

                await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalledWith(
                    { __doc: ['campaigns', 'camp-1'] },
                    { subscribedStatusIds: { __arrayRemove: 'status-1' } },
                ));
            });
        });
    });
});

jest.mock('../../src/utils/firebase', () => ({ auth: { currentUser: null }, db: {} }));

const mockOnAuthStateChanged = jest.fn();
jest.mock('firebase/auth', () => ({
    onAuthStateChanged: (...args) => mockOnAuthStateChanged(...args),
}));

const mockAddDoc = jest.fn();
const mockArrayRemove = jest.fn();
const mockCollection = jest.fn();
const mockDoc = jest.fn();
const mockGetDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockOr = jest.fn();
const mockQuery = jest.fn();
const mockUpdateDoc = jest.fn();
const mockWhere = jest.fn();
// RacePage.js imports from '@firebase/firestore' directly (as ClassPage.js
// does), not the usual 'firebase/firestore' facade.
jest.mock('@firebase/firestore', () => ({
    addDoc: (...args) => mockAddDoc(...args),
    arrayRemove: (...args) => mockArrayRemove(...args),
    collection: (...args) => mockCollection(...args),
    doc: (...args) => mockDoc(...args),
    getDoc: (...args) => mockGetDoc(...args),
    getDocs: (...args) => mockGetDocs(...args),
    or: (...args) => mockOr(...args),
    query: (...args) => mockQuery(...args),
    updateDoc: (...args) => mockUpdateDoc(...args),
    where: (...args) => mockWhere(...args),
}));

const mockListRaceVersions = jest.fn();
const mockPublishRaceVersion = jest.fn();
const mockResolveRaceVersion = jest.fn();
jest.mock('../../src/utils/raceVersions', () => ({
    ...jest.requireActual('../../src/utils/raceVersions'),
    listRaceVersions: (...args) => mockListRaceVersions(...args),
    publishRaceVersion: (...args) => mockPublishRaceVersion(...args),
    resolveRaceVersion: (...args) => mockResolveRaceVersion(...args),
}));

const mockSubscribeRaceToCampaign = jest.fn();
jest.mock('../../src/utils/campaignSubscriptions', () => ({
    subscribeRaceToCampaign: (...args) => mockSubscribeRaceToCampaign(...args),
}));

jest.mock('../../src/components/ClassActionEditor', () => ({
    ClassActionEditor: ({ action, index, onRemove, onChange, errors }) => <div>
        ActionEditor-stub:{index}:{action.actionName || 'Unnamed'}:{action.category}
        {errors && <span>Errors-{index}:{Object.keys(errors).join(',')}</span>}
        <button type="button" onClick={() => onRemove(index)}>StubRemove-{index}</button>
        <button type="button" onClick={() => onChange({ name: `actions[${index}].actionName`, value: 'Named Feat' })}>StubName-{index}</button>
        <button type="button" onClick={() => onChange({ name: `actions[${index}].actionCost`, value: 9 })}>StubBadCost-{index}</button>
    </div>,
}));
jest.mock('../../src/components/DocAdminManager', () => ({
    DocAdminManager: ({ admins, userId }) => <div>DocAdminManager-stub:{JSON.stringify(admins)}:{userId}</div>,
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useNavigate: () => mockNavigate,
}));

// eslint-disable-next-line import/first
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
// eslint-disable-next-line import/first
import { RacePage } from '../../src/components/RacePage';
// eslint-disable-next-line import/first
import { renderWithRouter } from '../testUtils/renderWithRouter';
// eslint-disable-next-line import/first
import { auth } from '../../src/utils/firebase';
// eslint-disable-next-line import/first
import { validAction } from '../testUtils/actions';

const ADMIN_UID = 'wmJQbIlzX9RydXFmh3DzSBpIqHa2';

function docsFrom(items) {
    return { docs: items.map(item => ({ id: item.id, data: () => item })) };
}

function signIn(user, campaigns = []) {
    mockOnAuthStateChanged.mockImplementation((_auth, callback) => {
        Promise.resolve().then(() => callback(user));
        return jest.fn();
    });
    mockGetDocs.mockResolvedValue(docsFrom(campaigns));
}

beforeEach(() => {
    mockCollection.mockImplementation((_db, name) => ({ __collection: name }));
    mockDoc.mockImplementation((_db, ...path) => ({ __doc: path }));
    mockQuery.mockImplementation((...args) => ({ __query: args }));
    mockOr.mockImplementation((...args) => ({ __or: args }));
    mockWhere.mockImplementation((...args) => ({ __where: args }));
    mockOnAuthStateChanged.mockImplementation(() => jest.fn());
    mockGetDocs.mockResolvedValue(docsFrom([]));
    mockGetDoc.mockResolvedValue({ data: () => ({}) });
    mockAddDoc.mockResolvedValue({ id: 'new-race-id' });
    mockUpdateDoc.mockResolvedValue(undefined);
    mockArrayRemove.mockImplementation((value) => ({ __arrayRemove: value }));
    mockSubscribeRaceToCampaign.mockResolvedValue(undefined);
    mockListRaceVersions.mockResolvedValue([]);
    mockPublishRaceVersion.mockResolvedValue(2);
    auth.currentUser = { uid: 'user-1' };
    window.alert = jest.fn();
});

afterEach(() => {
    delete window.alert;
    auth.currentUser = null;
});

function fillRequiredFields() {
    const [nameInput, authorInput] = screen.getAllByRole('textbox');
    fireEvent.change(nameInput, { target: { value: 'Kobold' } });
    fireEvent.change(authorInput, { target: { value: 'Sam' } });
}

describe('RacePage', () => {
    describe('creating a new race', () => {
        function renderNew() {
            renderWithRouter(<RacePage />, { route: '/races' });
        }

        test('sets the document title and starts already in edit mode, with no Edit button', () => {
            renderNew();
            expect(document.title).toBe('New Race');
            expect(screen.getByPlaceholderText('Race Name')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Create Race' })).toBeInTheDocument();
            expect(screen.queryByRole('button', { name: /Edit|Done Editing/ })).not.toBeInTheDocument();
        });

        test('Cancel navigates back to the race list', () => {
            renderNew();
            fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
            expect(mockNavigate).toHaveBeenCalledWith('/race-list');
        });

        test('the breadcrumb goes back to the race list', () => {
            renderNew();
            fireEvent.click(screen.getByRole('button', { name: /Races$/ }));
            expect(mockNavigate).toHaveBeenCalledWith('/race-list');
        });

        describe('actions', () => {
            test('+ Feat adds a feat-category action editor under Feats', () => {
                renderNew();
                fireEvent.click(screen.getByRole('button', { name: '+ Feat' }));
                expect(screen.getByText(/ActionEditor-stub:0:Unnamed:feat/)).toBeInTheDocument();
                expect(screen.getByText('Feats')).toBeInTheDocument();
            });

            test('a race can have several actions, grouped by category', () => {
                renderNew();
                fireEvent.click(screen.getByRole('button', { name: '+ Feat' }));
                fireEvent.click(screen.getByRole('button', { name: '+ Feat' }));
                fireEvent.click(screen.getByRole('button', { name: '+ Reaction' }));
                expect(screen.getByText(/ActionEditor-stub:1:Unnamed:feat/)).toBeInTheDocument();
                expect(screen.getByText('Reactions')).toBeInTheDocument();
                expect(screen.queryByText('Passives')).not.toBeInTheDocument();
            });

            test('removing the only action goes back to the empty hint', () => {
                renderNew();
                fireEvent.click(screen.getByRole('button', { name: '+ Passive' }));
                fireEvent.click(screen.getByRole('button', { name: 'StubRemove-0' }));
                expect(screen.getByText('No racial feats or actions yet.')).toBeInTheDocument();
            });
        });

        describe('validation', () => {
            test('nothing is flagged until a save is attempted', () => {
                renderNew();
                expect(screen.queryByRole('alert')).not.toBeInTheDocument();
            });

            test('a race without a name or author is not saved, and says exactly what is missing (no alert)', () => {
                renderNew();

                fireEvent.click(screen.getByRole('button', { name: 'Create Race' }));

                expect(mockAddDoc).not.toHaveBeenCalled();
                expect(window.alert).not.toHaveBeenCalled();
                expect(screen.getByText('2 things to fix before saving')).toBeInTheDocument();
                expect(screen.getAllByText('Give the race a name.')).toHaveLength(2); // in the summary and under the field
                expect(screen.getAllByText('Add an author.')).toHaveLength(2);
                expect(screen.getByPlaceholderText('Race Name')).toHaveAttribute('aria-invalid', 'true');
            });

            test('errors clear as each field is fixed, without another save attempt', () => {
                renderNew();
                fireEvent.click(screen.getByRole('button', { name: 'Create Race' }));

                fireEvent.change(screen.getByPlaceholderText('Race Name'), { target: { name: 'name', value: 'Kobold' } });

                expect(screen.getByText('1 thing to fix before saving')).toBeInTheDocument();
                expect(screen.getByPlaceholderText('Race Name')).not.toHaveAttribute('aria-invalid');
            });

            test('a new action starts valid apart from its name, and an unnamed one blocks the save with a pointer to it', () => {
                renderNew();
                fillRequiredFields();
                fireEvent.click(screen.getByRole('button', { name: '+ Feat' }));

                fireEvent.click(screen.getByRole('button', { name: 'Create Race' }));

                expect(mockAddDoc).not.toHaveBeenCalled();
                expect(screen.getByText('Errors-0:actionName')).toBeInTheDocument();
                expect(screen.getByText(/Action #1 \(unnamed\) - name/)).toBeInTheDocument();
            });

            test('an out-of-range cost is caught with its own message', () => {
                renderNew();
                fillRequiredFields();
                fireEvent.click(screen.getByRole('button', { name: '+ Feat' }));
                fireEvent.click(screen.getByRole('button', { name: 'StubName-0' }));
                fireEvent.click(screen.getByRole('button', { name: 'StubBadCost-0' }));

                fireEvent.click(screen.getByRole('button', { name: 'Create Race' }));

                expect(mockAddDoc).not.toHaveBeenCalled();
                expect(screen.getByText('Cost must be a whole number from 0 to 3.')).toBeInTheDocument();
            });

            test('an action with an empty Range is fine', async () => {
                renderNew();
                fillRequiredFields();
                fireEvent.click(screen.getByRole('button', { name: '+ Feat' }));
                fireEvent.click(screen.getByRole('button', { name: 'StubName-0' }));

                fireEvent.click(screen.getByRole('button', { name: 'Create Race' }));

                await waitFor(() => expect(mockAddDoc).toHaveBeenCalled());
            });
        });

        describe('successful submit', () => {
            test('creates the race at version 1, public + pool for a non-admin, and navigates to the new id', async () => {
                signIn({ uid: 'user-1' });
                renderNew();
                fillRequiredFields();
                fireEvent.click(screen.getByRole('button', { name: '+ Feat' }));
                fireEvent.click(screen.getByRole('button', { name: 'StubName-0' }));

                fireEvent.click(screen.getByRole('button', { name: 'Create Race' }));

                await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('new-race-id'));
                expect(mockCollection).toHaveBeenCalledWith({}, 'races');
                const [, payload] = mockAddDoc.mock.calls[0];
                expect(payload.name).toBe('Kobold');
                expect(payload.author).toBe('Sam');
                expect(payload.version).toBe(1);
                expect(payload.public).toBe(true);
                expect(payload.isDefault).toBe(false);
                expect(payload.actions).toHaveLength(1);
                expect(payload.actions[0].category).toBe('feat');
                expect(payload.canWrite).toEqual(['user-1']);
                expect(payload.admins).toEqual(['user-1']);
            });

            test('a private race sets canRead to just the author', async () => {
                renderNew();
                fillRequiredFields();
                fireEvent.click(screen.getByRole('button', { name: /^Private/ }));

                fireEvent.click(screen.getByRole('button', { name: 'Create Race' }));

                await waitFor(() => expect(mockAddDoc).toHaveBeenCalled());
                const [, payload] = mockAddDoc.mock.calls[0];
                expect(payload.public).toBe(false);
                expect(payload.canRead).toEqual(['user-1']);
            });

            test('an admin choosing Public is marked isDefault', async () => {
                auth.currentUser = { uid: ADMIN_UID };
                signIn({ uid: ADMIN_UID });
                renderNew();
                await screen.findByText(/Public \(Default\)/);
                fillRequiredFields();

                fireEvent.click(screen.getByRole('button', { name: 'Create Race' }));

                await waitFor(() => expect(mockAddDoc).toHaveBeenCalled());
                expect(mockAddDoc.mock.calls[0][1].isDefault).toBe(true);
            });

            test('a failed create is alerted with the error message', async () => {
                mockAddDoc.mockRejectedValue(new Error('offline'));
                renderNew();
                fillRequiredFields();

                fireEvent.click(screen.getByRole('button', { name: 'Create Race' }));

                await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Failed to create race: offline'));
            });
        });
    });

    describe('editing an existing race', () => {
        function raceDoc(overrides = {}) {
            return {
                name: 'Kobold', author: 'Sam', description: 'Small and **scaly**.', public: true,
                canWrite: ['user-1'], admins: ['user-1'],
                actions: [validAction({ actionName: 'Mild Fire', category: 'feat', actionCost: 0 })],
                ...overrides,
            };
        }

        function renderExisting(data) {
            mockGetDoc.mockResolvedValue({ data: () => data });
            renderWithRouter(<RacePage />, { route: '/races/race-1' });
        }

        test('fetches the race doc, titles the page with its name, and renders the lore as markdown', async () => {
            renderExisting(raceDoc());
            await screen.findByText('Kobold');
            expect(mockDoc).toHaveBeenCalledWith({}, 'races', 'race-1');
            expect(document.title).toBe('Kobold');
            expect(screen.getByText('scaly').tagName).toBe('STRONG');
            expect(screen.getByText(/ActionEditor-stub:0:Mild Fire:feat/)).toBeInTheDocument();
        });

        test('a legacy race with a single `feat` shows it as its one action', async () => {
            renderExisting(raceDoc({ actions: undefined, feat: { actionName: 'Old Feat', category: 'feat' } }));
            await screen.findByText('Kobold');
            expect(screen.getByText(/ActionEditor-stub:0:Old Feat:feat/)).toBeInTheDocument();
        });

        test('passes the race\'s admins and the signed-in user down to DocAdminManager', async () => {
            signIn({ uid: 'user-1' });
            renderExisting(raceDoc());
            expect(await screen.findByText('DocAdminManager-stub:["user-1"]:user-1')).toBeInTheDocument();
        });

        test('starts in view mode with author line and visibility badge', async () => {
            renderExisting(raceDoc());
            await screen.findByText('Kobold');
            expect(screen.getByText(/by Sam/)).toBeInTheDocument();
            expect(screen.getByText('Pool')).toBeInTheDocument();
            expect(screen.queryByPlaceholderText('Race Name')).not.toBeInTheDocument();
        });

        test.each([
            ['Private', { public: false }],
            ['Default', { isDefault: true }],
        ])('shows the %s badge', async (label, overrides) => {
            renderExisting(raceDoc(overrides));
            await screen.findByText('Kobold');
            expect(screen.getByText(label)).toBeInTheDocument();
        });

        test('Edit is hidden for a viewer without write access, and shown (toggling edit mode) for a writer', async () => {
            renderExisting(raceDoc({ canWrite: ['someone-else'] }));
            await screen.findByText('Kobold');
            expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
        });

        test('Edit toggles into edit mode; Cancel restores the pre-edit values without writing', async () => {
            renderExisting(raceDoc());
            await screen.findByText('Kobold');
            fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
            fireEvent.change(screen.getByDisplayValue('Kobold'), { target: { value: 'Renamed' } });

            fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

            expect(screen.getByText('Kobold')).toBeInTheDocument();
            expect(mockUpdateDoc).not.toHaveBeenCalled();
            expect(mockNavigate).not.toHaveBeenCalled();
        });

        test('Done Editing saves in place via updateDoc, without the version fields, merging the user into canWrite', async () => {
            renderExisting(raceDoc({ version: 2, versionNotes: 'old', publishedAt: 'ts', canWrite: ['user-1', 'director-1'] }));
            await screen.findByText('Kobold');
            fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

            fireEvent.click(screen.getByRole('button', { name: 'Done Editing' }));

            await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalled());
            const [target, payload] = mockUpdateDoc.mock.calls[0];
            expect(target).toEqual({ __doc: ['races', 'race-1'] });
            expect(payload.canWrite.sort()).toEqual(['director-1', 'user-1']);
            expect(payload).not.toHaveProperty('version');
            expect(payload).not.toHaveProperty('versionNotes');
            expect(payload).not.toHaveProperty('publishedAt');
            expect(mockPublishRaceVersion).not.toHaveBeenCalled();
            expect(await screen.findByRole('button', { name: 'Edit' })).toBeInTheDocument();
        });

        test('the lore is edited in the Markdown editor and saved as the race description', async () => {
            renderExisting(raceDoc());
            await screen.findByText('Kobold');
            fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
            const lore = screen.getByLabelText('Lore');
            expect(lore).toHaveValue('Small and **scaly**.');

            fireEvent.change(lore, { target: { value: 'Small, **scaly** and proud.' } });
            fireEvent.click(screen.getByRole('button', { name: 'Done Editing' }));

            await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalled());
            expect(mockUpdateDoc.mock.calls[0][1].description).toBe('Small, **scaly** and proud.');
        });

        test('saving a legacy race writes its feat as the actions list', async () => {
            renderExisting(raceDoc({ actions: undefined, feat: validAction({ id: 'f1', actionName: 'Old Feat', category: 'feat', actionCost: 0 }) }));
            await screen.findByText('Kobold');
            fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

            fireEvent.click(screen.getByRole('button', { name: 'Done Editing' }));

            await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalled());
            expect(mockUpdateDoc.mock.calls[0][1].actions.map(a => a.actionName)).toEqual(['Old Feat']);
        });

        test('a failed update is alerted and editing mode stays open', async () => {
            mockUpdateDoc.mockRejectedValue(new Error('offline'));
            renderExisting(raceDoc());
            await screen.findByText('Kobold');
            fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

            fireEvent.click(screen.getByRole('button', { name: 'Done Editing' }));

            await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Failed to update race: offline'));
            expect(screen.getByRole('button', { name: 'Done Editing' })).toBeInTheDocument();
        });

        describe('versions', () => {
            test('shows the race\'s version badge (v1 when never versioned, else its own number)', async () => {
                renderExisting(raceDoc());
                await screen.findByText('Kobold');
                expect(screen.getByText('v1')).toBeInTheDocument();
            });

            test('Publish is only offered while editing, and names the next version', async () => {
                renderExisting(raceDoc({ version: 2 }));
                await screen.findByText('Kobold');
                expect(screen.queryByRole('button', { name: /Publish as/ })).not.toBeInTheDocument();

                fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

                expect(screen.getByRole('button', { name: 'Publish as v3' })).toBeInTheDocument();
            });

            test('publishing asks for a note, publishes via publishRaceVersion with the version it loaded, and returns to view mode', async () => {
                renderExisting(raceDoc({ version: 2 }));
                await screen.findByText('Kobold');
                fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
                fireEvent.click(screen.getByRole('button', { name: 'Publish as v3' }));
                expect(screen.getByText(/The race as it is currently saved/)).toBeInTheDocument();

                fireEvent.change(screen.getByPlaceholderText(/Rebalanced/), { target: { value: '  More scales  ' } });
                fireEvent.click(screen.getByRole('button', { name: 'Publish v3' }));

                await waitFor(() => expect(mockPublishRaceVersion).toHaveBeenCalled());
                const [raceId, payload, notes, expectedVersion] = mockPublishRaceVersion.mock.calls[0];
                expect(raceId).toBe('race-1');
                expect(notes).toBe('More scales');
                expect(expectedVersion).toBe(2);
                expect(payload.name).toBe('Kobold');
                expect(payload).not.toHaveProperty('version');
                expect(mockUpdateDoc).not.toHaveBeenCalled();
                expect(await screen.findByRole('button', { name: 'Edit' })).toBeInTheDocument();
            });

            test('a failed publish is alerted and the editor stays open', async () => {
                mockPublishRaceVersion.mockRejectedValue(new Error('published by someone else'));
                renderExisting(raceDoc({ version: 2 }));
                await screen.findByText('Kobold');
                fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
                fireEvent.click(screen.getByRole('button', { name: 'Publish as v3' }));

                fireEvent.click(screen.getByRole('button', { name: 'Publish v3' }));

                await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Failed to update race: published by someone else'));
                expect(screen.getByRole('button', { name: 'Done Editing' })).toBeInTheDocument();
            });

            test('cancelling the publish dialog publishes nothing', async () => {
                renderExisting(raceDoc({ version: 2 }));
                await screen.findByText('Kobold');
                fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
                fireEvent.click(screen.getByRole('button', { name: 'Publish as v3' }));

                fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));

                expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
                expect(mockPublishRaceVersion).not.toHaveBeenCalled();
            });

            test('version notes render Markdown', async () => {
                mockListRaceVersions.mockResolvedValue([{ version: 2, notes: 'More **scales**', publishedAt: null }]);
                renderExisting(raceDoc({ version: 2 }));

                expect((await screen.findByText('scales')).tagName).toBe('STRONG');
            });

            test('lists version history from the race\'s own versions', async () => {
                mockListRaceVersions.mockResolvedValue([
                    { version: 2, notes: 'More scales', publishedAt: null },
                    { version: 1, notes: '', publishedAt: null },
                ]);
                renderExisting(raceDoc({ version: 2 }));

                expect(await screen.findByText('Version history')).toBeInTheDocument();
                expect(screen.getByText('More scales')).toBeInTheDocument();
                expect(mockListRaceVersions).toHaveBeenCalledWith('race-1');
            });

            test('viewing an older version is read-only, shows its content (including a legacy feat), and can return to the latest', async () => {
                mockListRaceVersions.mockResolvedValue([
                    { version: 2, notes: 'Renamed', publishedAt: null },
                    { version: 1, notes: '', publishedAt: null },
                ]);
                mockResolveRaceVersion.mockResolvedValue({
                    version: 1, latestVersion: 2,
                    data: raceDoc({ name: 'Kobold (original)', version: 1, actions: undefined, feat: { actionName: 'Old Feat', category: 'feat' } }),
                });
                renderExisting(raceDoc({ name: 'Kobold', version: 2 }));
                await screen.findByText('Version history');

                fireEvent.click(screen.getByRole('button', { name: 'View' }));

                expect(await screen.findByText('Kobold (original)')).toBeInTheDocument();
                expect(screen.getByText(/Viewing version 1/)).toBeInTheDocument();
                expect(screen.getByText(/ActionEditor-stub:0:Old Feat:feat/)).toBeInTheDocument();
                expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();

                fireEvent.click(screen.getByRole('button', { name: /Back to the latest/ }));
                expect(await screen.findByText('Kobold')).toBeInTheDocument();
                expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
            });
        });

        describe('subscribe your campaigns', () => {
            test('hidden for a private race and for an admin-default race', async () => {
                signIn({ uid: 'user-1' });
                renderExisting(raceDoc({ public: false }));
                await screen.findByText('Kobold');
                expect(screen.queryByText('Subscribe your campaigns')).not.toBeInTheDocument();
            });

            test('shown for a pool race, listing only campaigns the viewer directs or can write to', async () => {
                const directed = { id: 'camp-1', campaign_name: 'The Iron Vale', director_uid: 'user-1' };
                const readOnly = { id: 'camp-2', campaign_name: 'ReadOnly' };
                signIn({ uid: 'user-1' }, [directed, readOnly]);
                renderExisting(raceDoc());
                await screen.findByText('Kobold');

                expect(await screen.findByText('The Iron Vale')).toBeInTheDocument();
                expect(screen.queryByText('ReadOnly')).not.toBeInTheDocument();
            });

            test('clicking an unsubscribed campaign subscribes it and shows a checkmark', async () => {
                const directed = { id: 'camp-1', campaign_name: 'The Iron Vale', director_uid: 'user-1' };
                signIn({ uid: 'user-1' }, [directed]);
                renderExisting(raceDoc());
                await screen.findByText('Kobold');
                await screen.findByText('The Iron Vale');

                fireEvent.click(screen.getByRole('button', { name: 'The Iron Vale' }));

                await waitFor(() => expect(mockSubscribeRaceToCampaign).toHaveBeenCalledWith('camp-1', { id: 'race-1' }));
                expect(await screen.findByRole('button', { name: /The Iron Vale.*✓/ })).toBeInTheDocument();
            });

            test('clicking an already-subscribed campaign unsubscribes it via arrayRemove on subscribedRaceIds', async () => {
                const directed = { id: 'camp-1', campaign_name: 'The Iron Vale', director_uid: 'user-1', subscribedRaceIds: ['race-1'] };
                signIn({ uid: 'user-1' }, [directed]);
                renderExisting(raceDoc());
                await screen.findByText('Kobold');
                await screen.findByRole('button', { name: /The Iron Vale.*✓/ });

                fireEvent.click(screen.getByRole('button', { name: /The Iron Vale/ }));

                await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalledWith(
                    { __doc: ['campaigns', 'camp-1'] },
                    { subscribedRaceIds: { __arrayRemove: 'race-1' } },
                ));
            });

            test('a subscription error is alerted', async () => {
                const directed = { id: 'camp-1', campaign_name: 'The Iron Vale', director_uid: 'user-1' };
                mockSubscribeRaceToCampaign.mockRejectedValue(new Error('offline'));
                signIn({ uid: 'user-1' }, [directed]);
                renderExisting(raceDoc());
                await screen.findByText('Kobold');
                await screen.findByText('The Iron Vale');

                fireEvent.click(screen.getByRole('button', { name: 'The Iron Vale' }));

                await waitFor(() => expect(window.alert).toHaveBeenCalled());
            });
        });
    });
});

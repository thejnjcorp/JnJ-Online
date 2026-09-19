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
// ClassPage.js imports from '@firebase/firestore' directly, not the usual
// 'firebase/firestore' facade - both need mocking across this test suite,
// but only this exact specifier is actually reached by this component.
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

const mockListClassVersions = jest.fn();
const mockPublishClassVersion = jest.fn();
const mockResolveClassVersion = jest.fn();
jest.mock('../../src/utils/classVersions', () => ({
    ...jest.requireActual('../../src/utils/classVersions'),
    listClassVersions: (...args) => mockListClassVersions(...args),
    publishClassVersion: (...args) => mockPublishClassVersion(...args),
    resolveClassVersion: (...args) => mockResolveClassVersion(...args),
}));

const mockSubscribeClassToCampaign = jest.fn();
jest.mock('../../src/utils/campaignSubscriptions', () => ({
    subscribeClassToCampaign: (...args) => mockSubscribeClassToCampaign(...args),
}));

jest.mock('../../src/components/ClassActionEditor', () => ({
    ClassActionEditor: ({ action, index, onRemove, onChange, errors }) => <div>
        ActionEditor-stub:{index}:{action.actionName || 'Unnamed'}:{action.category}
        {errors && <span>Errors-{index}:{Object.keys(errors).join(',')}</span>}
        <button type="button" onClick={() => onRemove(index)}>StubRemove-{index}</button>
        <button type="button" onClick={() => onChange({ name: `actions[${index}].actionName`, value: 'Named Action' })}>StubName-{index}</button>
        <button type="button" onClick={() => onChange({ name: `actions[${index}].actionCost`, value: 7 })}>StubBadCost-{index}</button>
        <button type="button" onClick={() => onChange({ name: `actions[${index}].range`, value: '' })}>StubBlankRange-{index}</button>
    </div>,
}));
jest.mock('../../src/components/ClassDamageCard', () => ({
    ClassDamageCard: ({ kind, label, isEditable, onChange, onSetDieType }) => <div>
        DamageCard-stub:{kind}:{label}:{isEditable ? 'editable' : 'readonly'}
        <button type="button" onClick={() => onChange({ target: { name: `base_${kind}_damage_dice`, value: '1', type: 'number' } })}>Fill {kind} dice</button>
        <button type="button" onClick={() => onSetDieType(`base_${kind}_damage_dice_type`, 'd6')}>Fill {kind} die type</button>
        <button type="button" onClick={() => onChange({ target: { name: `base_${kind}_damage_modifier`, value: '0', type: 'number' } })}>Fill {kind} modifier</button>
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
import { ClassPage } from '../../src/components/ClassPage';
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
    mockAddDoc.mockResolvedValue({ id: 'new-class-id' });
    mockUpdateDoc.mockResolvedValue(undefined);
    mockArrayRemove.mockImplementation((value) => ({ __arrayRemove: value }));
    mockSubscribeClassToCampaign.mockResolvedValue([]);
    mockListClassVersions.mockResolvedValue([]);
    mockPublishClassVersion.mockResolvedValue(2);
    auth.currentUser = { uid: 'user-1' };
    window.alert = jest.fn();
});

afterEach(() => {
    delete window.alert;
    auth.currentUser = null;
});

async function fillRequiredFields() {
    const [nameInput, authorInput, healthDice, healingDiceType] = screen.getAllByRole('textbox');
    fireEvent.change(nameInput, { target: { value: 'Fighter' } });
    fireEvent.change(authorInput, { target: { value: 'Sam' } });
    fireEvent.click(screen.getByRole('button', { name: 'Attrionist' }));
    const [armorClass, hitModifier, classDc, hardness] = screen.getAllByRole('spinbutton');
    fireEvent.change(armorClass, { target: { value: '12' } });
    fireEvent.change(hitModifier, { target: { value: '2' } });
    fireEvent.change(classDc, { target: { value: '12' } });
    fireEvent.change(hardness, { target: { value: '0' } });
    fireEvent.change(healthDice, { target: { value: 'd8' } });
    fireEvent.change(healingDiceType, { target: { value: 'd6' } });
    fireEvent.click(screen.getByRole('button', { name: 'Fill melee dice' }));
    fireEvent.click(screen.getByRole('button', { name: 'Fill melee die type' }));
    fireEvent.click(screen.getByRole('button', { name: 'Fill melee modifier' }));
    fireEvent.click(screen.getByRole('button', { name: 'Fill ranged dice' }));
    fireEvent.click(screen.getByRole('button', { name: 'Fill ranged die type' }));
    fireEvent.click(screen.getByRole('button', { name: 'Fill ranged modifier' }));
}

describe('ClassPage', () => {
    describe('creating a new class', () => {
        function renderNew() {
            renderWithRouter(<ClassPage />, { route: '/classes' });
        }

        test('sets the document title and starts already in edit mode', () => {
            renderNew();
            expect(document.title).toBe('New Class');
            expect(screen.getByPlaceholderText('Class Name')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Create Class' })).toBeInTheDocument();
        });

        test('no Edit/Done Editing button for a brand-new class', () => {
            renderNew();
            expect(screen.queryByRole('button', { name: /Edit|Done Editing/ })).not.toBeInTheDocument();
        });

        test('selecting a class type shows its badge immediately', () => {
            renderNew();
            fireEvent.click(screen.getByRole('button', { name: 'Manipulator' }));
            expect(screen.getByText('Manipulator', { selector: '.ClassPage-type-badge' })).toBeInTheDocument();
        });

        test('Cancel navigates back to the class list', () => {
            renderNew();
            fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
            expect(mockNavigate).toHaveBeenCalledWith('/class-list');
        });

        describe('actions', () => {
            test('+ Feat adds a new feat-category action editor', () => {
                renderNew();
                fireEvent.click(screen.getByRole('button', { name: '+ Feat' }));
                expect(screen.getByText(/ActionEditor-stub:0:Unnamed:feat/)).toBeInTheDocument();
                expect(screen.getByText('Feats')).toBeInTheDocument();
            });

            test('actions group under the right category heading', () => {
                renderNew();
                fireEvent.click(screen.getByRole('button', { name: '+ Action' }));
                fireEvent.click(screen.getByRole('button', { name: '+ Reaction' }));
                expect(screen.getByText('Actions')).toBeInTheDocument();
                expect(screen.getByText('Reactions')).toBeInTheDocument();
                expect(screen.queryByText('Passives')).not.toBeInTheDocument();
            });

            test('removing the only action clears the list back to "No actions yet."', () => {
                renderNew();
                fireEvent.click(screen.getByRole('button', { name: '+ Passive' }));
                fireEvent.click(screen.getByRole('button', { name: 'StubRemove-0' }));
                expect(screen.getByText('No actions yet.')).toBeInTheDocument();
            });
        });

        describe('validation', () => {
            test('nothing is flagged until a save is attempted', () => {
                renderNew();
                expect(screen.queryByRole('alert')).not.toBeInTheDocument();
            });

            test('a field cleared back to blank blocks the save and is flagged where it is, with no alert', async () => {
                renderNew();
                await fillRequiredFields();
                fireEvent.change(screen.getAllByRole('textbox')[0], { target: { name: 'class_name', value: '' } });

                fireEvent.click(screen.getByRole('button', { name: 'Create Class' }));

                expect(mockAddDoc).not.toHaveBeenCalled();
                expect(window.alert).not.toHaveBeenCalled();
                expect(screen.getByText('1 thing to fix before saving')).toBeInTheDocument();
                expect(screen.getAllByText('Give the class a name.')).toHaveLength(2); // the summary and under the field
                expect(screen.getByPlaceholderText('Class Name')).toHaveAttribute('aria-invalid', 'true');
            });

            test('an untouched form lists every required field at once instead of failing one check at a time', () => {
                renderNew();

                fireEvent.click(screen.getByRole('button', { name: 'Create Class' }));

                expect(mockAddDoc).not.toHaveBeenCalled();
                const summary = screen.getByText(/things to fix before saving/).closest('.ClassPage-validation-summary');
                ['Class name', 'Author', 'Class type', 'Armor Class', 'Hit Modifier', 'Class DC', 'Hardness', 'Base Health Dice',
                    'Melee damage dice', 'Melee damage die', 'Ranged damage modifier', 'Base Healing Dice Type'].forEach(label => {
                    expect(within(summary).getByText(label)).toBeInTheDocument();
                });
            });

            test('an unset healing dice type is called out by name with the dice it accepts', async () => {
                renderNew();
                const [nameInput, authorInput, healthDice] = screen.getAllByRole('textbox');
                fireEvent.change(nameInput, { target: { name: 'class_name', value: 'Fighter' } });
                fireEvent.change(authorInput, { target: { name: 'author', value: 'Sam' } });
                fireEvent.click(screen.getByRole('button', { name: 'Attrionist' }));
                const [armorClass, hitModifier, classDc, hardness] = screen.getAllByRole('spinbutton');
                fireEvent.change(armorClass, { target: { name: 'base_armor_class', type: 'number', value: '12' } });
                fireEvent.change(hitModifier, { target: { name: 'base_hit_modifier', type: 'number', value: '2' } });
                fireEvent.change(classDc, { target: { name: 'base_class_damage_class', type: 'number', value: '12' } });
                fireEvent.change(hardness, { target: { name: 'base_hardness', type: 'number', value: '0' } });
                fireEvent.change(healthDice, { target: { name: 'base_health_dice', value: 'd8' } });
                fireEvent.click(screen.getByRole('button', { name: 'Fill melee dice' }));
                fireEvent.click(screen.getByRole('button', { name: 'Fill melee die type' }));
                fireEvent.click(screen.getByRole('button', { name: 'Fill melee modifier' }));
                fireEvent.click(screen.getByRole('button', { name: 'Fill ranged dice' }));
                fireEvent.click(screen.getByRole('button', { name: 'Fill ranged die type' }));
                fireEvent.click(screen.getByRole('button', { name: 'Fill ranged modifier' }));

                fireEvent.click(screen.getByRole('button', { name: 'Create Class' }));

                expect(mockAddDoc).not.toHaveBeenCalled();
                expect(screen.getByText('1 thing to fix before saving')).toBeInTheDocument();
                expect(screen.getAllByText('Use d4, d6, d8, d10, d12 or d20.')).toHaveLength(2);
            });

            test('errors clear live as fields are fixed, and the sticky bar counts what is left', async () => {
                renderNew();
                fireEvent.click(screen.getByRole('button', { name: 'Create Class' }));
                const remaining = () => Number(screen.getByRole('button', { name: /things? to fix$/ }).textContent.match(/\d+/)[0]);
                const before = remaining();

                fireEvent.change(screen.getByPlaceholderText('Class Name'), { target: { name: 'class_name', value: 'Fighter' } });

                expect(remaining()).toBe(before - 1);
                expect(screen.getByPlaceholderText('Class Name')).not.toHaveAttribute('aria-invalid');
            });

            describe('actions', () => {
                async function renderFilledWithAction() {
                    renderNew();
                    await fillRequiredFields();
                    fireEvent.click(screen.getByRole('button', { name: '+ Passive' }));
                }

                test('a brand-new action starts valid apart from its name', async () => {
                    await renderFilledWithAction();

                    fireEvent.click(screen.getByRole('button', { name: 'Create Class' }));

                    expect(screen.getByText('Errors-0:actionName')).toBeInTheDocument();
                    expect(screen.getByText(/Action #1 \(unnamed\) - name/)).toBeInTheDocument();
                    expect(screen.getByText('1 thing to fix before saving')).toBeInTheDocument();
                });

                test('a problem is labelled with the action it belongs to', async () => {
                    await renderFilledWithAction();
                    fireEvent.click(screen.getByRole('button', { name: 'StubName-0' }));
                    fireEvent.click(screen.getByRole('button', { name: 'StubBadCost-0' }));

                    fireEvent.click(screen.getByRole('button', { name: 'Create Class' }));

                    expect(mockAddDoc).not.toHaveBeenCalled();
                    expect(screen.getByText(/Action "Named Action" - cost/)).toBeInTheDocument();
                    expect(screen.getByText('Cost must be a whole number from 0 to 3.')).toBeInTheDocument();
                    expect(screen.getByText('Errors-0:actionCost')).toBeInTheDocument();
                });

                test('an empty Range is not an error (the sheet just leaves it out)', async () => {
                    signIn({ uid: 'user-1' });
                    await renderFilledWithAction();
                    fireEvent.click(screen.getByRole('button', { name: 'StubName-0' }));
                    fireEvent.click(screen.getByRole('button', { name: 'StubBlankRange-0' }));

                    fireEvent.click(screen.getByRole('button', { name: 'Create Class' }));

                    await waitFor(() => expect(mockAddDoc).toHaveBeenCalled());
                    expect(window.alert).not.toHaveBeenCalled();
                    expect(mockAddDoc.mock.calls[0][1].actions[0].range).toBe('');
                });
            });
        });

        describe('successful submit', () => {
            test('creates the class, marks it public+pool for a non-admin, and navigates to the new id', async () => {
                signIn({ uid: 'user-1' });
                renderNew();
                await fillRequiredFields();

                fireEvent.click(screen.getByRole('button', { name: 'Create Class' }));

                await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('new-class-id'));
                const [, payload] = mockAddDoc.mock.calls[0];
                expect(payload.class_name).toBe('Fighter');
                expect(payload.public).toBe(true);
                expect(payload.isDefault).toBe(false); // non-admin selecting "public" lands in the pool, not as a default
                expect(payload.canWrite).toEqual(['user-1']);
                expect(payload.admins).toEqual(['user-1']); // firestore.rules requires the creator to be a doc admin to create at all
            });

            test('a brand-new class starts at version 1', async () => {
                signIn({ uid: 'user-1' });
                renderNew();
                await fillRequiredFields();

                fireEvent.click(screen.getByRole('button', { name: 'Create Class' }));

                await waitFor(() => expect(mockAddDoc).toHaveBeenCalled());
                expect(mockAddDoc.mock.calls[0][1].version).toBe(1);
            });

            test('a private class sets canRead to just the author', async () => {
                renderNew();
                await fillRequiredFields();
                fireEvent.click(screen.getByRole('button', { name: /^Private/ }));

                fireEvent.click(screen.getByRole('button', { name: 'Create Class' }));

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
                await fillRequiredFields();

                fireEvent.click(screen.getByRole('button', { name: 'Create Class' }));

                await waitFor(() => expect(mockAddDoc).toHaveBeenCalled());
                const [, payload] = mockAddDoc.mock.calls[0];
                expect(payload.isDefault).toBe(true);
            });

            test('a failed create is alerted with the error message', async () => {
                mockAddDoc.mockRejectedValue(new Error('offline'));
                renderNew();
                await fillRequiredFields();

                fireEvent.click(screen.getByRole('button', { name: 'Create Class' }));

                await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Failed to create class: offline'));
            });
        });
    });

    describe('editing an existing class', () => {
        function classDoc(overrides = {}) {
            return {
                class_name: 'Fighter', author: 'Sam', class_type: 'Attrionist', public: true,
                canWrite: ['user-1'], admins: ['user-1'], actions: [validAction()],
                base_armor_class: 12, base_health_dice: 3, base_hit_modifier: 2, base_healing_dice_type: 2,
                base_class_damage_class: 12, base_hardness: 0,
                base_melee_damage_dice_type: 2, base_melee_damage_dice: 1, base_melee_damage_modifier: 0,
                base_ranged_damage_dice_type: 2, base_ranged_damage_dice: 1, base_ranged_damage_modifier: 0,
                ...overrides,
            };
        }

        function renderExisting(data) {
            mockGetDoc.mockResolvedValue({ data: () => data });
            renderWithRouter(<ClassPage />, { route: '/classes/class-1' });
        }

        test('fetches the class doc and sets the title to its name', async () => {
            renderExisting(classDoc());
            await screen.findByText('Fighter');
            expect(mockDoc).toHaveBeenCalledWith({}, 'classes', 'class-1');
            expect(document.title).toBe('Fighter');
        });

        test('passes the class\'s admins list and the signed-in user down to DocAdminManager', async () => {
            signIn({ uid: 'user-1' });
            renderExisting(classDoc());
            await screen.findByText('Fighter');
            expect(await screen.findByText('DocAdminManager-stub:["user-1"]:user-1')).toBeInTheDocument();
        });

        test('starts in view mode: static title, author line, and visibility badge', async () => {
            renderExisting(classDoc());
            expect(await screen.findByText('Fighter')).toBeInTheDocument();
            expect(screen.getByText(/by Sam/)).toBeInTheDocument();
            expect(screen.getByText('Pool')).toBeInTheDocument();
            expect(screen.queryByPlaceholderText('Class Name')).not.toBeInTheDocument();
        });

        test('a private, non-default class shows the Private badge', async () => {
            renderExisting(classDoc({ public: false }));
            await screen.findByText('Fighter');
            expect(screen.getByText('Private')).toBeInTheDocument();
        });

        test('an admin-default class shows the Default badge', async () => {
            renderExisting(classDoc({ isDefault: true }));
            await screen.findByText('Fighter');
            expect(screen.getByText('Default')).toBeInTheDocument();
        });

        test('Edit is hidden for a viewer without write access', async () => {
            renderExisting(classDoc({ canWrite: ['someone-else'] }));
            await screen.findByText('Fighter');
            expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
        });

        test('Edit is shown for an author with write access, and toggles into edit mode', async () => {
            renderExisting(classDoc());
            await screen.findByText('Fighter');

            fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

            expect(screen.getByRole('button', { name: 'Done Editing' })).toBeInTheDocument();
            expect(screen.getByDisplayValue('Fighter')).toBeInTheDocument();
        });

        test('Cancel while editing restores the pre-edit snapshot without writing', async () => {
            renderExisting(classDoc());
            await screen.findByText('Fighter');
            fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
            fireEvent.change(screen.getByDisplayValue('Fighter'), { target: { value: 'Renamed' } });

            fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

            expect(screen.getByText('Fighter')).toBeInTheDocument();
            expect(mockUpdateDoc).not.toHaveBeenCalled();
            expect(mockNavigate).not.toHaveBeenCalled(); // unlike the new-class flow, existing-class Cancel doesn't navigate away
        });

        test('Done Editing saves via updateDoc, merging the current user into canWrite, and returns to view mode', async () => {
            renderExisting(classDoc({ canWrite: ['user-1', 'director-1'] }));
            await screen.findByText('Fighter');
            fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

            fireEvent.click(screen.getByRole('button', { name: 'Done Editing' }));

            await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalled());
            const [target, payload] = mockUpdateDoc.mock.calls[0];
            expect(target).toEqual({ __doc: ['classes', 'class-1'] });
            expect(payload.canWrite.sort()).toEqual(['director-1', 'user-1']);
            expect(await screen.findByRole('button', { name: 'Edit' })).toBeInTheDocument(); // back to view mode
        });

        test('the lore is edited in the Markdown editor and saved as the class description', async () => {
            renderExisting(classDoc({ description: 'A **grim** veteran.' }));
            await screen.findByText('Fighter');
            fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
            const lore = screen.getByLabelText('Lore & Flavor Text');
            expect(lore).toHaveValue('A **grim** veteran.');

            fireEvent.change(lore, { target: { value: '## Backstory\n\nA *weary* veteran.' } });
            fireEvent.click(screen.getByRole('button', { name: 'Done Editing' }));

            await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalled());
            expect(mockUpdateDoc.mock.calls[0][1].description).toBe('## Backstory\n\nA *weary* veteran.');
        });

        test('Cancel puts the lore back as it was', async () => {
            renderExisting(classDoc({ description: 'Original lore' }));
            await screen.findByText('Fighter');
            fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
            fireEvent.change(screen.getByLabelText('Lore & Flavor Text'), { target: { value: 'Rewritten' } });

            fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
            fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));

            expect(screen.getByLabelText('Lore & Flavor Text')).toHaveValue('Original lore');
            expect(mockUpdateDoc).not.toHaveBeenCalled();
        });

        describe('level-up rewards', () => {
            async function startEditing(data = classDoc()) {
                renderExisting(data);
                await screen.findByText('Fighter');
                fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
            }

            test('rewards added while editing are saved with the class', async () => {
                await startEditing();
                fireEvent.change(screen.getByRole('combobox', { name: /Add to level/ }), { target: { value: '4' } });
                fireEvent.click(screen.getByRole('button', { name: '+ Stat point' }));

                fireEvent.click(screen.getByRole('button', { name: 'Done Editing' }));

                await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalled());
                expect(mockUpdateDoc.mock.calls[0][1].level_rewards).toEqual([expect.objectContaining({ level: 4, kind: 'stat_point', points: 1 })]);
            });

            test('Cancel drops rewards that were added while editing, even when the class had none before', async () => {
                await startEditing();
                fireEvent.click(screen.getByRole('button', { name: '+ Bonus' }));
                expect(screen.getByLabelText('Amount')).toBeInTheDocument();

                fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
                fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));

                expect(screen.queryByLabelText('Amount')).not.toBeInTheDocument();
                expect(mockUpdateDoc).not.toHaveBeenCalled();
            });

            test('Cancel restores rewards that were removed', async () => {
                await startEditing(classDoc({ level_rewards: [{ id: 'r1', level: 2, kind: 'note', text: 'Pick a Stance' }] }));
                fireEvent.click(screen.getByRole('button', { name: 'Remove reward' }));

                fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
                fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));

                expect(screen.getByLabelText('Note')).toHaveValue('Pick a Stance');
            });

            test('a reward with a problem blocks the save, and is listed and outlined', async () => {
                await startEditing();
                fireEvent.click(screen.getByRole('button', { name: '+ Note' })); // a note is blank until written

                fireEvent.click(screen.getByRole('button', { name: 'Done Editing' }));

                expect(mockUpdateDoc).not.toHaveBeenCalled();
                expect(window.alert).not.toHaveBeenCalled();
                expect(screen.getByRole('button', { name: /Level 2 reward - note/ })).toBeInTheDocument();
                expect(screen.getByLabelText('Note')).toHaveAttribute('aria-invalid', 'true');
            });

            test('the problem clears as the note is written', async () => {
                await startEditing();
                fireEvent.click(screen.getByRole('button', { name: '+ Note' }));
                fireEvent.click(screen.getByRole('button', { name: 'Done Editing' }));

                fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'Pick a Stance' } });

                expect(screen.getByLabelText('Note')).not.toHaveAttribute('aria-invalid');
            });

            test('when viewing, the rewards are listed without editing controls', async () => {
                renderExisting(classDoc({ level_rewards: [{ id: 'r1', level: 2, kind: 'bonus', stat: 'armor_class', amount: 1 }] }));
                await screen.findByText('Fighter');

                expect(screen.getByText('+1 Armor Class')).toBeInTheDocument();
                expect(screen.queryByRole('button', { name: '+ Bonus' })).not.toBeInTheDocument();
            });
        });

        test('a failed update is alerted and editing mode stays open', async () => {
            mockUpdateDoc.mockRejectedValue(new Error('offline'));
            renderExisting(classDoc());
            await screen.findByText('Fighter');
            fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

            fireEvent.click(screen.getByRole('button', { name: 'Done Editing' }));

            await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Failed to update class: offline'));
            expect(screen.getByRole('button', { name: 'Done Editing' })).toBeInTheDocument();
        });

        describe('validation while editing', () => {
            async function startEditing(data) {
                renderExisting(data);
                await screen.findByText('Fighter');
                fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
            }

            test('a bare-minimum action, like the ones already saved with an empty Range, saves without complaint', async () => {
                await startEditing(classDoc({ actions: [validAction({ actionName: 'Dead Eye', category: 'feat', actionCost: 0, range: '' })] }));

                fireEvent.click(screen.getByRole('button', { name: 'Done Editing' }));

                await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalled());
                expect(window.alert).not.toHaveBeenCalled();
            });

            test('an existing action with a broken DC blocks the save and says which action and what to type', async () => {
                await startEditing(classDoc({ actions: [validAction(), validAction({ id: 'a2', actionName: 'Hot Shot', difficultyClass: 'Dex' })] }));

                fireEvent.click(screen.getByRole('button', { name: 'Done Editing' }));

                expect(mockUpdateDoc).not.toHaveBeenCalled();
                expect(window.alert).not.toHaveBeenCalled();
                expect(screen.getByText(/Action "Hot Shot" - DC/)).toBeInTheDocument();
                expect(screen.getByText('Use "Stat,Modifier", for example Dex,0.')).toBeInTheDocument();
                expect(screen.getByText('Errors-1:difficultyClass')).toBeInTheDocument();
                expect(screen.queryByText(/Errors-0/)).not.toBeInTheDocument(); // the good action is left alone
            });

            test('publishing is blocked the same way, without opening the publish dialog', async () => {
                await startEditing(classDoc({ version: 2, actions: [validAction({ actionName: '' })] }));

                fireEvent.click(screen.getByRole('button', { name: 'Publish as v3' }));

                expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
                expect(mockPublishClassVersion).not.toHaveBeenCalled();
                expect(screen.getByText(/Action #1 \(unnamed\) - name/)).toBeInTheDocument();
            });

            test('Cancel and then Edit again starts with no errors showing', async () => {
                await startEditing(classDoc({ actions: [validAction({ actionName: '' })] }));
                fireEvent.click(screen.getByRole('button', { name: 'Done Editing' }));
                expect(screen.getByText('1 thing to fix before saving')).toBeInTheDocument();

                fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
                fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));

                expect(screen.queryByText(/thing to fix before saving/)).not.toBeInTheDocument();
            });
        });

        describe('versions', () => {
            test('shows the class\'s version badge (v1 for a class that has never been versioned)', async () => {
                renderExisting(classDoc());
                await screen.findByText('Fighter');
                expect(screen.getByText('v1')).toBeInTheDocument();
            });

            test('shows a versioned class\'s own number', async () => {
                renderExisting(classDoc({ version: 3 }));
                await screen.findByText('Fighter');
                expect(screen.getByText('v3')).toBeInTheDocument();
            });

            test('"Update Class" style saves never write the version fields back, so a stale copy can\'t roll a newer version back', async () => {
                renderExisting(classDoc({ version: 2, versionNotes: 'Old notes', publishedAt: 'ts' }));
                await screen.findByText('Fighter');
                fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

                fireEvent.click(screen.getByRole('button', { name: 'Update Class' }));

                await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalled());
                const payload = mockUpdateDoc.mock.calls[0][1];
                expect(payload).not.toHaveProperty('version');
                expect(payload).not.toHaveProperty('versionNotes');
                expect(payload).not.toHaveProperty('publishedAt');
                expect(mockPublishClassVersion).not.toHaveBeenCalled();
            });

            test('Publish is only offered while editing, and names the next version', async () => {
                renderExisting(classDoc({ version: 2 }));
                await screen.findByText('Fighter');
                expect(screen.queryByRole('button', { name: /Publish as/ })).not.toBeInTheDocument();

                fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

                expect(screen.getByRole('button', { name: 'Publish as v3' })).toBeInTheDocument();
            });

            test('publishing asks for a changelog note, publishes via publishClassVersion with the version it loaded, and returns to view mode', async () => {
                renderExisting(classDoc({ version: 2 }));
                await screen.findByText('Fighter');
                fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
                fireEvent.click(screen.getByRole('button', { name: 'Publish as v3' }));

                fireEvent.change(screen.getByPlaceholderText(/Rebalanced/), { target: { value: '  Rebalanced Stab  ' } });
                fireEvent.click(screen.getByRole('button', { name: 'Publish v3' }));

                await waitFor(() => expect(mockPublishClassVersion).toHaveBeenCalled());
                const [classId, payload, notes, expectedVersion] = mockPublishClassVersion.mock.calls[0];
                expect(classId).toBe('class-1');
                expect(notes).toBe('Rebalanced Stab');
                expect(expectedVersion).toBe(2);
                expect(payload.class_name).toBe('Fighter');
                expect(payload).not.toHaveProperty('version');
                expect(mockUpdateDoc).not.toHaveBeenCalled();
                expect(await screen.findByRole('button', { name: 'Edit' })).toBeInTheDocument();
            });

            test('a failed publish is alerted and the editor stays open', async () => {
                mockPublishClassVersion.mockRejectedValue(new Error('published by someone else'));
                renderExisting(classDoc({ version: 2 }));
                await screen.findByText('Fighter');
                fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
                fireEvent.click(screen.getByRole('button', { name: 'Publish as v3' }));

                fireEvent.click(screen.getByRole('button', { name: 'Publish v3' }));

                await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Failed to update class: published by someone else'));
                expect(screen.getByRole('button', { name: 'Done Editing' })).toBeInTheDocument();
            });

            test('cancelling the publish dialog publishes nothing', async () => {
                renderExisting(classDoc({ version: 2 }));
                await screen.findByText('Fighter');
                fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
                fireEvent.click(screen.getByRole('button', { name: 'Publish as v3' }));

                fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));

                expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
                expect(mockPublishClassVersion).not.toHaveBeenCalled();
            });

            test('lists the version history with changelog notes', async () => {
                mockListClassVersions.mockResolvedValue([
                    { version: 2, notes: 'Added Fleetfoot', publishedAt: null },
                    { version: 1, notes: '', publishedAt: null },
                ]);
                renderExisting(classDoc({ version: 2 }));

                expect(await screen.findByText('Version history')).toBeInTheDocument();
                expect(screen.getByText('Added Fleetfoot')).toBeInTheDocument();
            });

            test('viewing an older version is read-only: shows its content, hides Edit, and can return to the latest', async () => {
                mockListClassVersions.mockResolvedValue([
                    { version: 2, notes: 'Renamed', publishedAt: null },
                    { version: 1, notes: '', publishedAt: null },
                ]);
                mockResolveClassVersion.mockResolvedValue({ version: 1, latestVersion: 2, data: classDoc({ class_name: 'Fighter (original)', version: 1 }) });
                renderExisting(classDoc({ class_name: 'Fighter', version: 2 }));
                await screen.findByText('Version history');

                fireEvent.click(screen.getByRole('button', { name: 'View' }));

                expect(await screen.findByText('Fighter (original)')).toBeInTheDocument();
                expect(screen.getByText(/Viewing version 1/)).toBeInTheDocument();
                expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();

                fireEvent.click(screen.getByRole('button', { name: /Back to the latest/ }));
                expect(await screen.findByText('Fighter')).toBeInTheDocument();
                expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
            });
        });

        describe('subscribe your campaigns', () => {
            test('hidden for a private class', async () => {
                signIn({ uid: 'user-1' });
                renderExisting(classDoc({ public: false }));
                await screen.findByText('Fighter');
                expect(screen.queryByText('Subscribe your campaigns')).not.toBeInTheDocument();
            });

            test('hidden for an admin-default class', async () => {
                signIn({ uid: 'user-1' });
                renderExisting(classDoc({ isDefault: true }));
                await screen.findByText('Fighter');
                expect(screen.queryByText('Subscribe your campaigns')).not.toBeInTheDocument();
            });

            test('shown for a public, non-default class; lists only campaigns the viewer directs or can write to', async () => {
                const directed = { id: 'camp-1', campaign_name: 'The Iron Vale', director_uid: 'user-1' };
                const readOnly = { id: 'camp-2', campaign_name: 'ReadOnly' };
                signIn({ uid: 'user-1' }, [directed, readOnly]);
                renderExisting(classDoc());
                await screen.findByText('Fighter');

                expect(await screen.findByText('The Iron Vale')).toBeInTheDocument();
                expect(screen.queryByText('ReadOnly')).not.toBeInTheDocument();
            });

            test('a hint appears when the viewer directs no campaigns', async () => {
                signIn({ uid: 'user-1' }, []);
                renderExisting(classDoc());
                await screen.findByText('Fighter');
                expect(await screen.findByText("You don't direct (or have write access to) any campaigns yet.")).toBeInTheDocument();
            });

            test('clicking an unsubscribed campaign subscribes it', async () => {
                const directed = { id: 'camp-1', campaign_name: 'The Iron Vale', director_uid: 'user-1' };
                signIn({ uid: 'user-1' }, [directed]);
                renderExisting(classDoc());
                await screen.findByText('Fighter');
                await screen.findByText('The Iron Vale');

                fireEvent.click(screen.getByRole('button', { name: 'The Iron Vale' }));

                await waitFor(() => expect(mockSubscribeClassToCampaign).toHaveBeenCalledWith('camp-1', { id: 'class-1', class_name: 'Fighter' }));
                expect(await screen.findByRole('button', { name: /The Iron Vale.*✓/ })).toBeInTheDocument();
            });

            test('clicking an already-subscribed campaign unsubscribes it via arrayRemove', async () => {
                const directed = { id: 'camp-1', campaign_name: 'The Iron Vale', director_uid: 'user-1', subscribedClassIds: ['class-1'] };
                signIn({ uid: 'user-1' }, [directed]);
                renderExisting(classDoc());
                await screen.findByText('Fighter');
                await screen.findByRole('button', { name: /The Iron Vale.*✓/ });

                fireEvent.click(screen.getByRole('button', { name: /The Iron Vale/ }));

                await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalledWith(
                    { __doc: ['campaigns', 'camp-1'] },
                    { subscribedClassIds: { __arrayRemove: 'class-1' } },
                ));
            });

            test('a subscription error is alerted', async () => {
                const directed = { id: 'camp-1', campaign_name: 'The Iron Vale', director_uid: 'user-1' };
                mockSubscribeClassToCampaign.mockRejectedValue(new Error('offline'));
                signIn({ uid: 'user-1' }, [directed]);
                renderExisting(classDoc());
                await screen.findByText('Fighter');
                await screen.findByText('The Iron Vale');

                fireEvent.click(screen.getByRole('button', { name: 'The Iron Vale' }));

                await waitFor(() => expect(window.alert).toHaveBeenCalled());
            });
        });
    });
});

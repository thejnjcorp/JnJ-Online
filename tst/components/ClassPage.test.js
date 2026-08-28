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

const mockSubscribeClassToCampaign = jest.fn();
jest.mock('../../src/utils/campaignSubscriptions', () => ({
    subscribeClassToCampaign: (...args) => mockSubscribeClassToCampaign(...args),
}));

jest.mock('../../src/components/ClassActionEditor', () => ({
    ClassActionEditor: ({ action, index, onRemove }) => <div>
        ActionEditor-stub:{index}:{action.actionName || 'Unnamed'}:{action.category}
        <button type="button" onClick={() => onRemove(index)}>StubRemove-{index}</button>
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

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useNavigate: () => mockNavigate,
}));

// eslint-disable-next-line import/first
import { screen, fireEvent, waitFor } from '@testing-library/react';
// eslint-disable-next-line import/first
import { ClassPage } from '../../src/components/ClassPage';
// eslint-disable-next-line import/first
import { renderWithRouter } from '../testUtils/renderWithRouter';
// eslint-disable-next-line import/first
import { auth } from '../../src/utils/firebase';

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
            test('a field explicitly cleared back to blank alerts and does not submit', async () => {
                // Mirrors NewCharacterPage.js's identical quirk: this check
                // only catches a field the reducer has actually recorded as
                // "" - a field that was simply never touched stays
                // undefined, which doesn't equal "" and slips past this
                // check into the dice-type checks instead (covered by the
                // next test). So this exercises the guard the way it's
                // actually reachable: fill out the form validly, then
                // explicitly clear one field back to blank.
                renderNew();
                await fillRequiredFields();
                fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: '' } }); // class_name

                fireEvent.click(screen.getByRole('button', { name: 'Create Class' }));

                expect(window.alert).toHaveBeenCalledWith('invalid form value(s)');
                expect(mockAddDoc).not.toHaveBeenCalled();
            });

            test('an untouched (never-filled-out) form falls through to the dice-type checks instead', () => {
                renderNew();
                fireEvent.click(screen.getByRole('button', { name: 'Create Class' }));
                expect(window.alert).toHaveBeenCalledWith('invalid base healing dice type');
                expect(mockAddDoc).not.toHaveBeenCalled();
            });

            test('an unset healing dice type is caught by its own dedicated check', async () => {
                renderNew();
                const [nameInput, authorInput, healthDice] = screen.getAllByRole('textbox');
                fireEvent.change(nameInput, { target: { value: 'Fighter' } });
                fireEvent.change(authorInput, { target: { value: 'Sam' } });
                fireEvent.click(screen.getByRole('button', { name: 'Attrionist' }));
                const [armorClass, hitModifier, classDc, hardness] = screen.getAllByRole('spinbutton');
                fireEvent.change(armorClass, { target: { value: '12' } });
                fireEvent.change(hitModifier, { target: { value: '2' } });
                fireEvent.change(classDc, { target: { value: '12' } });
                fireEvent.change(hardness, { target: { value: '0' } });
                fireEvent.change(healthDice, { target: { value: 'd8' } });
                fireEvent.click(screen.getByRole('button', { name: 'Fill melee dice' }));
                fireEvent.click(screen.getByRole('button', { name: 'Fill melee die type' }));
                fireEvent.click(screen.getByRole('button', { name: 'Fill melee modifier' }));
                fireEvent.click(screen.getByRole('button', { name: 'Fill ranged dice' }));
                fireEvent.click(screen.getByRole('button', { name: 'Fill ranged die type' }));
                fireEvent.click(screen.getByRole('button', { name: 'Fill ranged modifier' }));

                fireEvent.click(screen.getByRole('button', { name: 'Create Class' }));

                expect(window.alert).toHaveBeenCalledWith('invalid base healing dice type');
                expect(mockAddDoc).not.toHaveBeenCalled();
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
                canWrite: ['user-1'], actions: [{ id: 'a1', actionName: 'Stab', category: 'action' }],
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

        test('a failed update is alerted and editing mode stays open', async () => {
            mockUpdateDoc.mockRejectedValue(new Error('offline'));
            renderExisting(classDoc());
            await screen.findByText('Fighter');
            fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

            fireEvent.click(screen.getByRole('button', { name: 'Done Editing' }));

            await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Failed to update class: offline'));
            expect(screen.getByRole('button', { name: 'Done Editing' })).toBeInTheDocument();
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

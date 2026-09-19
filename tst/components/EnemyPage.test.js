jest.mock('../../src/utils/firebase', () => ({ auth: {}, db: {} }));
const mockOnAuthStateChanged = jest.fn();
jest.mock('firebase/auth', () => ({ onAuthStateChanged: (...args) => mockOnAuthStateChanged(...args) }));

const mockAddDoc = jest.fn();
const mockDeleteDoc = jest.fn();
const mockGetDoc = jest.fn();
const mockUpdateDoc = jest.fn();
jest.mock('firebase/firestore', () => ({
    addDoc: (...args) => mockAddDoc(...args),
    collection: (_db, name) => ({ __collection: name }),
    deleteDoc: (...args) => mockDeleteDoc(...args),
    doc: (_db, ...path) => ({ __doc: path }),
    getDoc: (...args) => mockGetDoc(...args),
    updateDoc: (...args) => mockUpdateDoc(...args),
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({ ...jest.requireActual('react-router-dom'), useNavigate: () => mockNavigate }));
jest.mock('../../src/utils/useTagCatalog', () => ({ useTagCatalog: () => ({ tags: [], status: 'ready' }) }));
jest.mock('../../src/components/DocAdminManager', () => ({
    DocAdminManager: ({ admins, userId }) => <div>DocAdminManager-stub:{JSON.stringify(admins)}:{userId}</div>,
}));

// eslint-disable-next-line import/first
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
// eslint-disable-next-line import/first
import { EnemyPage } from '../../src/components/EnemyPage';
// eslint-disable-next-line import/first
import { renderWithRouter } from '../testUtils/renderWithRouter';
// eslint-disable-next-line import/first
import { validAction } from '../testUtils/actions';

function signIn(user) {
    mockOnAuthStateChanged.mockImplementation((_auth, callback) => {
        Promise.resolve().then(() => callback(user));
        return jest.fn();
    });
}

beforeEach(() => {
    signIn({ uid: 'dm' });
    mockGetDoc.mockResolvedValue({ exists: () => false });
    mockAddDoc.mockResolvedValue({ id: 'new-enemy' });
    mockUpdateDoc.mockResolvedValue(undefined);
    mockDeleteDoc.mockResolvedValue(undefined);
    window.alert = jest.fn();
    window.confirm = jest.fn(() => true);
    window.HTMLElement.prototype.scrollIntoView = jest.fn();
});

afterEach(() => {
    delete window.alert;
    delete window.confirm;
});

const field = label => screen.getByLabelText(label);
const type = (label, value) => fireEvent.change(field(label), { target: { value } });
const save = name => screen.getByRole('button', { name });
const summary = () => document.querySelector('.ClassPage-validation-summary');
const modifiers = title => screen.getByText(title).closest('.EnemyPage-modifiers');

describe('EnemyPage', () => {
    describe('creating an enemy', () => {
        function renderNew() {
            renderWithRouter(<EnemyPage />, { route: '/enemies' });
        }

        test('sets the title and starts with a blank, sensible stat block', async () => {
            renderNew();
            expect(document.title).toBe('New Enemy');
            expect(await screen.findByLabelText('Name')).toHaveValue('');
            expect(field('Level')).toHaveValue(1);
            expect(field('Maximum Health')).toHaveValue(10);
            expect(field('Action Points')).toHaveValue(3);
            expect(screen.getByRole('button', { name: 'Regular' })).toHaveAttribute('aria-pressed', 'true');
            expect(screen.getByRole('button', { name: /^Private/ })).toHaveAttribute('aria-pressed', 'true');
            expect(screen.queryByRole('button', { name: 'Delete Enemy' })).not.toBeInTheDocument();
        });

        test('offers the five tiers, and choosing one selects it', async () => {
            renderNew();
            const tiers = within(await screen.findByRole('group', { name: 'Tier' }));
            expect(tiers.getAllByRole('button').map(button => button.textContent)).toEqual(['Goon', 'Regular', 'Veteran', 'Elite', 'Captain']);

            fireEvent.click(tiers.getByRole('button', { name: 'Elite' }));

            expect(tiers.getByRole('button', { name: 'Elite' })).toHaveAttribute('aria-pressed', 'true');
            expect(tiers.getByRole('button', { name: 'Regular' })).toHaveAttribute('aria-pressed', 'false');
        });

        test('nothing is flagged until a save is attempted; then a nameless enemy is not saved and says what is wrong', async () => {
            renderNew();
            await screen.findByLabelText('Name');
            expect(screen.queryByRole('alert')).not.toBeInTheDocument();

            fireEvent.click(save('Create Enemy'));

            expect(mockAddDoc).not.toHaveBeenCalled();
            expect(window.alert).not.toHaveBeenCalled();
            expect(summary()).toHaveTextContent('Give the enemy a name.');
            expect(field('Name')).toHaveAttribute('aria-invalid', 'true');
        });

        test('a problem clears as it is fixed', async () => {
            renderNew();
            await screen.findByLabelText('Name');
            fireEvent.click(save('Create Enemy'));

            type('Name', 'Wolf');

            expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        });

        test('every stat is checked: a blank or out-of-range number is explained', async () => {
            renderNew();
            await screen.findByLabelText('Name');
            type('Name', 'Wolf');
            type('Maximum Health', '');
            type('Action Points', '9');
            fireEvent.click(save('Create Enemy'));

            expect(summary()).toHaveTextContent('2 things to fix');
            expect(field(/^Maximum Health/)).toHaveAttribute('aria-invalid', 'true'); // its message is part of its label now
            expect(field(/^Action Points/)).toHaveAttribute('aria-invalid', 'true');
            expect(summary()).toHaveTextContent('Enter a whole number.');
            expect(summary()).toHaveTextContent('Must be from 0 to 4.');
            expect(mockAddDoc).not.toHaveBeenCalled();
        });

        test('saves a private enemy: its stats, readable only by its creator, who is its writer and admin', async () => {
            renderNew();
            await screen.findByLabelText('Name');
            type('Name', '  Rust Bandit ');
            fireEvent.click(screen.getByRole('button', { name: 'Goon' }));
            type('Maximum Health', '12');
            type('Strength', '-1');

            fireEvent.click(save('Create Enemy'));

            await waitFor(() => expect(mockAddDoc).toHaveBeenCalled());
            const [target, payload] = mockAddDoc.mock.calls[0];
            expect(target).toEqual({ __collection: 'enemies' });
            expect(payload).toMatchObject({
                enemy_name: 'Rust Bandit', enemy_type: 'Goon', level: 1, maximum_health: 12, strength_stat: -1, base_armor_class: 12, action_points: 3,
                Weaknesses: [], Resistances: [], actions: [], description: '',
                public: false, canRead: ['dm'], canWrite: ['dm'], admins: ['dm'],
            });
            await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/enemies/new-enemy'));
            expect(window.alert).toHaveBeenCalledWith('Enemy created.');
        });

        test('a public enemy is readable by everyone', async () => {
            renderNew();
            await screen.findByLabelText('Name');
            type('Name', 'Wolf');
            fireEvent.click(screen.getByRole('button', { name: /^Public/ }));

            fireEvent.click(save('Create Enemy'));

            await waitFor(() => expect(mockAddDoc).toHaveBeenCalled());
            expect(mockAddDoc.mock.calls[0][1]).toMatchObject({ public: true, canRead: [] });
        });

        test('only the stat block, notes and visibility are written - nothing from the form\'s own bookkeeping', async () => {
            renderNew();
            await screen.findByLabelText('Name');
            type('Name', 'Wolf');
            fireEvent.click(save('Create Enemy'));
            await waitFor(() => expect(mockAddDoc).toHaveBeenCalled());
            expect(mockAddDoc.mock.calls[0][1]).not.toHaveProperty('visibility');
        });

        test('a failed save is alerted', async () => {
            mockAddDoc.mockRejectedValue(new Error('offline'));
            renderNew();
            await screen.findByLabelText('Name');
            type('Name', 'Wolf');
            fireEvent.click(save('Create Enemy'));
            await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Failed to save enemy: offline'));
            expect(mockNavigate).not.toHaveBeenCalled();
        });

        describe('weaknesses and resistances', () => {
            test('are rows of a type and an amount, saved as "Fire 5" strings', async () => {
                renderNew();
                await screen.findByLabelText('Name');
                type('Name', 'Golem');
                const addWeakness = within(modifiers('Weaknesses')).getByRole('button', { name: '+ Add' });
                fireEvent.click(addWeakness);
                type('Weaknesses type 1', 'Non Magical-Physical');
                type('Weaknesses amount 1', '4');
                fireEvent.click(addWeakness);
                type('Weaknesses type 2', 'Fire');
                type('Weaknesses amount 2', '-2');
                fireEvent.click(within(modifiers('Resistances')).getByRole('button', { name: '+ Add' }));
                type('Resistances type 1', 'Acid');
                type('Resistances amount 1', '10');

                fireEvent.click(save('Create Enemy'));

                await waitFor(() => expect(mockAddDoc).toHaveBeenCalled());
                expect(mockAddDoc.mock.calls[0][1]).toMatchObject({ Weaknesses: ['Non Magical-Physical 4', 'Fire -2'], Resistances: ['Acid 10'] });
            });

            test('a type can be typed with spaces in it', async () => {
                renderNew();
                await screen.findByLabelText('Name');
                fireEvent.click(within(modifiers('Weaknesses')).getByRole('button', { name: '+ Add' }));

                type('Weaknesses type 1', 'Non ');
                expect(field('Weaknesses type 1')).toHaveValue('Non ');
                type('Weaknesses type 1', 'Non Magical');
                expect(field('Weaknesses type 1')).toHaveValue('Non Magical');
            });

            test('a row with no amount blocks the save and says how it should look', async () => {
                renderNew();
                await screen.findByLabelText('Name');
                type('Name', 'Golem');
                fireEvent.click(within(modifiers('Weaknesses')).getByRole('button', { name: '+ Add' }));
                type('Weaknesses type 1', 'Fire');

                fireEvent.click(save('Create Enemy'));

                expect(mockAddDoc).not.toHaveBeenCalled();
                expect(screen.getAllByText(/like "Fire 5"/).length).toBeGreaterThan(0);
            });

            test('a row can be removed', async () => {
                renderNew();
                await screen.findByLabelText('Name');
                type('Name', 'Golem');
                fireEvent.click(within(modifiers('Weaknesses')).getByRole('button', { name: '+ Add' }));
                type('Weaknesses type 1', 'Fire');
                type('Weaknesses amount 1', '5');

                fireEvent.click(screen.getByRole('button', { name: 'Remove weaknesses 1' }));
                fireEvent.click(save('Create Enemy'));

                await waitFor(() => expect(mockAddDoc).toHaveBeenCalled());
                expect(mockAddDoc.mock.calls[0][1].Weaknesses).toEqual([]);
            });
        });

        describe('actions', () => {
            test('+ Action adds an action editor, grouped under Actions, and an unfinished one blocks the save', async () => {
                renderNew();
                await screen.findByLabelText('Name');
                type('Name', 'Wolf');

                fireEvent.click(screen.getByRole('button', { name: '+ Action' }));
                expect(screen.getByText('Unnamed')).toBeInTheDocument();
                fireEvent.click(save('Create Enemy'));

                expect(mockAddDoc).not.toHaveBeenCalled();
                expect(summary()).toHaveTextContent(/Action #1 \(unnamed\) - name/);
            });

            test('each kind can be added', async () => {
                renderNew();
                await screen.findByLabelText('Name');
                ['+ Feat', '+ Passive', '+ Reaction', '+ Action'].forEach(name => fireEvent.click(screen.getByRole('button', { name })));
                expect(screen.getAllByText('Unnamed')).toHaveLength(4);
            });

            test('a finished action is saved with the enemy', async () => {
                renderNew();
                await screen.findByLabelText('Name');
                type('Name', 'Wolf');
                fireEvent.click(screen.getByRole('button', { name: '+ Action' }));
                fireEvent.click(screen.getByRole('button', { name: /Unnamed/ }));
                fireEvent.change(document.querySelector('input[name="actionName"]'), { target: { name: 'actionName', value: 'Bite' } });

                fireEvent.click(save('Create Enemy'));

                await waitFor(() => expect(mockAddDoc).toHaveBeenCalled());
                expect(mockAddDoc.mock.calls[0][1].actions).toHaveLength(1);
                expect(mockAddDoc.mock.calls[0][1].actions[0]).toMatchObject({ actionName: 'Bite', category: 'action' });
            });
        });
    });

    describe('editing an enemy', () => {
        const enemyDoc = (overrides = {}) => ({
            enemy_name: 'Iron Captain', enemy_type: 'Captain', level: 4, description: 'Loves a speech.',
            base_armor_class: 17, maximum_health: 90, action_points: 4, hardness: 1,
            strength_stat: 3, dexterity_stat: 1, intelligence_stat: 2, charisma_stat: 4,
            base_hit_modifier: 3, base_damage_modifier: 2, base_damage_dice: 2, base_damage_dice_type: 3, base_healing_dice_type: 1,
            Weaknesses: ['Lightning 5'], Resistances: ['Fire 5', 'Non Magical-Physical 4'],
            actions: [validAction({ id: undefined, actionName: 'Rally' })],
            public: false, canRead: ['dm'], canWrite: ['dm', 'co-dm'], admins: ['dm'],
            ...overrides,
        });

        function renderExisting(data = enemyDoc(), user = { uid: 'dm' }) {
            signIn(user);
            mockGetDoc.mockResolvedValue({ exists: () => true, data: () => data });
            renderWithRouter(<EnemyPage />, { route: '/enemies/enemy-1' });
        }

        test('loads the enemy into the form and titles the page with it', async () => {
            renderExisting();
            expect(await screen.findByDisplayValue('Iron Captain')).toBeInTheDocument();
            expect(mockGetDoc).toHaveBeenCalledWith({ __doc: ['enemies', 'enemy-1'] });
            expect(document.title).toBe('Iron Captain');
            expect(screen.getByRole('button', { name: 'Captain' })).toHaveAttribute('aria-pressed', 'true');
            expect(field('Maximum Health')).toHaveValue(90);
            expect(field('Level')).toHaveValue(4);
            expect(field('Notes')).toHaveValue('Loves a speech.');
            expect(field('Weaknesses type 1')).toHaveValue('Lightning');
            expect(field('Weaknesses amount 1')).toHaveValue(5);
            expect(field('Resistances type 2')).toHaveValue('Non Magical-Physical');
            expect(screen.getByText('Rally')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /^Private/ })).toHaveAttribute('aria-pressed', 'true');
        });

        test('a public enemy shows Public', async () => {
            renderExisting(enemyDoc({ public: true }));
            await screen.findByDisplayValue('Iron Captain');
            expect(screen.getByRole('button', { name: /^Public/ })).toHaveAttribute('aria-pressed', 'true');
        });

        test('shows who administers it', async () => {
            renderExisting();
            expect(await screen.findByText('DocAdminManager-stub:["dm"]:dm')).toBeInTheDocument();
        });

        test('Update saves in place, keeping co-writers, and leaves who administers it alone', async () => {
            renderExisting();
            await screen.findByDisplayValue('Iron Captain');
            type('Maximum Health', '120');

            fireEvent.click(save('Update Enemy'));

            await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalled());
            const [target, payload] = mockUpdateDoc.mock.calls[0];
            expect(target).toEqual({ __doc: ['enemies', 'enemy-1'] });
            expect(payload).toMatchObject({ enemy_name: 'Iron Captain', maximum_health: 120, canWrite: ['dm', 'co-dm'], public: false, canRead: ['dm'], Weaknesses: ['Lightning 5'] });
            expect(payload).not.toHaveProperty('admins');
            expect(payload.actions[0]).toMatchObject({ actionName: 'Rally' });
            expect(typeof payload.actions[0].id).toBe('string'); // an action from before ids got one
            await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Enemy updated.'));
        });

        test('someone who cannot write it can read it but change nothing, and cannot delete it', async () => {
            renderExisting(enemyDoc(), { uid: 'stranger' });
            await screen.findByDisplayValue('Iron Captain');

            await waitFor(() => expect(field('Name')).toBeDisabled());
            expect(field('Maximum Health')).toBeDisabled();
            expect(screen.getByRole('button', { name: 'Goon' })).toBeDisabled();
            expect(save('Update Enemy')).toBeDisabled();
            expect(screen.queryByRole('button', { name: 'Delete Enemy' })).not.toBeInTheDocument();
            expect(screen.getByText(/belongs to someone else/)).toBeInTheDocument();
            expect(screen.queryByRole('button', { name: '+ Action' })).not.toBeInTheDocument();
        });

        test('Delete asks first, then removes the enemy and goes back to the bestiary', async () => {
            renderExisting();
            await screen.findByDisplayValue('Iron Captain');

            fireEvent.click(await screen.findByRole('button', { name: 'Delete Enemy' }));

            expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('Iron Captain'));
            await waitFor(() => expect(mockDeleteDoc).toHaveBeenCalledWith({ __doc: ['enemies', 'enemy-1'] }));
            await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/bestiary'));
        });

        test('declining the confirmation deletes nothing, and a failed delete is alerted', async () => {
            window.confirm = jest.fn(() => false);
            renderExisting();
            await screen.findByDisplayValue('Iron Captain');
            fireEvent.click(await screen.findByRole('button', { name: 'Delete Enemy' }));
            expect(mockDeleteDoc).not.toHaveBeenCalled();

            window.confirm = jest.fn(() => true);
            mockDeleteDoc.mockRejectedValue(new Error('denied'));
            fireEvent.click(screen.getByRole('button', { name: 'Delete Enemy' }));
            await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Failed to delete enemy: denied'));
        });

        test('the breadcrumb goes back to the bestiary', async () => {
            renderExisting();
            await screen.findByDisplayValue('Iron Captain');
            fireEvent.click(screen.getByRole('button', { name: /Bestiary/ }));
            expect(mockNavigate).toHaveBeenCalledWith('/bestiary');
        });
    });
});

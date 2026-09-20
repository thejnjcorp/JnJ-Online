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
const mockUpload = jest.fn();
jest.mock('../../src/utils/imgurUploader', () => ({ uploadImageToImgur: (...args) => mockUpload(...args) }));
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
// eslint-disable-next-line import/first
import { newEnemy } from '../../src/utils/enemies';

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

        test('shows the guide\'s benchmark for the chosen tier, and can fill the numbers from it', async () => {
            signIn({ uid: 'dm' });
            renderWithRouter(<EnemyPage />, { route: '/enemies' });
            await screen.findByLabelText('Name');

            fireEvent.click(screen.getByRole('button', { name: 'Veteran' }));
            expect(screen.getByText('Veteran in the guide: HP 20-28 · AC 15-16 · 2-3 actions')).toBeInTheDocument();
            fireEvent.click(screen.getByRole('button', { name: "Use the guide's numbers" }));

            expect(field('Maximum Health')).toHaveValue(24);
            expect(field('Armor Class')).toHaveValue(15);
            expect(field('Action Points')).toHaveValue(2);
        });

        test('a read-only enemy shows the benchmark but cannot be filled from it', async () => {
            mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ ...newEnemy('Elite'), enemy_name: 'Theirs', canWrite: ['someone-else'], admins: ['someone-else'] }) });
            renderWithRouter(<EnemyPage />, { route: '/enemies/e1' });
            await screen.findByDisplayValue('Theirs');
            await waitFor(() => expect(screen.getByLabelText('Name')).toBeDisabled());
            expect(screen.getByText(/Elite in the guide/)).toBeInTheDocument();
            expect(screen.queryByRole('button', { name: "Use the guide's numbers" })).not.toBeInTheDocument();
        });

        test('offers the six tiers, and choosing one selects it', async () => {
            renderNew();
            const tiers = within(await screen.findByRole('group', { name: 'Tier' }));
            expect(tiers.getAllByRole('button').map(button => button.textContent)).toEqual(['Goon', 'Regular', 'Veteran', 'Elite', 'Captain', 'Set Piece']);

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

        describe('the picture', () => {
            const picture = () => document.querySelector('.EnemyPage-picture-token');

            test('with none the token preview shows the enemy\'s initials, following its name', async () => {
                renderNew();
                await screen.findByLabelText('Name');
                type('Name', 'Rust Bandit');
                expect(picture()).toHaveTextContent('RB');
                expect(picture().querySelector('img')).toBeNull();
                expect(field('Picture link')).toHaveValue('');
            });

            test('a link shows as the token\'s picture', async () => {
                renderNew();
                await screen.findByLabelText('Name');
                type('Picture link', 'https://example.com/bandit.png');
                expect(picture().querySelector('img')).toHaveAttribute('src', 'https://example.com/bandit.png');
            });

            test('an Imgur link is saved as just its hash, and the token loads it from Imgur', async () => {
                renderNew();
                await screen.findByLabelText('Name');
                type('Name', 'Rust Bandit');
                type('Picture link', 'https://i.imgur.com/AbC1d2E.png');
                expect(picture().querySelector('img')).toHaveAttribute('src', 'https://i.imgur.com/AbC1d2E.png');

                fireEvent.click(save('Create Enemy'));
                await waitFor(() => expect(mockAddDoc).toHaveBeenCalled());
                expect(mockAddDoc.mock.calls[0][1].portrait_url).toBe('AbC1d2E.png');
            });

            test('an enemy saved without one is saved with an empty picture', async () => {
                renderNew();
                await screen.findByLabelText('Name');
                type('Name', 'Wolf');
                fireEvent.click(save('Create Enemy'));
                await waitFor(() => expect(mockAddDoc).toHaveBeenCalled());
                expect(mockAddDoc.mock.calls[0][1].portrait_url).toBe('');
            });

            test('something that is not a web link is explained, and stops the save', async () => {
                renderNew();
                await screen.findByLabelText('Name');
                type('Name', 'Wolf');
                type('Picture link', 'javascript:alert(1)');
                fireEvent.click(save('Create Enemy'));

                expect(summary()).toHaveTextContent('Picture');
                expect(field('Picture link')).toHaveAttribute('aria-invalid', 'true');
                expect(screen.getAllByText(/web link to a picture/).length).toBeGreaterThan(0);
                expect(mockAddDoc).not.toHaveBeenCalled();
            });

            test('a file can be uploaded, and its link fills in the picture', async () => {
                mockUpload.mockResolvedValue('https://i.imgur.com/UpLoad1.jpg');
                renderNew();
                await screen.findByLabelText('Name');
                const file = new File(['x'], 'bandit.jpg', { type: 'image/jpeg' });

                fireEvent.change(field('Or upload one'), { target: { files: [file] } });

                await waitFor(() => expect(field('Picture link')).toHaveValue('https://i.imgur.com/UpLoad1.jpg'));
                expect(mockUpload).toHaveBeenCalledWith(file);
                expect(picture().querySelector('img')).toHaveAttribute('src', 'https://i.imgur.com/UpLoad1.jpg');
            });

            test('says it is uploading, and cannot be uploaded to again meanwhile', async () => {
                let finish;
                mockUpload.mockReturnValue(new Promise(resolve => { finish = resolve; }));
                renderNew();
                await screen.findByLabelText('Name');
                fireEvent.change(field('Or upload one'), { target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] } });

                expect(await screen.findByRole('status')).toHaveTextContent('Uploading');
                expect(field('Or upload one')).toBeDisabled();
                finish('https://i.imgur.com/UpLoad1.jpg');
                await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
            });

            test('an upload that did not work leaves the picture as it was', async () => {
                mockUpload.mockResolvedValue(null);
                renderNew();
                await screen.findByLabelText('Name');
                type('Picture link', 'https://example.com/keep.png');
                fireEvent.change(field('Or upload one'), { target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] } });
                await waitFor(() => expect(mockUpload).toHaveBeenCalled());
                expect(field('Picture link')).toHaveValue('https://example.com/keep.png');
            });

            test('an upload that throws is alerted', async () => {
                mockUpload.mockRejectedValue(new Error('network down'));
                renderNew();
                await screen.findByLabelText('Name');
                fireEvent.change(field('Or upload one'), { target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] } });
                await waitFor(() => expect(window.alert).toHaveBeenCalledWith("Couldn't upload the picture: network down"));
            });

            test('a picture that will not load says so, and the token goes back to initials', async () => {
                renderNew();
                await screen.findByLabelText('Name');
                type('Name', 'Wolf');
                type('Picture link', 'https://example.com/gone.png');
                fireEvent.error(picture().querySelector('img'));

                expect(screen.getByRole('alert')).toHaveTextContent("didn't load");
                expect(picture()).toHaveTextContent('W');
                expect(picture().querySelector('img')).toBeNull();

                type('Picture link', 'https://example.com/other.png'); // a new link is tried again
                expect(picture().querySelector('img')).not.toBeNull();
            });

            test('it can be taken off', async () => {
                renderNew();
                await screen.findByLabelText('Name');
                expect(screen.queryByRole('button', { name: 'Remove picture' })).not.toBeInTheDocument();
                type('Picture link', 'https://example.com/bandit.png');
                fireEvent.click(screen.getByRole('button', { name: 'Remove picture' }));
                expect(field('Picture link')).toHaveValue('');
                expect(picture().querySelector('img')).toBeNull();
            });
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

        test('loads its picture, shown as the address it loads from', async () => {
            renderExisting(enemyDoc({ portrait_url: 'AbC1d2E.png' }));
            await screen.findByDisplayValue('Iron Captain');
            expect(field('Picture link')).toHaveValue('https://i.imgur.com/AbC1d2E.png');
            expect(document.querySelector('.EnemyPage-picture-token img')).toHaveAttribute('src', 'https://i.imgur.com/AbC1d2E.png');
        });

        test('changing the picture saves it, as the hash', async () => {
            renderExisting(enemyDoc({ portrait_url: 'AbC1d2E.png' }));
            await screen.findByDisplayValue('Iron Captain');
            type('Picture link', 'https://i.imgur.com/NewOne9.png');
            fireEvent.click(save('Update Enemy'));
            await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalled());
            expect(mockUpdateDoc.mock.calls[0][1].portrait_url).toBe('NewOne9.png');
        });

        test('someone else\'s enemy has its picture shown but cannot be given another', async () => {
            renderExisting(enemyDoc({ portrait_url: 'AbC1d2E.png' }), { uid: 'stranger' });
            await screen.findByDisplayValue('Iron Captain');
            expect(field('Picture link')).toBeDisabled();
            expect(screen.queryByLabelText('Or upload one')).not.toBeInTheDocument();
            expect(screen.queryByRole('button', { name: 'Remove picture' })).not.toBeInTheDocument();
        });

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

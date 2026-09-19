jest.mock('../../src/utils/firebase', () => ({ auth: {}, db: {} }));

const mockOnAuthStateChanged = jest.fn();
jest.mock('firebase/auth', () => ({
    onAuthStateChanged: (...args) => mockOnAuthStateChanged(...args),
}));

const mockAddDoc = jest.fn();
const mockCollection = jest.fn();
const mockDoc = jest.fn();
const mockGetDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockOr = jest.fn();
const mockQuery = jest.fn();
const mockWhere = jest.fn();
jest.mock('firebase/firestore', () => ({
    addDoc: (...args) => mockAddDoc(...args),
    collection: (...args) => mockCollection(...args),
    doc: (...args) => mockDoc(...args),
    getDoc: (...args) => mockGetDoc(...args),
    getDocs: (...args) => mockGetDocs(...args),
    or: (...args) => mockOr(...args),
    query: (...args) => mockQuery(...args),
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
import { NewCharacterPage } from '../../src/components/NewCharacterPage';
// eslint-disable-next-line import/first
import { renderWithRouter } from '../testUtils/renderWithRouter';

const adaptable = { actionName: 'Adaptable', toHitBool: false, difficultyClass: 'Cha,0', actionCost: 0, category: 'feat' };

function humanRace(overrides = {}) {
    return { id: 'race-1', name: 'Human', isDefault: true, canWrite: [], actions: [adaptable], ...overrides };
}

function fighterClass(overrides = {}) {
    return {
        id: 'class-1', class_name: 'Fighter', class_type: 'Attrionist', author: 'Admin', isDefault: true,
        description: 'A frontline tank.',
        actions: [{ actionName: 'Stab', toHitBool: true, toHit: 2, actionCost: 1, category: 'action' }],
        base_armor_class: 12, base_hit_modifier: 2, base_damage_modifier: 0,
        base_damage_dice: 1, base_damage_dice_type: 6, base_healing_dice_type: 4,
        base_hardness: 0, base_class_damage_class: 'Dex,0',
        base_melee_damage_dice: 1, base_melee_damage_dice_type: 8, base_melee_damage_modifier: 0, base_melee_damage_type: 'Slashing',
        base_ranged_damage_dice: 1, base_ranged_damage_dice_type: 4, base_ranged_damage_modifier: 0, base_ranged_damage_type: 'Piercing',
        canWrite: [],
        ...overrides,
    };
}

function docsFrom(items) {
    return { docs: items.map(item => ({ id: item.id, data: () => item })) };
}

function signIn(user, { classes = [], races = [humanRace()], playerName = 'Sam', campaign = { canWrite: [], canRead: [] } } = {}) {
    mockOnAuthStateChanged.mockImplementation((_auth, callback) => {
        Promise.resolve().then(() => callback(user));
        return jest.fn();
    });
    mockGetDoc.mockImplementation((target) => {
        if (target?.__doc?.[0] === 'players') return Promise.resolve({ data: () => ({ name: playerName }) });
        if (target?.__doc?.[0] === 'campaigns') return Promise.resolve({ data: () => campaign });
        return Promise.resolve({ data: () => ({}) });
    });
    mockGetDocs.mockImplementation((q) => {
        if (q?.__collection === 'races') return Promise.resolve(docsFrom(races));
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
    mockGetDocs.mockImplementation(() => Promise.resolve(docsFrom([])));
    mockGetDoc.mockResolvedValue({ data: () => ({}) });
    mockAddDoc.mockResolvedValue({ id: 'new-char-id' });
    window.alert = jest.fn();
});

afterEach(() => {
    delete window.alert;
});

async function renderAt(route, options) {
    signIn({ uid: 'user-1' }, options);
    renderWithRouter(<NewCharacterPage />, { route });
    await screen.findByText(/Human/); // race options loaded
}

describe('NewCharacterPage', () => {
    test('sets the document title', async () => {
        await renderAt('/campaigns/camp-1/newCharacter');
        expect(document.title).toBe('New Character');
    });

    describe('race list scoping', () => {
        test('asks only for races this viewer can read, not the whole collection', async () => {
            await renderAt('/campaigns/camp-1/newCharacter');

            const racesQuery = mockQuery.mock.results.map(r => r.value).find(q => q.__collection === 'races');
            expect(racesQuery.args[0].__or).toEqual([
                { __where: ['public', '==', true] },
                { __where: ['canRead', 'array-contains', 'user-1'] },
                { __where: ['canWrite', 'array-contains', 'user-1'] },
            ]);
        });

        test('excludes a pool race the campaign has not subscribed to', async () => {
            const pool = humanRace({ id: 'race-2', name: 'Elf', isDefault: false, public: true });
            await renderAt('/campaigns/camp-1/newCharacter', { races: [humanRace(), pool] });
            expect(screen.queryByRole('option', { name: 'Elf' })).not.toBeInTheDocument();
        });

        test('includes a pool race the campaign has subscribed to', async () => {
            const pool = humanRace({ id: 'race-2', name: 'Elf', isDefault: false, public: true });
            await renderAt('/campaigns/camp-1/newCharacter', { races: [humanRace(), pool], campaign: { canWrite: [], canRead: [], subscribedRaceIds: ['race-2'] } });
            expect(screen.getByRole('option', { name: 'Elf' })).toBeInTheDocument();
        });

        test('includes a race the viewer authored', async () => {
            const mine = humanRace({ id: 'race-3', name: 'Homebrew', isDefault: false, canWrite: ['user-1'] });
            await renderAt('/campaigns/camp-1/newCharacter', { races: [humanRace(), mine] });
            expect(screen.getByRole('option', { name: 'Homebrew' })).toBeInTheDocument();
        });
    });

    test('shows the player name and uid once signed in', async () => {
        await renderAt('/campaigns/camp-1/newCharacter', { playerName: 'Sam' });
        expect(await screen.findByText(/Player: Sam/)).toBeInTheDocument();
        expect(screen.getByText(/UID: user-1/)).toBeInTheDocument();
    });

    describe('class list scoping', () => {
        test('includes an admin default class', async () => {
            await renderAt('/campaigns/camp-1/newCharacter', { classes: [fighterClass()] });
            expect(screen.getByRole('option', { name: 'Fighter' })).toBeInTheDocument();
        });

        test('excludes a non-default class the viewer neither wrote nor the campaign subscribed to', async () => {
            const unrelated = fighterClass({ id: 'class-2', class_name: 'Rogue', isDefault: false, canWrite: [] });
            await renderAt('/campaigns/camp-1/newCharacter', { classes: [unrelated] });
            expect(screen.queryByRole('option', { name: 'Rogue' })).not.toBeInTheDocument();
        });

        test('includes a non-default class the viewer authored', async () => {
            const authored = fighterClass({ id: 'class-2', class_name: 'Rogue', isDefault: false, canWrite: ['user-1'] });
            await renderAt('/campaigns/camp-1/newCharacter', { classes: [authored] });
            expect(screen.getByRole('option', { name: 'Rogue' })).toBeInTheDocument();
        });

        test('includes a non-default class the campaign has subscribed to', async () => {
            const subscribed = fighterClass({ id: 'class-2', class_name: 'Rogue', isDefault: false, canWrite: [] });
            await renderAt('/campaigns/camp-1/newCharacter', {
                classes: [subscribed],
                campaign: { canWrite: [], canRead: [], subscribedClassIds: ['class-2'] },
            });
            expect(screen.getByRole('option', { name: 'Rogue' })).toBeInTheDocument();
        });
    });

    describe('View Class Info', () => {
        test('the button only appears once a class is selected', async () => {
            await renderAt('/campaigns/camp-1/newCharacter', { classes: [fighterClass()] });
            expect(screen.queryByRole('button', { name: 'View Class Info' })).not.toBeInTheDocument();

            fireEvent.change(screen.getAllByRole('combobox')[1], { target: { name: 'class_id', value: 'class-1' } });

            expect(screen.getByRole('button', { name: 'View Class Info' })).toBeInTheDocument();
        });

        test('the class description renders as Markdown', async () => {
            await renderAt('/campaigns/camp-1/newCharacter', { classes: [fighterClass({ description: 'A **frontline** tank.' })] });
            fireEvent.change(screen.getAllByRole('combobox')[1], { target: { name: 'class_id', value: 'class-1' } });

            fireEvent.click(screen.getByRole('button', { name: 'View Class Info' }));

            expect(screen.getByText('frontline').tagName).toBe('STRONG');
        });

        test('clicking it shows the class details and its action list', async () => {
            await renderAt('/campaigns/camp-1/newCharacter', { classes: [fighterClass()] });
            fireEvent.change(screen.getAllByRole('combobox')[1], { target: { name: 'class_id', value: 'class-1' } });

            fireEvent.click(screen.getByRole('button', { name: 'View Class Info' }));

            expect(screen.getByText(/Attrionist/)).toBeInTheDocument();
            expect(screen.getByText(/Author: Admin/)).toBeInTheDocument();
            expect(screen.getByText('A frontline tank.')).toBeInTheDocument();
            expect(screen.getByText('Stab')).toBeInTheDocument(); // from the class actions CombatActionList
        });

        test('a race with several actions lists every one of them; a legacy single-feat race still shows its feat', async () => {
            const twoActions = humanRace({ id: 'race-2', name: 'Kobold', actions: [{ ...adaptable, actionName: 'Pack Tactics' }, { ...adaptable, actionName: 'Sunlight Sensitivity' }] });
            const legacy = humanRace({ id: 'race-3', name: 'Ancient', actions: undefined, feat: { ...adaptable, actionName: 'Old Feat' } });
            await renderAt('/campaigns/camp-1/newCharacter', { classes: [fighterClass()], races: [humanRace(), twoActions, legacy] });
            const [raceSelect, classSelect] = screen.getAllByRole('combobox');
            fireEvent.change(classSelect, { target: { name: 'class_id', value: 'class-1' } });

            fireEvent.change(raceSelect, { target: { name: 'race_id', value: 'race-2' } });
            fireEvent.click(screen.getByRole('button', { name: 'View Class Info' }));
            expect(screen.getByText('Pack Tactics')).toBeInTheDocument();
            expect(screen.getByText('Sunlight Sensitivity')).toBeInTheDocument();

            fireEvent.change(raceSelect, { target: { name: 'race_id', value: 'race-3' } });
            expect(screen.getByText('Old Feat')).toBeInTheDocument();
        });

        test('a race with no actions shows no race action list and does not break the preview', async () => {
            await renderAt('/campaigns/camp-1/newCharacter', { classes: [fighterClass()], races: [humanRace({ actions: [] })] });
            const [raceSelect, classSelect] = screen.getAllByRole('combobox');
            fireEvent.change(raceSelect, { target: { name: 'race_id', value: 'race-1' } });
            fireEvent.change(classSelect, { target: { name: 'class_id', value: 'class-1' } });

            fireEvent.click(screen.getByRole('button', { name: 'View Class Info' }));

            expect(screen.getByText('Stab')).toBeInTheDocument();
        });

        test('selecting a race and a class, then viewing class info, also shows the race\'s feat action list', async () => {
            await renderAt('/campaigns/camp-1/newCharacter', { classes: [fighterClass()] });
            const [raceSelect, classSelect] = screen.getAllByRole('combobox');
            fireEvent.change(raceSelect, { target: { name: 'race_id', value: 'race-1' } });
            fireEvent.change(classSelect, { target: { name: 'class_id', value: 'class-1' } });

            fireEvent.click(screen.getByRole('button', { name: 'View Class Info' }));

            expect(screen.getByText('Adaptable')).toBeInTheDocument();
        });
    });

    describe('Create Character', () => {
        test('a field explicitly left blank (its dropdown reset to the empty option) alerts and does not submit', async () => {
            // handleSubmit's validation only catches a field the reducer has
            // actually recorded as "" - a field that was simply never
            // touched stays undefined, which doesn't equal "" and slips
            // past this check entirely (falling through to the
            // "invalid class found!" branch instead, covered below). So
            // this test exercises the guard the way it's actually reachable:
            // explicitly firing a change back to the hidden blank option.
            await renderAt('/campaigns/camp-1/newCharacter', { classes: [fighterClass()] });
            const [raceSelect] = screen.getAllByRole('combobox');

            fireEvent.change(raceSelect, { target: { name: 'race_id', value: '' } });
            fireEvent.click(screen.getByRole('button', { name: 'Create Character' }));

            expect(window.alert).toHaveBeenCalledWith('invalid form values');
            expect(mockAddDoc).not.toHaveBeenCalled();
        });

        test('an untouched (never-selected) class falls through validation to "invalid class found!"', async () => {
            await renderAt('/campaigns/camp-1/newCharacter', { classes: [fighterClass()] });

            fireEvent.click(screen.getByRole('button', { name: 'Create Character' }));

            expect(window.alert).toHaveBeenCalledWith('invalid class found!');
            expect(mockAddDoc).not.toHaveBeenCalled();
        });

        async function fillRequiredFields() {
            const [raceSelect, classSelect] = screen.getAllByRole('combobox');
            fireEvent.change(raceSelect, { target: { name: 'race_id', value: 'race-1' } });
            fireEvent.change(classSelect, { target: { name: 'class_id', value: 'class-1' } });
            // Ability inputs appear in order: strength, dexterity, intelligence, charisma.
            const [strength, dexterity, intelligence, charisma] = screen.getAllByRole('spinbutton');
            fireEvent.change(strength, { target: { name: 'strength_stat_allocated', type: 'number', value: '4' } });
            fireEvent.change(dexterity, { target: { name: 'dexterity_stat_allocated', type: 'number', value: '3' } });
            fireEvent.change(intelligence, { target: { name: 'intelligence_stat_allocated', type: 'number', value: '2' } });
            fireEvent.change(charisma, { target: { name: 'charisma_stat_allocated', type: 'number', value: '1' } });
        }

        test('a fully filled-out form creates the character and navigates to it', async () => {
            await renderAt('/campaigns/camp-1/newCharacter', { classes: [fighterClass()], playerName: 'Sam', campaign: { canWrite: ['director-1'], canRead: ['director-1', 'user-1'] } });
            await fillRequiredFields();

            fireEvent.click(screen.getByRole('button', { name: 'Create Character' }));

            await waitFor(() => expect(mockAddDoc).toHaveBeenCalled());
            const [, payload] = mockAddDoc.mock.calls[0];
            expect(payload.class_name).toBe('Fighter');
            expect(payload.race_name).toBe('Human');
            expect(payload.player_name).toBe('Sam');
            expect(payload.playerId).toBe('user-1');
            expect(payload.campaign).toBe('camp-1');
            expect(payload.canWrite).toEqual(['user-1', 'director-1']);
            expect(payload.admins).toEqual(['user-1']); // firestore.rules requires the creator to be a doc admin to create at all
            expect(payload.strength_stat).toBe(4);
            expect(payload.dexterity_stat).toBe(3);
            expect(payload.intelligence_stat).toBe(2);
            expect(payload.charisma_stat).toBe(1);
            expect(payload.skills_and_flaws).toEqual([]);
            expect(mockNavigate).toHaveBeenCalledWith('/characters/new-char-id');
        });

        test('pins the character to the race version and saves its actions in race_actions', async () => {
            await renderAt('/campaigns/camp-1/newCharacter', { classes: [fighterClass()], races: [humanRace({ version: 3 })] });
            await fillRequiredFields();

            fireEvent.click(screen.getByRole('button', { name: 'Create Character' }));

            await waitFor(() => expect(mockAddDoc).toHaveBeenCalled());
            const [, payload] = mockAddDoc.mock.calls[0];
            expect(payload.race_id).toBe('race-1');
            expect(payload.race_version).toBe(3);
            expect(payload.race_name).toBe('Human');
            expect(payload.race_actions).toEqual([adaptable]);
            expect(payload).not.toHaveProperty('race_feat');
        });

        test('a race that has never been versioned pins to version 1, and a legacy single-feat race saves its feat as an action', async () => {
            const legacy = humanRace({ actions: undefined, feat: adaptable });
            await renderAt('/campaigns/camp-1/newCharacter', { classes: [fighterClass()], races: [legacy] });
            await fillRequiredFields();

            fireEvent.click(screen.getByRole('button', { name: 'Create Character' }));

            await waitFor(() => expect(mockAddDoc).toHaveBeenCalled());
            const [, payload] = mockAddDoc.mock.calls[0];
            expect(payload.race_version).toBe(1);
            expect(payload.race_actions).toEqual([adaptable]);
        });

        test('pins the character to the class version it was built from, and keeps the race actions out of the class actions', async () => {
            await renderAt('/campaigns/camp-1/newCharacter', { classes: [fighterClass({ version: 4, versionNotes: 'Rebalanced', publishedAt: 'ts', public: true, visibility: 'public' })], campaign: { canWrite: [], canRead: [] } });
            await fillRequiredFields();

            fireEvent.click(screen.getByRole('button', { name: 'Create Character' }));

            await waitFor(() => expect(mockAddDoc).toHaveBeenCalled());
            const [, payload] = mockAddDoc.mock.calls[0];
            expect(payload.class_id).toBe('class-1');
            expect(payload.class_version).toBe(4);
            // saved copy = the class's own actions only; racial ones live in race_actions
            expect(payload.actions).toEqual(fighterClass().actions);
            expect(payload.class_description).toBe('A frontline tank.');
            // class-level bookkeeping stays on the class
            ['id', 'public', 'isDefault', 'visibility', 'version', 'versionNotes', 'publishedAt', 'description'].forEach(field => {
                expect(payload).not.toHaveProperty(field);
            });
        });

        test('a class that has never been versioned pins the character to version 1', async () => {
            await renderAt('/campaigns/camp-1/newCharacter', { classes: [fighterClass()], campaign: { canWrite: [], canRead: [] } });
            await fillRequiredFields();

            fireEvent.click(screen.getByRole('button', { name: 'Create Character' }));

            await waitFor(() => expect(mockAddDoc).toHaveBeenCalled());
            expect(mockAddDoc.mock.calls[0][1].class_version).toBe(1);
        });
    });
});

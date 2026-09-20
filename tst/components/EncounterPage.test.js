const mockAuth = { currentUser: { uid: 'dm' } };
jest.mock('../../src/utils/firebase', () => ({ get auth() { return mockAuth; }, db: {} }));

const mockUpdateDoc = jest.fn();
const mockAddDoc = jest.fn();
const mockListeners = {};
jest.mock('../../src/utils/useTagCatalog', () => ({ useTagCatalog: () => ({ tags: [], status: 'ready' }) }));
jest.mock('firebase/firestore', () => ({
    addDoc: (...args) => mockAddDoc(...args),
    collection: (_db, name) => ({ __collection: name }),
    doc: (_db, ...path) => ({ __doc: path.join('/') }),
    onSnapshot: (ref, next, error) => { mockListeners[ref.__doc] = { next, error }; return jest.fn(); },
    serverTimestamp: () => 'now',
    updateDoc: (...args) => mockUpdateDoc(...args),
}));

// The party doc holds the combat tracker; its changes are worked out against this.
let mockParty = {};
const mockUpdateCombatTracker = jest.fn();
jest.mock('../../src/utils/useParty', () => ({ useParty: () => ({ party: mockParty, loaded: true }) }));
jest.mock('../../src/utils/party', () => ({
    ...jest.requireActual('../../src/utils/party'),
    updateCombatTracker: (...args) => mockUpdateCombatTracker(...args),
}));
let mockBestiary;
jest.mock('../../src/utils/useBestiary', () => ({ useBestiary: () => mockBestiary }));
let mockMaps;
jest.mock('../../src/utils/useCampaignCombat', () => ({ useCampaignMaps: () => mockMaps }));
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({ ...jest.requireActual('react-router-dom'), useNavigate: () => mockNavigate }));

// eslint-disable-next-line import/first
import { screen, fireEvent, waitFor, within, act } from '@testing-library/react';
// eslint-disable-next-line import/first
import { EncounterPage } from '../../src/components/EncounterPage';
// eslint-disable-next-line import/first
import { renderWithRouter } from '../testUtils/renderWithRouter';
// eslint-disable-next-line import/first
import { newEnemy, rosterEntry } from '../../src/utils/enemies';

const ENCOUNTER = 'campaigns/camp-1/encounters/enc-1';
const CAMPAIGN = 'campaigns/camp-1';

const bandit = { id: 'b1', ...newEnemy('Goon'), enemy_name: 'Rust Bandit', maximum_health: 10, level: 1 };
const captain = { id: 'b2', ...newEnemy('Captain'), enemy_name: 'Iron Captain', maximum_health: 80, level: 4 };

const snap = data => ({ exists: () => data !== null, data: () => data });

function renderPage({ encounter, campaign = { enemy_list: [] }, zones = ['Zone A', 'Zone B'], enemies = [bandit, captain] } = {}) {
    mockBestiary = { enemies, status: 'ready' };
    mockMaps = { activeMap: zones ? { zones: zones.map(name => ({ name })) } : undefined };
    renderWithRouter(<EncounterPage />, { route: '/campaigns/camp-1/encounters/enc-1' });
    act(() => {
        mockListeners[ENCOUNTER].next(snap(encounter));
        mockListeners[CAMPAIGN].next(snap(campaign));
    });
}

const twoBandits = () => ({ ...rosterEntry(bandit), count: 2 });

beforeEach(() => {
    Object.keys(mockListeners).forEach(key => delete mockListeners[key]);
    mockUpdateDoc.mockResolvedValue(undefined);
    mockAddDoc.mockResolvedValue({ id: 'new-enemy' });
    mockParty = {};
    mockUpdateCombatTracker.mockReset();
    mockUpdateCombatTracker.mockResolvedValue(undefined);
    mockAuth.currentUser = { uid: 'dm' };
    window.alert = jest.fn();
    window.confirm = jest.fn(() => true);
    window.HTMLElement.prototype.scrollIntoView = jest.fn();
});

afterEach(() => {
    delete window.alert;
    delete window.confirm;
});

// the header's button (a second Save appears in the unsaved-changes bar)
const save = () => screen.getAllByRole('button', { name: /^(Save|Saved)$/ })[0];
const pick = name => fireEvent.click([...document.querySelectorAll('.EncounterPage-picker-option')].find(option => option.textContent.includes(name)));

describe('EncounterPage', () => {
    describe('loading', () => {
        test('shows loading until the encounter arrives, then its name, notes and roster', () => {
            mockBestiary = { enemies: [], status: 'ready' };
            mockMaps = { activeMap: undefined };
            renderWithRouter(<EncounterPage />, { route: '/campaigns/camp-1/encounters/enc-1' });
            expect(screen.getByText('Loading…')).toBeInTheDocument();
            act(() => mockListeners[ENCOUNTER].next(snap({ name: 'Ambush', notes: 'Set-up', roster: [twoBandits()] })));

            expect(screen.getByLabelText('Encounter name')).toHaveValue('Ambush');
            expect(screen.getByLabelText('Encounter notes')).toHaveValue('Set-up');
            expect(screen.getByLabelText('Name of Rust Bandit')).toBeInTheDocument();
            expect(document.title).toBe('Ambush');
        });

        test('listens to this campaign\'s encounter and to the campaign itself', () => {
            renderPage({ encounter: { name: 'x', roster: [] } });
            expect(Object.keys(mockListeners).sort()).toEqual([CAMPAIGN, ENCOUNTER]);
        });

        test('an encounter that is not there, or cannot be read, says so', () => {
            mockBestiary = { enemies: [], status: 'ready' };
            mockMaps = { activeMap: undefined };
            renderWithRouter(<EncounterPage />, { route: '/campaigns/camp-1/encounters/enc-1' });
            jest.spyOn(console, 'log').mockImplementation(() => {});
            act(() => mockListeners[ENCOUNTER].error(new Error('permission-denied')));
            expect(screen.getByRole('alert')).toHaveTextContent(/Only the campaign's directors/);
        });

        test('the breadcrumb goes back to the list', () => {
            renderPage({ encounter: { name: 'x', roster: [] } });
            fireEvent.click(screen.getByRole('button', { name: /Encounters/ }));
            expect(mockNavigate).toHaveBeenCalledWith('/campaigns/camp-1/encounters');
        });
    });

    describe('the roster', () => {
        test('an empty encounter invites you to add enemies, and cannot be staged', () => {
            renderPage({ encounter: { name: 'Ambush', roster: [] } });
            expect(screen.getByText(/No enemies yet\. Add some/)).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Stage encounter' })).toBeDisabled();
        });

        test('+ Add enemy opens the bestiary, and picking one adds a copy of it to the roster', () => {
            renderPage({ encounter: { name: 'Ambush', roster: [] } });
            fireEvent.click(screen.getByRole('button', { name: '+ Add enemy' }));

            pick('Iron Captain');

            expect(screen.getByLabelText('Name of Iron Captain')).toBeInTheDocument();
            expect(screen.getByLabelText('HP of Iron Captain')).toHaveValue(80);
            expect(screen.getByLabelText('Number of Iron Captain')).toHaveTextContent('1');
        });

        test('the same enemy can be added again, as its own entry', () => {
            renderPage({ encounter: { name: 'Ambush', roster: [] } });
            fireEvent.click(screen.getByRole('button', { name: '+ Add enemy' }));
            pick('Rust Bandit');
            pick('Rust Bandit');
            expect(screen.getAllByLabelText('Name of Rust Bandit')).toHaveLength(2);
        });

        test('the count goes up and down, and never below one', () => {
            renderPage({ encounter: { name: 'Ambush', roster: [{ ...rosterEntry(bandit), count: 1 }] } });
            expect(screen.getByRole('button', { name: 'Fewer Rust Bandit' })).toBeDisabled();

            fireEvent.click(screen.getByRole('button', { name: 'More Rust Bandit' }));
            fireEvent.click(screen.getByRole('button', { name: 'More Rust Bandit' }));
            expect(screen.getByLabelText('Number of Rust Bandit')).toHaveTextContent('3');

            fireEvent.click(screen.getByRole('button', { name: 'Fewer Rust Bandit' }));
            expect(screen.getByLabelText('Number of Rust Bandit')).toHaveTextContent('2');
        });

        test('name, tier, level, HP, AC and AP are edited on the entry, which does not change the bestiary', () => {
            renderPage({ encounter: { name: 'Ambush', roster: [twoBandits()] } });

            fireEvent.change(screen.getByLabelText('Name of Rust Bandit'), { target: { value: 'Wounded Bandit' } });
            fireEvent.change(screen.getByLabelText('Tier of Wounded Bandit'), { target: { value: 'Veteran' } });
            fireEvent.change(screen.getByLabelText('HP of Wounded Bandit'), { target: { value: '25' } });
            fireEvent.change(screen.getByLabelText('AC of Wounded Bandit'), { target: { value: '15' } });
            fireEvent.change(screen.getByLabelText('Level of Wounded Bandit'), { target: { value: '3' } });
            fireEvent.change(screen.getByLabelText('AP of Wounded Bandit'), { target: { value: '4' } });

            expect(screen.getByLabelText('Tier of Wounded Bandit')).toHaveValue('Veteran');
            expect(screen.getByLabelText('HP of Wounded Bandit')).toHaveValue(25);
            expect(bandit.maximum_health).toBe(10);
        });

        test('an entry can be removed', () => {
            renderPage({ encounter: { name: 'Ambush', roster: [twoBandits(), rosterEntry(captain)] } });
            fireEvent.click(screen.getByRole('button', { name: 'Remove Rust Bandit' }));
            expect(screen.queryByLabelText('Name of Rust Bandit')).not.toBeInTheDocument();
            expect(screen.getByLabelText('Name of Iron Captain')).toBeInTheDocument();
        });

        test('with a map, each entry can start in a zone (the first by default)', () => {
            renderPage({ encounter: { name: 'Ambush', roster: [twoBandits()] } });
            const zone = screen.getByLabelText('Starting zone of Rust Bandit');
            expect(within(zone).getAllByRole('option').map(option => option.textContent)).toEqual(['Zone A (first zone)', 'Zone B']);
            expect(zone).toHaveValue('');

            fireEvent.change(zone, { target: { value: 'Zone B' } });
            expect(zone).toHaveValue('Zone B');
        });

        test('with no active map there is no zone to choose, and it says what will happen', () => {
            renderPage({ encounter: { name: 'Ambush', roster: [twoBandits()] }, zones: null });
            expect(screen.queryByLabelText('Starting zone of Rust Bandit')).not.toBeInTheDocument();
            expect(screen.getByText(/no active map/)).toBeInTheDocument();
        });
    });

    describe('the summary', () => {
        test('totals the fight by tier, enemies, HP and highest level, and follows edits', () => {
            renderPage({ encounter: { name: 'Ambush', roster: [twoBandits(), rosterEntry(captain)] } });
            const summary = within(screen.getByLabelText('Summary'));

            expect(summary.getByText('2 Goons, 1 Captain')).toBeInTheDocument();
            expect(summary.getByText('3 enemies')).toBeInTheDocument();
            expect(summary.getByText('100 HP in total')).toBeInTheDocument(); // 2 x 10 + 80
            expect(summary.getByText('Highest level 4')).toBeInTheDocument();

            fireEvent.click(screen.getByRole('button', { name: 'More Rust Bandit' }));
            expect(summary.getByText('3 Goons, 1 Captain')).toBeInTheDocument();
            expect(summary.getByText('110 HP in total')).toBeInTheDocument();
        });

        test('says so when there is nothing yet', () => {
            renderPage({ encounter: { name: 'Ambush', roster: [] } });
            expect(within(screen.getByLabelText('Summary')).getByText('No enemies yet')).toBeInTheDocument();
        });
    });

    describe('the balance guide', () => {
        const regular = { id: 'b3', ...newEnemy('Regular'), enemy_name: 'Cutthroat', maximum_health: 25, base_armor_class: 14, action_points: 3 };
        const strongRoster = () => [{ ...rosterEntry(regular), count: 2 }, rosterEntry(captain)];

        test('a balance check sits above the roster, and the guide cheat sheet below it, closed', () => {
            renderPage({ encounter: { name: 'Ambush', roster: [twoBandits()] } });
            const check = screen.getByLabelText('Balance check');
            const guide = screen.getByRole('button', { name: /Balance guide/ });
            expect(guide).toHaveAttribute('aria-expanded', 'false');
            expect(check.compareDocumentPosition(screen.getByText('+ Add enemy')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
            expect(screen.getByText('+ Add enemy').compareDocumentPosition(guide) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        });

        test('the balance check totals the roster and follows edits', () => {
            renderPage({ encounter: { name: 'Ambush', roster: [twoBandits()] } });
            const check = screen.getByLabelText('Balance check');
            expect(within(check).getByText('Enemy HP').parentElement).toHaveTextContent('20'); // 2 x 10

            fireEvent.change(screen.getByLabelText('HP of Rust Bandit'), { target: { value: '30' } });

            expect(within(check).getByText('Enemy HP').parentElement).toHaveTextContent('60');
        });

        test('each enemy row shows its role\'s benchmark from the guide', () => {
            renderPage({ encounter: { name: 'Ambush', roster: [rosterEntry({ ...bandit, maximum_health: 3, base_armor_class: 13, action_points: 1 })] } });
            expect(screen.getByLabelText('Guide benchmark for Rust Bandit')).toHaveTextContent('Goon in the guide: HP 1-5 · AC 13-14 · 1-2 actions');
        });

        test('and flags the numbers outside it', () => {
            renderPage({ encounter: { name: 'Ambush', roster: [{ ...rosterEntry(regular) }] } });
            const line = screen.getByLabelText('Guide benchmark for Cutthroat');
            expect(line).toHaveTextContent('HP 25 is above 12-18');
            expect(line).toHaveTextContent('Actions 3 is above 2');
            expect(line).not.toHaveTextContent('AC 14 is');
        });

        test('a flag goes away when the number is put right', () => {
            renderPage({ encounter: { name: 'Ambush', roster: [rosterEntry(regular)] } });
            fireEvent.change(screen.getByLabelText('HP of Cutthroat'), { target: { value: '15' } });
            expect(screen.getByLabelText('Guide benchmark for Cutthroat')).not.toHaveTextContent('HP 15 is');
            expect(screen.getByLabelText('Guide benchmark for Cutthroat')).toHaveTextContent('Actions 3 is above 2');
        });

        test('an enemy with no tier has no benchmark line', () => {
            renderPage({ encounter: { name: 'Ambush', roster: [rosterEntry({ ...bandit, enemy_type: '' })] } });
            expect(screen.queryByLabelText(/Guide benchmark for/)).not.toBeInTheDocument();
        });

        test('the target and objective are loaded with the encounter', () => {
            renderPage({ encounter: { name: 'Ambush', roster: strongRoster(), target: 'hard', objective: 'moderate' } });
            expect(screen.getByRole('button', { name: 'Hard' })).toHaveAttribute('aria-pressed', 'true');
            expect(screen.getByLabelText('Secondary objective')).toHaveValue('moderate');
        });

        test('an older encounter with neither starts with none chosen', () => {
            renderPage({ encounter: { name: 'Ambush', roster: strongRoster() } });
            expect(screen.getByRole('button', { name: 'Hard' })).toHaveAttribute('aria-pressed', 'false');
            expect(screen.getByLabelText('Secondary objective')).toHaveValue('');
        });

        test('choosing them is an unsaved change, and Save writes them with the encounter', async () => {
            renderPage({ encounter: { name: 'Ambush', roster: strongRoster() } });
            expect(save()).toHaveTextContent('Saved');

            fireEvent.click(screen.getByRole('button', { name: 'Standard' }));
            fireEvent.change(screen.getByLabelText('Secondary objective'), { target: { value: 'heavy' } });
            expect(save()).toHaveTextContent('Save');
            fireEvent.click(save());

            await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalled());
            expect(mockUpdateDoc.mock.calls[0][1]).toMatchObject({ target: 'standard', objective: 'heavy' });
        });

        test('the map\'s zones are compared with the target', () => {
            renderPage({ encounter: { name: 'Ambush', roster: strongRoster(), target: 'standard' }, zones: ['A', 'B', 'C', 'D', 'E'] });
            expect(within(screen.getByLabelText('Balance check')).getByText('Zones on the map').parentElement).toHaveTextContent('1 over');
        });

        test('with no map there is no zones line', () => {
            renderPage({ encounter: { name: 'Ambush', roster: strongRoster(), target: 'standard' }, zones: null });
            expect(screen.queryByText('Zones on the map')).not.toBeInTheDocument();
        });

        test('the cheat sheet opens to the guide\'s tables', () => {
            renderPage({ encounter: { name: 'Ambush', roster: [] } });
            fireEvent.click(screen.getByRole('button', { name: /Balance guide/ }));
            expect(screen.getByText('1. Quick Enemy Benchmark Bank')).toBeInTheDocument();
        });
    });

    describe('creating an enemy for the encounter', () => {
        const open = () => fireEvent.click(screen.getByRole('button', { name: '+ Create enemy' }));
        const panel = () => screen.getByRole('group', { name: 'New enemy' });
        const name = value => fireEvent.change(screen.getByLabelText('Name of the new enemy'), { target: { value } });
        const field = label => within(panel()).getByLabelText(label);
        const rosterNames = () => screen.queryAllByLabelText(/^Name of (?!the new enemy)/).map(input => input.value);

        test('+ Create enemy opens a form for a new enemy, which starts as a Regular with the guide\'s numbers for one', () => {
            renderPage({ encounter: { name: 'Ambush', roster: [] } });
            expect(screen.queryByRole('group', { name: 'New enemy' })).not.toBeInTheDocument();

            open();

            expect(panel()).toBeInTheDocument();
            expect(within(panel()).getByRole('button', { name: 'Regular' })).toHaveAttribute('aria-pressed', 'true');
            expect(field('Maximum Health')).toHaveValue(15);
            expect(field('Armor Class')).toHaveValue(14);
            expect(field('Action Points')).toHaveValue(2);
            expect(within(panel()).getByText('Regular in the guide: HP 12-18 · AC 14-15 · 2 actions')).toBeInTheDocument();
        });

        test('it is the full stat block: stats, weaknesses, actions and notes', () => {
            renderPage({ encounter: { name: 'Ambush', roster: [] } });
            open();
            ['Level', 'Hit Modifier', 'Damage Dice', 'Hardness'].forEach(label => expect(field(label)).toBeInTheDocument());
            expect(within(panel()).getByText('Weaknesses & Resistances')).toBeInTheDocument();
            expect(within(panel()).getByRole('button', { name: '+ Action' })).toBeInTheDocument();
        });

        test('choosing another tier shows its benchmark, and "Use the guide\'s numbers" fills them in', () => {
            renderPage({ encounter: { name: 'Ambush', roster: [] } });
            open();

            fireEvent.click(within(panel()).getByRole('button', { name: 'Elite' }));
            expect(within(panel()).getByText('Elite in the guide: HP 30-45 · AC 16 · 2-3 actions')).toBeInTheDocument();
            expect(field('Maximum Health')).toHaveValue(15); // not changed by choosing the tier

            fireEvent.click(within(panel()).getByRole('button', { name: "Use the guide's numbers" }));

            expect(field('Maximum Health')).toHaveValue(38);
            expect(field('Armor Class')).toHaveValue(16);
            expect(field('Action Points')).toHaveValue(2);
        });

        test('a Captain\'s benchmark says the guide has no HP or AC for it, and only fills the actions', () => {
            renderPage({ encounter: { name: 'Ambush', roster: [] } });
            open();
            fireEvent.click(within(panel()).getByRole('button', { name: 'Captain' }));
            expect(within(panel()).getByText(/Captain in the guide: 3 actions \(the guide gives no HP or AC/)).toBeInTheDocument();

            fireEvent.click(within(panel()).getByRole('button', { name: "Use the guide's numbers" }));

            expect(field('Action Points')).toHaveValue(3);
            expect(field('Maximum Health')).toHaveValue(15);
        });

        test('Set Piece is a tier, with the guide\'s Boss numbers', () => {
            renderPage({ encounter: { name: 'Ambush', roster: [] } });
            open();
            fireEvent.click(within(panel()).getByRole('button', { name: 'Set Piece' }));
            expect(within(panel()).getByText('Boss in the guide: HP 45-70 · AC 16-17 · 3 actions')).toBeInTheDocument();
        });

        test('adding puts the enemy in the roster as a copy with what was entered, and closes the form', () => {
            renderPage({ encounter: { name: 'Ambush', roster: [] } });
            open();
            name('  Ash Warden ');
            fireEvent.change(field('Maximum Health'), { target: { value: '22' } });
            fireEvent.click(within(panel()).getByRole('button', { name: 'Veteran' }));

            fireEvent.click(within(panel()).getByRole('button', { name: 'Add to encounter' }));

            expect(screen.queryByRole('group', { name: 'New enemy' })).not.toBeInTheDocument();
            expect(screen.getByLabelText('Name of Ash Warden')).toHaveValue('Ash Warden');
            expect(screen.getByLabelText('Tier of Ash Warden')).toHaveValue('Veteran');
            expect(screen.getByLabelText('HP of Ash Warden')).toHaveValue(22);
            expect(screen.getByLabelText('AC of Ash Warden')).toHaveValue(14);
            expect(screen.getByLabelText('Number of Ash Warden')).toHaveTextContent('1');
            expect(mockAddDoc).not.toHaveBeenCalled(); // only in this encounter
        });

        test('the new roster row is checked against the guide like any other', () => {
            renderPage({ encounter: { name: 'Ambush', roster: [] } });
            open();
            name('Big Bandit');
            fireEvent.change(field('Maximum Health'), { target: { value: '40' } });
            fireEvent.click(within(panel()).getByRole('button', { name: 'Add to encounter' }));
            expect(screen.getByLabelText('Guide benchmark for Big Bandit')).toHaveTextContent('HP 40 is above 12-18');
        });

        test('adding is an unsaved change to the encounter, saved with its roster', async () => {
            renderPage({ encounter: { name: 'Ambush', roster: [] } });
            open();
            name('Ash Warden');
            fireEvent.click(within(panel()).getByRole('button', { name: 'Add to encounter' }));
            expect(save()).toHaveTextContent('Save');

            fireEvent.click(save());

            await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalled());
            const saved = mockUpdateDoc.mock.calls[0][1].roster;
            expect(saved).toHaveLength(1);
            expect(saved[0].enemy).toMatchObject({ enemy_name: 'Ash Warden', enemy_type: 'Regular', maximum_health: 15, action_points: 2 });
            expect(saved[0].templateId).toBeUndefined();
        });

        test('an action written in the form comes with the enemy, once it is filled in', async () => {
            renderPage({ encounter: { name: 'Ambush', roster: [] } });
            open();
            name('Ash Warden');
            fireEvent.click(within(panel()).getByRole('button', { name: '+ Action' }));
            fireEvent.click(within(panel()).getByRole('button', { name: 'Add to encounter' }));
            // an unnamed action is not valid, so it stays open with the problem showing
            expect(panel()).toBeInTheDocument();
            expect(within(panel()).getAllByText('Give this action a name.').length).toBeGreaterThan(0);

            fireEvent.change(panel().querySelector('input[name="actionName"]'), { target: { value: 'Ash Cloud' } });
            fireEvent.click(within(panel()).getByRole('button', { name: 'Add to encounter' }));

            expect(screen.queryByRole('group', { name: 'New enemy' })).not.toBeInTheDocument();
            fireEvent.click(save());
            await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalled());
            expect(mockUpdateDoc.mock.calls[0][1].roster[0].enemy.actions).toHaveLength(1);
            expect(mockUpdateDoc.mock.calls[0][1].roster[0].enemy.actions[0]).toMatchObject({ actionName: 'Ash Cloud', category: 'action' });
        });

        test('without a name it will not add, and says why', () => {
            renderPage({ encounter: { name: 'Ambush', roster: [] } });
            open();

            fireEvent.click(within(panel()).getByRole('button', { name: 'Add to encounter' }));

            expect(panel()).toBeInTheDocument();
            expect(within(panel()).getAllByText('Give the enemy a name.').length).toBeGreaterThan(0);
            expect(rosterNames()).toEqual([]);
        });

        test('a number that is not a whole number is refused', () => {
            renderPage({ encounter: { name: 'Ambush', roster: [] } });
            open();
            name('Ash Warden');
            fireEvent.change(field('Maximum Health'), { target: { value: '' } });

            fireEvent.click(within(panel()).getByRole('button', { name: 'Add to encounter' }));

            expect(panel()).toBeInTheDocument();
            expect(within(panel()).getAllByText('Enter a whole number.').length).toBeGreaterThan(0);
        });

        test('Cancel closes the form without adding anything', () => {
            renderPage({ encounter: { name: 'Ambush', roster: [] } });
            open();
            name('Ash Warden');

            fireEvent.click(within(panel()).getByRole('button', { name: 'Cancel' }));

            expect(screen.queryByRole('group', { name: 'New enemy' })).not.toBeInTheDocument();
            expect(rosterNames()).toEqual([]);
            expect(save()).toHaveTextContent('Saved');
        });

        test('opening it again starts from a blank form', () => {
            renderPage({ encounter: { name: 'Ambush', roster: [] } });
            open();
            name('Ash Warden');
            fireEvent.click(within(panel()).getByRole('button', { name: 'Cancel' }));

            open();

            expect(screen.getByLabelText('Name of the new enemy')).toHaveValue('');
        });

        test('the button toggles the form closed again', () => {
            renderPage({ encounter: { name: 'Ambush', roster: [] } });
            open();
            expect(screen.getByRole('button', { name: '+ Create enemy' })).toHaveAttribute('aria-expanded', 'true');
            open();
            expect(screen.queryByRole('group', { name: 'New enemy' })).not.toBeInTheDocument();
        });

        test('it and the bestiary picker take turns', () => {
            renderPage({ encounter: { name: 'Ambush', roster: [] } });
            fireEvent.click(screen.getByRole('button', { name: '+ Add enemy' }));
            expect(screen.getByLabelText('Search the bestiary')).toBeInTheDocument();

            open();
            expect(screen.queryByLabelText('Search the bestiary')).not.toBeInTheDocument();
            expect(panel()).toBeInTheDocument();

            fireEvent.click(screen.getByRole('button', { name: '+ Add enemy' }));
            expect(screen.queryByRole('group', { name: 'New enemy' })).not.toBeInTheDocument();
            expect(screen.getByLabelText('Search the bestiary')).toBeInTheDocument();
        });

        test('several can be created, one after another', () => {
            renderPage({ encounter: { name: 'Ambush', roster: [] } });
            open();
            name('First');
            fireEvent.click(within(panel()).getByRole('button', { name: 'Add to encounter' }));
            open();
            name('Second');
            fireEvent.click(within(panel()).getByRole('button', { name: 'Add to encounter' }));
            expect(rosterNames()).toEqual(['First', 'Second']);
        });

        describe('also saving it to the bestiary', () => {
            const tick = () => fireEvent.click(within(panel()).getByLabelText(/Also save it to my bestiary/));

            test('is off to begin with', () => {
                renderPage({ encounter: { name: 'Ambush', roster: [] } });
                open();
                expect(within(panel()).getByLabelText(/Also save it to my bestiary/)).not.toBeChecked();
            });

            test('when ticked, saves a private enemy of yours, and the roster entry remembers which', async () => {
                renderPage({ encounter: { name: 'Ambush', roster: [] } });
                open();
                name('Ash Warden');
                fireEvent.change(field('Maximum Health'), { target: { value: '20' } });
                tick();

                fireEvent.click(within(panel()).getByRole('button', { name: 'Add to encounter' }));

                await waitFor(() => expect(screen.getByLabelText('Name of Ash Warden')).toBeInTheDocument());
                expect(mockAddDoc).toHaveBeenCalledTimes(1);
                const [target, data] = mockAddDoc.mock.calls[0];
                expect(target).toEqual({ __collection: 'enemies' });
                expect(data).toMatchObject({ enemy_name: 'Ash Warden', enemy_type: 'Regular', maximum_health: 20, public: false, canRead: ['dm'], canWrite: ['dm'], admins: ['dm'] });

                fireEvent.click(save());
                await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalled());
                expect(mockUpdateDoc.mock.calls[0][1].roster[0].templateId).toBe('new-enemy');
            });

            test('if it cannot be saved there, it says so, and nothing is added', async () => {
                mockAddDoc.mockRejectedValue(new Error('permission-denied'));
                renderPage({ encounter: { name: 'Ambush', roster: [] } });
                open();
                name('Ash Warden');
                tick();

                fireEvent.click(within(panel()).getByRole('button', { name: 'Add to encounter' }));

                await waitFor(() => expect(window.alert).toHaveBeenCalledWith("Couldn't save the enemy to your bestiary: permission-denied"));
                expect(panel()).toBeInTheDocument();
                expect(rosterNames()).toEqual([]);
                expect(within(panel()).getByRole('button', { name: 'Add to encounter' })).toBeEnabled();
            });

            test('someone not signed in cannot save it there', async () => {
                mockAuth.currentUser = null;
                renderPage({ encounter: { name: 'Ambush', roster: [] } });
                open();
                name('Ash Warden');
                tick();

                fireEvent.click(within(panel()).getByRole('button', { name: 'Add to encounter' }));

                await waitFor(() => expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('signed in')));
                expect(mockAddDoc).not.toHaveBeenCalled();
            });
        });
    });

    describe('saving', () => {
        test('starts saved, and turns into Save once something changes', () => {
            renderPage({ encounter: { name: 'Ambush', roster: [] } });
            expect(save()).toHaveTextContent('Saved');
            expect(save()).toBeDisabled();
            expect(screen.queryByText(/unsaved changes/)).not.toBeInTheDocument();

            fireEvent.change(screen.getByLabelText('Encounter name'), { target: { value: 'Bigger ambush' } });

            expect(save()).toHaveTextContent('Save');
            expect(save()).toBeEnabled();
            expect(screen.getByText(/unsaved changes/)).toBeInTheDocument();
        });

        test('Save writes the name, notes and roster, and goes back to Saved', async () => {
            renderPage({ encounter: { name: 'Ambush', roster: [] } });
            fireEvent.change(screen.getByLabelText('Encounter name'), { target: { value: '  Bigger ambush ' } });
            fireEvent.change(screen.getByLabelText('Encounter notes'), { target: { value: 'Read this aloud' } });

            fireEvent.click(save());

            await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalled());
            const [target, data] = mockUpdateDoc.mock.calls[0];
            expect(target).toEqual({ __doc: ENCOUNTER });
            expect(data).toMatchObject({ name: 'Bigger ambush', notes: 'Read this aloud', roster: [], updatedAt: 'now' });
            await waitFor(() => expect(save()).toHaveTextContent('Saved'));
        });

        test('an encounter with no name is saved as "Untitled encounter"', async () => {
            renderPage({ encounter: { name: 'Ambush', roster: [] } });
            fireEvent.change(screen.getByLabelText('Encounter name'), { target: { value: '   ' } });
            fireEvent.click(save());
            await waitFor(() => expect(mockUpdateDoc.mock.calls[0][1].name).toBe('Untitled encounter'));
        });

        test('a failed save is alerted and stays unsaved', async () => {
            mockUpdateDoc.mockRejectedValue(new Error('offline'));
            renderPage({ encounter: { name: 'Ambush', roster: [] } });
            fireEvent.change(screen.getByLabelText('Encounter name'), { target: { value: 'x' } });

            fireEvent.click(save());

            await waitFor(() => expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('offline')));
            expect(save()).toHaveTextContent('Save');
        });

        test('an update that arrives while you are editing does not replace your draft', () => {
            renderPage({ encounter: { name: 'Ambush', roster: [] } });
            fireEvent.change(screen.getByLabelText('Encounter name'), { target: { value: 'Mine' } });

            act(() => mockListeners[ENCOUNTER].next(snap({ name: 'Theirs', roster: [], stagedIds: ['a'] })));

            expect(screen.getByLabelText('Encounter name')).toHaveValue('Mine');
        });
    });

    describe('staging', () => {
        const encounter = () => ({ name: 'Ambush', roster: [{ ...twoBandits(), zone: 'Zone B' }, rosterEntry(captain)], stagedIds: [] });

        test('adds the enemies to the campaign and the tracker, then records which they were', async () => {
            renderPage({ encounter: encounter(), campaign: { enemy_list: [{ id: 'old', enemy_name: 'Old' }] } });

            fireEvent.click(screen.getByRole('button', { name: 'Stage encounter' }));

            await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalledTimes(2));
            const [campaignTarget, campaignData] = mockUpdateDoc.mock.calls[0];
            expect(campaignTarget).toEqual({ __doc: CAMPAIGN });
            expect(campaignData.enemy_list.map(enemy => enemy.enemy_name)).toEqual(['Old', 'Rust Bandit 1', 'Rust Bandit 2', 'Iron Captain']);
            expect(campaignData).not.toHaveProperty('combat_tracker'); // the tracker is on the party doc

            // ...where they are added to whoever is already on it, in a transaction
            expect(mockUpdateCombatTracker).toHaveBeenCalledWith('camp-1', expect.any(Function));
            const added = mockUpdateCombatTracker.mock.calls[0][1]([{ id: 'character:x', status: 'Zone A', index: 0 }]);
            expect(added[0]).toEqual({ id: 'character:x', status: 'Zone A', index: 0 });
            expect(added.slice(1).map(post => [post.title, post.status])).toEqual([['Rust Bandit 1', 'Zone B'], ['Rust Bandit 2', 'Zone B'], ['Iron Captain', 'Zone A']]);

            const [encounterTarget, encounterData] = mockUpdateDoc.mock.calls[1];
            expect(encounterTarget).toEqual({ __doc: ENCOUNTER });
            expect(encounterData.stagedIds).toEqual(campaignData.enemy_list.slice(1).map(enemy => enemy.id));
        });

        test('they line up after whoever is already in the zone on the party doc\'s tracker', async () => {
            mockParty = { combat_tracker: [{ id: 'character:a', status: 'Zone B', index: 0 }, { id: 'character:b', status: 'Zone B', index: 1 }] };
            renderPage({ encounter: encounter() });

            fireEvent.click(screen.getByRole('button', { name: 'Stage encounter' }));

            await waitFor(() => expect(mockUpdateCombatTracker).toHaveBeenCalled());
            const added = mockUpdateCombatTracker.mock.calls[0][1]([]);
            expect(added.filter(post => post.status === 'Zone B').map(post => post.index)).toEqual([2, 3]);
        });

        test('with no map, only the enemies are added: there is nothing to put on the tracker', async () => {
            renderPage({ encounter: encounter(), zones: null });
            fireEvent.click(screen.getByRole('button', { name: 'Stage encounter' }));
            await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalledTimes(2));
            expect(mockUpdateCombatTracker).not.toHaveBeenCalled();
        });

        test('unsaved changes are saved first, so what is staged is what is on the page', async () => {
            renderPage({ encounter: encounter() });
            fireEvent.change(screen.getByLabelText('Encounter name'), { target: { value: 'Renamed' } });

            fireEvent.click(screen.getByRole('button', { name: 'Stage encounter' }));

            await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalledTimes(3));
            expect(mockUpdateDoc.mock.calls[0][0]).toEqual({ __doc: ENCOUNTER });
            expect(mockUpdateDoc.mock.calls[0][1].name).toBe('Renamed');
            expect(mockUpdateDoc.mock.calls[1][0]).toEqual({ __doc: CAMPAIGN });
        });

        test('if that save fails, nothing is staged', async () => {
            mockUpdateDoc.mockRejectedValue(new Error('offline'));
            renderPage({ encounter: encounter() });
            fireEvent.change(screen.getByLabelText('Encounter name'), { target: { value: 'Renamed' } });

            fireEvent.click(screen.getByRole('button', { name: 'Stage encounter' }));

            await waitFor(() => expect(window.alert).toHaveBeenCalled());
            expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
        });

        test('staging what is already staged asks first, and adds a second set', async () => {
            renderPage({ encounter: { ...encounter(), stagedIds: ['earlier'] } });

            fireEvent.click(screen.getByRole('button', { name: 'Stage encounter' }));

            expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('already staged'));
            await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalledTimes(2));
            expect(mockUpdateDoc.mock.calls[1][1].stagedIds).toHaveLength(1 + 3);
            expect(mockUpdateDoc.mock.calls[1][1].stagedIds[0]).toBe('earlier');
        });

        test('declining that stages nothing', () => {
            window.confirm = jest.fn(() => false);
            renderPage({ encounter: { ...encounter(), stagedIds: ['earlier'] } });
            fireEvent.click(screen.getByRole('button', { name: 'Stage encounter' }));
            expect(mockUpdateDoc).not.toHaveBeenCalled();
        });

        test('a failed staging is alerted', async () => {
            mockUpdateDoc.mockRejectedValue(new Error('denied'));
            renderPage({ encounter: encounter() });
            fireEvent.click(screen.getByRole('button', { name: 'Stage encounter' }));
            await waitFor(() => expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('denied')));
        });

        test('cannot be staged until the campaign has loaded', () => {
            mockBestiary = { enemies: [], status: 'ready' };
            mockMaps = { activeMap: undefined };
            renderWithRouter(<EncounterPage />, { route: '/campaigns/camp-1/encounters/enc-1' });
            act(() => mockListeners[ENCOUNTER].next(snap(encounter())));
            expect(screen.getByRole('button', { name: 'Stage encounter' })).toBeDisabled();
        });
    });

    describe('clearing what was staged', () => {
        const staged = { name: 'Ambush', roster: [twoBandits()], stagedIds: ['s1', 's2'] };
        const campaign = {
            enemy_list: [{ id: 's1', enemy_name: 'Rust Bandit 1' }, { id: 'keep', enemy_name: 'Other' }],
        };

        test('is offered only once staged, and says how many are still there', () => {
            renderPage({ encounter: { name: 'Ambush', roster: [twoBandits()], stagedIds: [] }, campaign });
            expect(screen.queryByRole('button', { name: 'Clear staged enemies' })).not.toBeInTheDocument();

            act(() => mockListeners[ENCOUNTER].next(snap(staged)));
            expect(screen.getByRole('button', { name: 'Clear staged enemies' })).toBeInTheDocument();
            expect(screen.getByText(/1 of 2 of its enemies are still on the Director's page/)).toBeInTheDocument();
        });

        test('removes just those enemies and their tracker cards, and forgets them', async () => {
            renderPage({ encounter: staged, campaign });

            fireEvent.click(screen.getByRole('button', { name: 'Clear staged enemies' }));

            await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalledTimes(2));
            expect(mockUpdateDoc.mock.calls[0]).toEqual([{ __doc: CAMPAIGN }, { enemy_list: [{ id: 'keep', enemy_name: 'Other' }] }]);
            expect(mockUpdateDoc.mock.calls[1]).toEqual([{ __doc: ENCOUNTER }, { stagedIds: [] }]);
            // and off the party doc's tracker, leaving everyone else on it
            expect(mockUpdateCombatTracker).toHaveBeenCalledWith('camp-1', expect.any(Function));
            expect(mockUpdateCombatTracker.mock.calls[0][1]([{ id: 'npc:s1' }, { id: 'npc:keep' }, { id: 'character:a' }])).toEqual([{ id: 'npc:keep' }, { id: 'character:a' }]);
        });

        test('declining removes nothing', () => {
            window.confirm = jest.fn(() => false);
            renderPage({ encounter: staged, campaign });
            fireEvent.click(screen.getByRole('button', { name: 'Clear staged enemies' }));
            expect(mockUpdateDoc).not.toHaveBeenCalled();
        });
    });
});

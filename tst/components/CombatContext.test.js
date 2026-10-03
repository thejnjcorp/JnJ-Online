jest.mock('../../src/utils/firebase', () => ({ db: {} }));

const mockUpdateDoc = jest.fn();
const mockSetDoc = jest.fn();
const mockOnSnapshot = jest.fn();
jest.mock('firebase/firestore', () => ({
    doc: (_db, ...path) => ({ __doc: path.join('/') }),
    onSnapshot: (...args) => mockOnSnapshot(...args),
    setDoc: (...args) => mockSetDoc(...args),
    updateDoc: (...args) => mockUpdateDoc(...args),
}));

let mockParty;
jest.mock('../../src/utils/useParty', () => ({ useParty: () => ({ party: mockParty, loaded: true }) }));
const mockUpdateParty = jest.fn();
jest.mock('../../src/utils/party', () => ({ updateParty: (...args) => mockUpdateParty(...args) }));
let mockBestiary;
jest.mock('../../src/utils/useBestiary', () => ({ useBestiary: () => ({ enemies: mockBestiary, status: 'ready' }) }));

let mockDrawerProps;
jest.mock('../../src/components/EntityDrawer', () => ({
    EntityDrawer: props => {
        mockDrawerProps = props;
        return <div>Drawer:{props.combatant.name}:{props.members?.length ?? 'solo'}:{props.zone}:{String(props.active)}<button type="button" onClick={props.onClose}>Close drawer</button></div>;
    },
}));
jest.mock('../../src/components/AddStatusDialog', () => ({
    AddStatusDialog: ({ characterPage, onUpdateStatuses, onClose }) => <div>
        AddStatusDialog:{characterPage.character_id || characterPage.id}:{characterPage.campaign}
        <button type="button" onClick={() => onUpdateStatuses([{ id: 'new' }])}>Save status</button>
        <button type="button" onClick={onClose}>Close add</button>
    </div>,
}));

// eslint-disable-next-line import/first
import { useState } from 'react';
// eslint-disable-next-line import/first
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
// eslint-disable-next-line import/first
import { CombatProvider, useCombat } from '../../src/components/CombatContext';

const character = (fields = {}) => ({
    character_id: 'c1', character_name: 'Leon', current_health: 10, maximum_health: 20, action_points: 1, base_armor_class: 13, hero_points: 1,
    strength_stat: 1, dexterity_stat: 0, intelligence_stat: 0, charisma_stat: 0, statuses: [], actions: [], ...fields,
});
const enemy = (fields = {}) => ({
    id: 'e1', enemy_name: 'Tree', enemy_type: 'Elite', level: 2, current_health: 50, maximum_health: 60, action_points: 3, max_action_points: 3, base_armor_class: 14,
    strength_stat: 9, dexterity_stat: 0, intelligence_stat: 0, charisma_stat: 0, statuses: [], actions: [], ...fields,
});
const goon = n => enemy({ id: `g${n}`, enemy_name: `Goober ${n}`, enemy_type: 'Regular', current_health: 4, maximum_health: 4 });

let ctx;
function Probe() {
    ctx = useCombat();
    return <div>probe</div>;
}

let updateEnemy;
let removeEnemy;
let onApi;
let onTurn;
function renderProvider({ characters = [character()], enemies = [enemy()], userId = 'dir' } = {}) {
    return render(<CombatProvider campaignId="camp-1" campaignInfo={{ enemy_list: enemies }} characters={characters} userId={userId}
        updateEnemy={updateEnemy} removeEnemy={removeEnemy} onApi={onApi} onTurn={onTurn}><Probe/></CombatProvider>);
}
const api = () => ctx.api;
const player = () => ctx.players[0];
const tree = () => ctx.tiles.find(tile => tile.key === 'npc:e1').member;

beforeEach(() => {
    mockParty = { combat_tracker: [] };
    mockBestiary = [];
    updateEnemy = jest.fn().mockResolvedValue(undefined);
    removeEnemy = jest.fn();
    onApi = jest.fn();
    onTurn = jest.fn();
    mockUpdateDoc.mockResolvedValue(undefined);
    mockSetDoc.mockResolvedValue(undefined);
    mockUpdateParty.mockResolvedValue(undefined);
    mockOnSnapshot.mockImplementation(() => jest.fn());
    window.alert = jest.fn();
});

afterEach(() => { delete window.alert; jest.clearAllMocks(); });

describe('who is in the fight', () => {
    test('is the players and the enemy tiles, ready for the tiles to show', () => {
        renderProvider({ enemies: [enemy(), goon(1), goon(2)] });
        expect(ctx.players.map(entry => entry.name)).toEqual(['Leon']);
        expect(ctx.tiles.map(tile => tile.kind)).toEqual(['single', 'group']);
    });

    test('tells the page its actions once they exist', () => {
        renderProvider();
        expect(onApi).toHaveBeenCalledWith(expect.objectContaining({ endTurn: expect.any(Function), endScene: expect.any(Function) }));
    });

    test('a page that keeps the api it is told of, and hands over new functions each render, does not render forever', () => {
        // what the Director's page does: a plain function for each, new every render, and the api in state
        const renders = jest.fn();
        const fighters = [character()];
        const foes = [enemy()];
        let latest;
        function Page() {
            const [told, setTold] = useState(null);
            renders();
            latest = told;
            return <CombatProvider campaignId="camp-1" campaignInfo={{ enemy_list: foes }} characters={fighters} userId="u1"
                updateEnemy={(...args) => updateEnemy(...args)} removeEnemy={(...args) => removeEnemy(...args)} onApi={setTold}><Probe/></CombatProvider>;
        }
        render(<Page/>);
        expect(renders.mock.calls.length).toBeLessThan(5);
        expect(latest).toEqual(expect.objectContaining({ endTurn: expect.any(Function) }));
        // and its writes still reach the page's latest functions
        act(() => { latest.removeEnemy(tree()); });
        expect(removeEnemy).toHaveBeenCalled();
    });

    test('tells the page what round it is and whose turn, by name', () => {
        mockParty = { combat_turn: { order: ['character:c1', 'npc:e1'], active: 'npc:e1', round: 3 } };
        renderProvider();
        expect(onTurn).toHaveBeenLastCalledWith({ round: 3, active: 'npc:e1', activeName: 'Tree' });
        mockParty = { combat_turn: { order: ['character:c1', 'npc:e1'], active: 'character:c1', round: 3 } };
        renderProvider();
        expect(onTurn).toHaveBeenLastCalledWith({ round: 3, active: 'character:c1', activeName: 'Leon' });
        mockParty = { combat_turn: { order: ['character:c1', 'npc:e1'], active: null, round: 1 } };
        renderProvider();
        expect(onTurn).toHaveBeenLastCalledWith({ round: 1, active: null, activeName: '' });
    });

    test('a group of minions is named for the group', () => {
        mockParty = { combat_turn: { order: ['character:c1', 'group:Regular:Goober'], active: 'group:Regular:Goober', round: 1 } };
        renderProvider({ enemies: [goon(1), goon(2)] });
        expect(onTurn.mock.calls.at(-1)[0].activeName).toMatch(/Goober ×2/);
    });

    test('knows the zone each combatant is in from the tracker', () => {
        mockParty = { combat_tracker: [{ id: 'npc:e1', status: 'Zone 3' }] };
        renderProvider();
        expect(ctx.zones.get('npc:e1')).toBe('Zone 3');
    });
});

describe('the turn order follows the fight', () => {
    test('a director who finds the order out of date brings it up to date', async () => {
        renderProvider();
        await waitFor(() => expect(mockUpdateParty).toHaveBeenCalledWith('camp-1', expect.any(Function)));
        const patch = mockUpdateParty.mock.calls[0][1]({ combat_turn: { order: ['npc:gone'], active: 'npc:gone', round: 2 } });
        expect(patch).toEqual({ combat_turn: { order: ['character:c1', 'npc:e1'], active: null, round: 2 } });
    });

    test('writes nothing when the order is already right, or before anyone is signed in', () => {
        mockParty = { combat_turn: { order: ['character:c1', 'npc:e1'], active: null, round: 1 } };
        renderProvider();
        expect(mockUpdateParty).not.toHaveBeenCalled();
    });

    test('a signed-out viewer never writes it', () => {
        renderProvider({ userId: '' });
        expect(mockUpdateParty).not.toHaveBeenCalled();
    });

    test('an empty fight has no order to keep', () => {
        renderProvider({ characters: [], enemies: [] });
        expect(mockUpdateParty).not.toHaveBeenCalled();
    });
});

describe('changing someone', () => {
    beforeEach(() => { mockParty = { combat_tracker: [], combat_turn: { order: ['character:c1', 'npc:e1'], active: null, round: 1 } }; });

    test('a player\'s changes go to their character document', () => {
        renderProvider();
        api().setHp(player(), { now: 5, temp: 2, max: 20 });
        expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: 'characters/c1' }, { current_health: 5, temporary_health: 2 });
        api().setStatuses(player(), [{ id: 's' }]);
        expect(mockUpdateDoc).toHaveBeenLastCalledWith({ __doc: 'characters/c1' }, { statuses: [{ id: 's' }] });
        api().setHero(player(), -3);
        expect(mockUpdateDoc).toHaveBeenLastCalledWith({ __doc: 'characters/c1' }, { hero_points: 0 });
        api().setReaction(player(), false);
        expect(mockUpdateDoc).toHaveBeenLastCalledWith({ __doc: 'characters/c1' }, { reaction_used: true });
    });

    test('an enemy\'s go through the page, which rewrites the campaign\'s list', () => {
        renderProvider();
        api().setHp(tree(), { now: 40, temp: 0, max: 60 });
        expect(updateEnemy).toHaveBeenCalledWith('e1', { current_health: 40, temporary_health: 0 });
        api().setBaseStat(tree(), 'strength_stat', 10);
        expect(updateEnemy).toHaveBeenLastCalledWith('e1', { strength_stat: 10 });
        api().setField(tree(), { Weaknesses: ['Fire 5'] });
        expect(updateEnemy).toHaveBeenLastCalledWith('e1', { Weaknesses: ['Fire 5'] });
        api().setDefeated(tree(), true);
        expect(updateEnemy).toHaveBeenLastCalledWith('e1', { defeated: true });
    });

    test('action points stay between none and the most they can have', () => {
        renderProvider();
        api().setAp(player(), 9);
        expect(mockUpdateDoc).toHaveBeenLastCalledWith(expect.anything(), { action_points: 4 });
        api().setAp(player(), -2);
        expect(mockUpdateDoc).toHaveBeenLastCalledWith(expect.anything(), { action_points: 0 });
    });

    test('using a reaction spends the reaction; any other action spends its action points, never below none', () => {
        renderProvider();
        api().useAction(player(), { actionName: 'Parry', category: 'reaction', actionCost: 1 });
        expect(mockUpdateDoc).toHaveBeenLastCalledWith(expect.anything(), { reaction_used: true });
        api().useAction(player(), { actionName: 'Slash', actionCost: 2 });
        expect(mockUpdateDoc).toHaveBeenLastCalledWith(expect.anything(), { action_points: 0 });
        api().useAction(tree(), { actionName: 'Slam', actionCost: 2 });
        expect(updateEnemy).toHaveBeenLastCalledWith('e1', { action_points: 1 });
    });

    test('a write that fails is alerted', async () => {
        mockUpdateDoc.mockRejectedValue(new Error('denied'));
        renderProvider();
        api().setAp(player(), 2);
        await waitFor(() => expect(window.alert).toHaveBeenCalled());
        updateEnemy.mockRejectedValue(new Error('offline'));
        api().setAp(tree(), 1);
        await waitFor(() => expect(window.alert).toHaveBeenCalledTimes(2));
    });

    test('Reset to template copies the bestiary\'s numbers back, keeping its name and not raising its hit points', () => {
        renderProvider();
        api().resetToTemplate(tree(), { id: 't', enemy_name: 'Original', base_armor_class: 12, maximum_health: 45, strength_stat: 7 });
        expect(updateEnemy).toHaveBeenCalledWith('e1', expect.objectContaining({ base_armor_class: 12, maximum_health: 45, strength_stat: 7, current_health: 45 }));
        expect(updateEnemy.mock.calls[0][1].enemy_name).toBeUndefined();
    });

    test('removing an enemy goes to the page, with the enemy', () => {
        renderProvider();
        api().removeEnemy(tree());
        expect(removeEnemy).toHaveBeenCalledWith(expect.objectContaining({ id: 'e1' }));
    });
});

describe('the turn', () => {
    const turn = fields => ({ order: ['character:c1', 'npc:e1'], active: 'character:c1', round: 1, ...fields });
    const change = () => mockUpdateParty.mock.calls.at(-1)[1]({ combat_turn: turn({ active: 'character:c1' }) });

    beforeEach(() => { mockParty = { combat_tracker: [], combat_turn: turn() }; });

    test('anyone can be given the turn, by who they are or by their place in the order', () => {
        renderProvider();
        api().setActiveTurn(tree());
        expect(change().combat_turn.active).toBe('npc:e1');
        api().setActiveKey('character:c1');
        expect(change().combat_turn.active).toBe('character:c1');
    });

    test('a group\'s minions give the turn to the group', () => {
        mockParty = { combat_tracker: [], combat_turn: { order: ['character:c1', 'group:Regular:Goober'], active: null, round: 1 } };
        renderProvider({ enemies: [goon(1), goon(2)] });
        api().setActiveTurn(ctx.tiles[0].members[1]);
        expect(mockUpdateParty.mock.calls.at(-1)[1]({ combat_turn: mockParty.combat_turn }).combat_turn.active).toBe('group:Regular:Goober');
    });

    test('the acting one can be moved in the order', () => {
        renderProvider();
        api().moveInOrder('character:c1', 1);
        expect(change().combat_turn.order).toEqual(['npc:e1', 'character:c1']);
    });

    test('ending a turn hands it on, takes what lasted until the end of the turn from who was acting, and gives the next one their action points back', async () => {
        const lasting = { id: 'a', name: 'Cover', stacks: 1, duration: 'turn' };
        const keeps = { id: 'b', name: 'Rage', stacks: 1, duration: 'scene' };
        renderProvider({ characters: [character({ statuses: [lasting, keeps] })], enemies: [enemy({ action_points: 0 })] });
        await act(async () => { await api().endTurn(); });

        expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: 'characters/c1' }, { statuses: [keeps] });
        expect(updateEnemy).toHaveBeenCalledWith('e1', expect.objectContaining({ action_points: 3, reaction_used: false }));
        expect(change().combat_turn).toMatchObject({ active: 'npc:e1', round: 1 });
    });

    test('coming back to the top starts a round, ending what lasted only the round, for everyone', async () => {
        mockParty = { combat_tracker: [], combat_turn: turn({ active: 'npc:e1' }) };
        const roundly = { id: 'r', name: 'Burning', stacks: 1, duration: 'round' };
        renderProvider({ characters: [character({ statuses: [roundly] })], enemies: [enemy({ statuses: [roundly] })] });
        await act(async () => { await api().endTurn(); });
        expect(mockUpdateDoc).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action_points: 4 }));
        expect(updateEnemy).toHaveBeenCalledWith('e1', { statuses: [] });
        expect(mockUpdateParty.mock.calls.at(-1)[1]({ combat_turn: turn({ active: 'npc:e1' }) }).combat_turn).toMatchObject({ active: 'character:c1', round: 2 });
    });

    test('with no one in the fight there is no turn to end', async () => {
        mockParty = { combat_tracker: [], combat_turn: { order: [], active: null, round: 1 } };
        renderProvider({ characters: [], enemies: [] });
        await act(async () => { await api().endTurn(); });
        expect(mockUpdateParty).not.toHaveBeenCalled();
    });

    test('ending the scene takes away everything that lasted only for it', async () => {
        const scene = { id: 'sc', name: 'Sound', stacks: 1, duration: 'scene' };
        const forever = { id: 'f', name: 'Cursed', stacks: 1, duration: 'removed' };
        renderProvider({ characters: [character({ statuses: [scene, forever] })], enemies: [enemy({ statuses: [forever] })] });
        await act(async () => { await api().endScene(); });
        expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: 'characters/c1' }, { statuses: [forever] });
        expect(updateEnemy).not.toHaveBeenCalled();
    });
});

describe('the drawer and the status catalog', () => {
    beforeEach(() => { mockParty = { combat_tracker: [{ id: 'npc:e1', status: 'Zone 2' }], combat_turn: { order: ['character:c1', 'npc:e1'], active: 'npc:e1', round: 1 } }; });

    test('opens for one combatant, with their zone and whether it is their turn, and closes', () => {
        renderProvider();
        expect(screen.queryByText(/^Drawer:/)).not.toBeInTheDocument();
        act(() => api().openDrawer('npc:e1', null));
        expect(screen.getByText('Drawer:Tree:solo:Zone 2:true')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Close drawer' }));
        expect(screen.queryByText(/^Drawer:/)).not.toBeInTheDocument();
    });

    test('a click on the scrim closes it too', () => {
        renderProvider();
        act(() => api().openDrawer('npc:e1', null));
        fireEvent.click(screen.getByRole('button', { name: 'Close' }));
        expect(screen.queryByText(/^Drawer:/)).not.toBeInTheDocument();
    });

    test('for a group it is given every minion', () => {
        renderProvider({ enemies: [goon(1), goon(2)] });
        act(() => api().openDrawer('npc:g1', 'group:Regular:Goober'));
        expect(screen.getByText(/^Drawer:Goober 1:2:/)).toBeInTheDocument();
    });

    test('for an enemy it finds the bestiary entry it came from, so it can be reset to it', () => {
        mockBestiary = [{ id: 't1', enemy_name: 'Tree' }];
        renderProvider({ enemies: [enemy({ templateId: 't1' })] });
        act(() => api().openDrawer('npc:e1', null));
        expect(mockDrawerProps.template).toEqual({ id: 't1', enemy_name: 'Tree' });
    });

    test('a player\'s drawer reads and saves the director\'s private notes about them', () => {
        let listener;
        let errorListener;
        mockOnSnapshot.mockImplementation((ref, next, error) => { listener = next; errorListener = error; return jest.fn(); });
        renderProvider();
        act(() => api().openDrawer('character:c1', null));
        expect(mockOnSnapshot).toHaveBeenCalledWith({ __doc: 'campaigns/camp-1/entity_notes/c1' }, expect.any(Function), expect.any(Function));
        act(() => listener({ exists: () => true, data: () => ({ text: 'Spotlight in beat 5' }) }));
        expect(mockDrawerProps.notes).toMatchObject({ text: 'Spotlight in beat 5', available: true });
        act(() => listener({ exists: () => false }));
        expect(mockDrawerProps.notes.text).toBe('');
        mockDrawerProps.notes.save('New note');
        expect(mockSetDoc).toHaveBeenCalledWith({ __doc: 'campaigns/camp-1/entity_notes/c1' }, { text: 'New note' });
        jest.spyOn(console, 'log').mockImplementation(() => {});
        act(() => errorListener(new Error('denied')));
        expect(mockDrawerProps.notes.available).toBe(false);
        console.log.mockRestore();
    });

    test('a note that cannot be saved is alerted', async () => {
        mockSetDoc.mockRejectedValue(new Error('denied'));
        renderProvider();
        act(() => api().openDrawer('character:c1', null));
        mockDrawerProps.notes.save('x');
        await waitFor(() => expect(window.alert).toHaveBeenCalledWith("Couldn't save the notes: denied"));
    });

    test('an enemy\'s drawer reads no notes', () => {
        renderProvider();
        act(() => api().openDrawer('npc:e1', null));
        expect(mockOnSnapshot).not.toHaveBeenCalled();
    });

    test('the status catalog opens for them, and what it saves goes to them', () => {
        renderProvider();
        act(() => api().addStatus(player()));
        expect(screen.getByText('AddStatusDialog:c1:camp-1')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Save status' }));
        expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: 'characters/c1' }, { statuses: [{ id: 'new' }] });
        fireEvent.click(screen.getByRole('button', { name: 'Close add' }));
        expect(screen.queryByText(/AddStatusDialog/)).not.toBeInTheDocument();
    });

    test('for an enemy, the catalog is told which campaign it is in', () => {
        renderProvider();
        act(() => api().addStatus(tree()));
        expect(screen.getByText('AddStatusDialog:e1:camp-1')).toBeInTheDocument();
    });
});

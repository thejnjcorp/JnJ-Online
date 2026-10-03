jest.mock('../../src/components/CombatActionList', () => ({
    CombatActionList: ({ actions, onUseAction }) => <div>
        {actions.map(action => <button type="button" key={action.actionName} onClick={() => onUseAction(action)}>{`Use ${action.actionName}`}</button>)}
    </div>,
}));

// eslint-disable-next-line import/first
import { screen, fireEvent, within } from '@testing-library/react';
// eslint-disable-next-line import/first
import { EntityDrawer } from '../../src/components/EntityDrawer';
// eslint-disable-next-line import/first
import { enemyCombatant, enemyTiles, playerCombatant } from '../../src/utils/combatants';
// eslint-disable-next-line import/first
import { renderWithRouter } from '../testUtils/renderWithRouter';

const slam = { actionName: 'Slam', actionCost: 2, description: 'Here comes the tree.' };
const barrier = { actionName: 'Magical Barrier', category: 'passive', description: 'The first spell fizzles.' };

const enemy = (fields = {}) => ({
    id: 'e1', enemy_name: 'Tree Sentinel', enemy_type: 'Elite', level: 2, current_health: 52, maximum_health: 60, action_points: 2, max_action_points: 3, base_armor_class: 14,
    strength_stat: 9, dexterity_stat: 0, intelligence_stat: 0, charisma_stat: 0, statuses: [], Weaknesses: ['Fire 10'], Immunities: ['Fear'],
    actions: [slam, barrier], description: 'Slow but strong.', ...fields,
});
const character = (fields = {}) => ({
    character_id: 'c1', character_name: 'Leon', class_name: 'Fighter', race_name: 'Human', current_health: 11, maximum_health: 20, action_points: 1, base_armor_class: 13, hero_points: 1,
    strength_stat: 1, dexterity_stat: 2, intelligence_stat: 0, charisma_stat: -1, experience_points: 0, base_hit_modifier: 2, base_damage_modifier: 0, base_damage_dice: 1, base_damage_dice_type: 6, base_healing_dice_type: 4,
    statuses: [{ id: 'sv', name: 'Venomous', stacks: -1 }], actions: [{ actionName: 'Fleetfoot', actionCost: 1 }, { actionName: 'Quick Thinking', actionCost: 0, category: 'reaction' }],
    skills_and_flaws: [{ name: 'Loss of tastebuds', isSkill: false }, { name: 'Strong', isSkill: true }],
    inventory: [{ id: 'i1', title: 'Herb satchel', item_id: 'it1', quantity: 6, status: '1' }, { id: 'i2', title: 'Spice kit', status: '2' }], ...fields,
});

let api;
let onClose;
let notes;
beforeEach(() => {
    api = {
        setHp: jest.fn(), setStatuses: jest.fn(), setAp: jest.fn(), setReaction: jest.fn(), setHero: jest.fn(), setBaseStat: jest.fn(), setField: jest.fn(),
        setDefeated: jest.fn(), addStatus: jest.fn(), useAction: jest.fn(), setActiveTurn: jest.fn(), resetToTemplate: jest.fn(),
    };
    onClose = jest.fn();
    notes = { text: 'Flashback is his.', available: true, save: jest.fn() };
});

function renderDrawer(combatant, props = {}) {
    return renderWithRouter(<EntityDrawer combatant={combatant} zone="Zone 3" api={api} active={false} notes={notes} userId="u1" onClose={onClose} {...props}/>);
}
const foe = fields => enemyCombatant(enemy(fields));
const player = fields => playerCombatant(character(fields));

describe('the header', () => {
    test('names who it is for, with their tier, level and zone, and closes', () => {
        renderDrawer(foe());
        const drawer = screen.getByRole('dialog', { name: 'Tree Sentinel details' });
        expect(within(drawer).getByText('Elite · Tier 2 · Zone 3')).toBeInTheDocument();
        fireEvent.click(within(drawer).getByRole('button', { name: 'Close drawer' }));
        expect(onClose).toHaveBeenCalled();
    });

    test('Set active turn gives them the turn, and says so when it is theirs', () => {
        const { unmount } = renderDrawer(foe());
        fireEvent.click(screen.getByRole('button', { name: 'Set active turn' }));
        expect(api.setActiveTurn).toHaveBeenCalledWith(expect.objectContaining({ id: 'npc:e1' }));
        unmount();
        renderDrawer(foe(), { active: true });
        expect(screen.getByRole('button', { name: 'Their turn' })).toHaveAttribute('aria-pressed', 'true');
    });

    test('a player has their class and race, and a portrait when they have one', () => {
        renderDrawer(player({ portrait_url: 'https://x.test/p.png' }));
        expect(screen.getByText('Fighter · Human · Zone 3')).toBeInTheDocument();
        expect(document.querySelector('.Drawer-avatar img')).toHaveAttribute('src', 'https://x.test/p.png'); // eslint-disable-line testing-library/no-node-access -- a decorative image
    });

    test('with no portrait it is their initials', () => {
        renderDrawer(player());
        expect(screen.getByText('L')).toBeInTheDocument();
    });
});

describe('an enemy: Stats', () => {
    test('hit points can be hit, healed and typed, and the bar follows', () => {
        renderDrawer(foe());
        fireEvent.click(screen.getByRole('button', { name: 'Damage 5' }));
        expect(api.setHp).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ now: 47 }));
        fireEvent.click(screen.getByRole('button', { name: 'Heal 5' }));
        expect(api.setHp).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ now: 57 }));
        const field = screen.getByLabelText('Current hit points');
        fireEvent.change(field, { target: { value: '30' } });
        expect(api.setHp).toHaveBeenCalledTimes(2);
        fireEvent.blur(field);
        expect(api.setHp).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ now: 30 }));
    });

    test('a number that is not one is put back, and one past the maximum stops at it', () => {
        renderDrawer(foe());
        const field = screen.getByLabelText('Current hit points');
        fireEvent.change(field, { target: { value: 'lots' } });
        fireEvent.blur(field);
        expect(field).toHaveValue('52');
        expect(api.setHp).not.toHaveBeenCalled();
        fireEvent.change(field, { target: { value: '99' } });
        fireEvent.keyDown(field, { key: 'Enter' });
        fireEvent.blur(field);
        expect(api.setHp).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ now: 60 }));
    });

    test('temporary and maximum hit points, and armor class', () => {
        renderDrawer(foe());
        fireEvent.click(screen.getByRole('button', { name: 'Increase temporary hit points' }));
        expect(api.setHp).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ temp: 1 }));
        const max = screen.getByLabelText('Maximum hit points');
        fireEvent.change(max, { target: { value: '40' } });
        fireEvent.blur(max);
        expect(api.setField).toHaveBeenCalledWith(expect.anything(), { maximum_health: 40, current_health: 40 });
        fireEvent.click(screen.getByRole('button', { name: 'Increase AC' }));
        expect(api.setBaseStat).toHaveBeenLastCalledWith(expect.anything(), 'base_armor_class', 15);
        const ac = screen.getByLabelText('Armor class');
        fireEvent.change(ac, { target: { value: '18' } });
        fireEvent.blur(ac);
        expect(api.setBaseStat).toHaveBeenLastCalledWith(expect.anything(), 'base_armor_class', 18);
    });

    test('an enemy without tracked hit points says so', () => {
        renderDrawer(foe({ maximum_health: undefined, current_health: undefined }));
        expect(screen.getByText('Hit points are not tracked for this enemy.')).toBeInTheDocument();
    });

    test('action points open the resources, and the reaction is a checkbox', () => {
        renderDrawer(foe());
        expect(screen.getByText('2 of 4 · resets on turn')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('checkbox', { name: 'Reaction ready' }));
        expect(api.setReaction).toHaveBeenCalledWith(expect.anything(), false);
        fireEvent.click(screen.getByRole('button', { name: 'Action points: 2 of 4, edit' }));
        fireEvent.click(within(screen.getByRole('group', { name: 'Resources' })).getByRole('button', { name: 'Reset action points to 3' }));
        expect(api.setAp).toHaveBeenCalledWith(expect.anything(), 3);
    });

    test('shows an armor class that statuses have changed', () => {
        renderDrawer(foe({ statuses: [{ id: 'm', name: 'AC +1', stacks: 1, effects: [{ stat: 'base_armor_class', trigger: 'passive', delta: 1 }] }] }));
        expect(screen.getByText('15 with statuses')).toBeInTheDocument();
    });

    test('abilities go up and down', () => {
        renderDrawer(foe());
        fireEvent.click(screen.getByRole('button', { name: 'Decrease STR' }));
        expect(api.setBaseStat).toHaveBeenCalledWith(expect.anything(), 'strength_stat', 8);
        fireEvent.click(screen.getByRole('button', { name: 'Increase DEX' }));
        expect(api.setBaseStat).toHaveBeenCalledWith(expect.anything(), 'dexterity_stat', 1);
    });

    test('weaknesses and immunities can be removed and added', () => {
        renderDrawer(foe());
        fireEvent.click(screen.getByRole('button', { name: 'Remove Weak: Fire 10' }));
        expect(api.setField).toHaveBeenLastCalledWith(expect.anything(), { Weaknesses: [] });

        fireEvent.click(screen.getByRole('button', { name: '+ Add' }));
        fireEvent.change(screen.getByLabelText('Kind'), { target: { value: 'Resistances' } });
        fireEvent.change(screen.getByLabelText('Type and amount'), { target: { value: 'cold  3' } });
        fireEvent.click(screen.getByRole('button', { name: 'Add' }));
        expect(api.setField).toHaveBeenLastCalledWith(expect.anything(), { Resistances: ['cold 3'] });

        fireEvent.click(screen.getByRole('button', { name: '+ Add' }));
        fireEvent.change(screen.getByLabelText('Kind'), { target: { value: 'Immunities' } });
        fireEvent.change(screen.getByLabelText('Type and amount'), { target: { value: 'Poison' } });
        fireEvent.keyDown(screen.getByLabelText('Type and amount'), { key: 'Enter' });
        expect(api.setField).toHaveBeenLastCalledWith(expect.anything(), { Immunities: ['Fear', 'Poison'] });
    });

    test('adding nothing adds nothing, and Cancel puts the form away', () => {
        renderDrawer(foe());
        fireEvent.click(screen.getByRole('button', { name: '+ Add' }));
        fireEvent.click(screen.getByRole('button', { name: 'Add' }));
        expect(api.setField).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(screen.queryByLabelText('Type and amount')).not.toBeInTheDocument();
    });

    test('statuses: none, or each with its chip, and a way to add one', () => {
        const { unmount } = renderDrawer(foe());
        expect(screen.getByText('None right now')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: '+ Add status' }));
        expect(api.addStatus).toHaveBeenCalled();
        unmount();
        renderDrawer(foe({ statuses: [{ id: 's', name: 'Slowed', stacks: 1 }] }));
        fireEvent.click(screen.getByRole('button', { name: 'Status: Slowed 1. Click to edit.' }));
        fireEvent.click(within(screen.getByRole('group', { name: 'Statuses' })).getByRole('button', { name: 'Remove Slowed' }));
        expect(api.setStatuses).toHaveBeenCalledWith(expect.anything(), []);
    });

    test('lists its passives', () => {
        renderDrawer(foe());
        expect(screen.getByText('Magical Barrier')).toBeInTheDocument();
        expect(screen.getByText('The first spell fizzles.')).toBeInTheDocument();
    });

    test('Mark defeated, and Restore once it is', () => {
        const { unmount } = renderDrawer(foe());
        fireEvent.click(screen.getByRole('button', { name: 'Mark defeated' }));
        expect(api.setDefeated).toHaveBeenCalledWith(expect.anything(), true);
        unmount();
        renderDrawer(foe({ defeated: true }));
        fireEvent.click(screen.getByRole('button', { name: 'Restore' }));
        expect(api.setDefeated).toHaveBeenLastCalledWith(expect.anything(), false);
    });

    test('Reset to template needs the bestiary entry it came from, and uses it', () => {
        const { unmount } = renderDrawer(foe());
        expect(screen.getByRole('button', { name: 'Reset to template' })).toBeDisabled();
        unmount();
        const template = { id: 't1', maximum_health: 70 };
        renderDrawer(foe(), { template });
        fireEvent.click(screen.getByRole('button', { name: 'Reset to template' }));
        expect(api.resetToTemplate).toHaveBeenCalledWith(expect.objectContaining({ id: 'npc:e1' }), template);
    });
});

describe('an enemy: Actions and Notes', () => {
    test('the tab counts its combat actions, and using one goes through the drawer', () => {
        renderDrawer(foe());
        expect(screen.getByRole('button', { name: 'Actions · 1' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Actions · 1' }));
        expect(screen.getByText('Click a circle to spend it')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Use Slam' }));
        expect(api.useAction).toHaveBeenCalledWith(expect.objectContaining({ id: 'npc:e1' }), slam);
    });

    test('an enemy with no combat actions says so', () => {
        renderDrawer(foe({ actions: [] }));
        fireEvent.click(screen.getByRole('button', { name: 'Actions · 0' }));
        expect(screen.getByText('No combat actions.')).toBeInTheDocument();
    });

    test('Notes are the bestiary\'s description, or say there are none', () => {
        const { unmount } = renderDrawer(foe());
        fireEvent.click(screen.getByRole('button', { name: 'Notes' }));
        expect(screen.getByText('Slow but strong.')).toBeInTheDocument();
        unmount();
        renderDrawer(foe({ description: '' }));
        fireEvent.click(screen.getByRole('button', { name: 'Notes' }));
        expect(screen.getByText(/No notes on this enemy/)).toBeInTheDocument();
    });
});

describe('a group of minions', () => {
    const goons = [1, 2].map(n => ({ id: `g${n}`, enemy_name: `Goober ${n}`, enemy_type: 'Regular', level: 1, current_health: 4, maximum_health: 4, action_points: 3, base_armor_class: 14,
        strength_stat: 2, dexterity_stat: 0, intelligence_stat: 0, charisma_stat: 0, statuses: [], actions: [] }));

    test('lists each one with hit points of its own, and can defeat or restore it', () => {
        const [tile] = enemyTiles(goons);
        renderDrawer(tile.base, { members: tile.members });
        expect(screen.getByText('Goober ×2')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Decrease Goober 2 hit points' }));
        expect(api.setHp).toHaveBeenCalledWith(expect.objectContaining({ id: 'npc:g2' }), expect.objectContaining({ now: 3 }));
        fireEvent.click(screen.getAllByRole('button', { name: 'Defeat' })[0]);
        expect(api.setDefeated).toHaveBeenCalledWith(expect.objectContaining({ id: 'npc:g1' }), true);
    });
});

describe('a player', () => {
    test('has their numbers across the top, opening the same edits', () => {
        renderDrawer(player());
        fireEvent.click(screen.getByRole('button', { name: 'Edit hit points' }));
        fireEvent.click(within(screen.getByRole('group', { name: /Hit points/ })).getByRole('button', { name: 'Apply 5 damage' }));
        expect(api.setHp).toHaveBeenCalledWith(expect.objectContaining({ id: 'character:c1' }), expect.objectContaining({ now: 6 }));

        fireEvent.click(screen.getByRole('button', { name: 'Edit armor class' }));
        fireEvent.click(within(screen.getByRole('group', { name: 'Armor class' })).getByRole('button', { name: 'Apply' }));
        expect(api.setStatuses).toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: 'Edit action points' }));
        expect(screen.getByRole('group', { name: 'Resources' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Edit hero points' }));
        fireEvent.click(screen.getByRole('button', { name: 'Toggle reaction' }));
        expect(api.setReaction).toHaveBeenCalledWith(expect.anything(), false);
    });

    test('abilities and statuses open their edits, and a status can be added', () => {
        renderDrawer(player());
        fireEvent.click(screen.getByRole('button', { name: 'Strength +1, edit' }));
        expect(screen.getByRole('group', { name: 'Strength' })).toBeInTheDocument();
        fireEvent.click(within(screen.getByRole('group', { name: 'Strength' })).getByRole('button', { name: 'Apply' }));
        fireEvent.click(screen.getByRole('button', { name: 'Status: Venomous. Click to edit.' }));
        expect(screen.getByRole('group', { name: 'Statuses' })).toBeInTheDocument();
        fireEvent.click(within(screen.getByRole('group', { name: 'Statuses' })).getByRole('button', { name: '+ Add status' }));
        expect(api.addStatus).toHaveBeenCalled();
    });

    test('starts on their actions (combat ones, and what statuses grant), and using one goes through the drawer', () => {
        renderDrawer(player());
        expect(screen.getByRole('button', { name: 'Actions · 2' })).toHaveAttribute('aria-current', 'page');
        fireEvent.click(screen.getByRole('button', { name: 'Use Fleetfoot' }));
        expect(api.useAction).toHaveBeenCalledWith(expect.objectContaining({ id: 'character:c1' }), expect.objectContaining({ actionName: 'Fleetfoot' }));
    });

    test('the quick look shows their flaws, reaction, class DC and what they carry', () => {
        renderDrawer(player());
        fireEvent.click(screen.getByRole('button', { name: 'Quick look' }));
        expect(screen.getByText('Loss of tastebuds')).toBeInTheDocument();
        expect(screen.queryByText('Strong')).not.toBeInTheDocument();
        expect(screen.getByText('Quick Thinking')).toBeInTheDocument();
        expect(screen.getByText('14')).toBeInTheDocument();
        expect(screen.getByText('Herb satchel')).toBeInTheDocument();
        expect(screen.getByText('×6')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Open full character page/ })).toHaveAttribute('href', '/characters/c1');
    });

    test('with nothing carried there is no inventory section', () => {
        renderDrawer(player({ inventory: [] }));
        fireEvent.click(screen.getByRole('button', { name: 'Quick look' }));
        expect(screen.queryByText('Inventory highlights')).not.toBeInTheDocument();
    });

    test('private notes are shown, and saved when you leave the box with something new', () => {
        renderDrawer(player());
        fireEvent.click(screen.getByRole('button', { name: 'Quick look' }));
        const box = screen.getByRole('textbox', { name: 'Director notes on Leon' });
        expect(box).toHaveValue('Flashback is his.');
        fireEvent.blur(box);
        expect(notes.save).not.toHaveBeenCalled();
        fireEvent.change(box, { target: { value: 'Changed.' } });
        fireEvent.blur(box);
        expect(notes.save).toHaveBeenCalledWith('Changed.');
    });

    test('a notes update from elsewhere shows up', () => {
        const { rerender } = renderDrawer(player());
        fireEvent.click(screen.getByRole('button', { name: 'Quick look' }));
        rerender(<EntityDrawer combatant={player()} zone="Zone 3" api={api} active={false} notes={{ ...notes, text: 'New from another device.' }} userId="u1" onClose={onClose}/>);
        expect(screen.getByRole('textbox', { name: 'Director notes on Leon' })).toHaveValue('New from another device.');
    });

    test('where the notes cannot be read (the rules are not deployed yet) the box says so and is off', () => {
        notes = { text: '', available: false, save: jest.fn() };
        renderDrawer(player());
        fireEvent.click(screen.getByRole('button', { name: 'Quick look' }));
        const box = screen.getByRole('textbox', { name: 'Director notes on Leon' });
        expect(box).toBeDisabled();
        expect(box).toHaveAttribute('placeholder', 'Notes need the updated Firestore rules.');
    });
});

describe('which side it opens on, and getting out of it', () => {
    test("an enemy's drawer is on the right, a player's on the left", () => {
        const { unmount } = renderDrawer(foe());
        expect(screen.getByRole('dialog', { name: 'Tree Sentinel details' })).toHaveClass('Drawer-right');
        unmount();
        renderDrawer(player());
        expect(screen.getByRole('dialog', { name: 'Leon details' })).not.toHaveClass('Drawer-right');
    });

    test('Escape closes it', () => {
        renderDrawer(foe());
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onClose).toHaveBeenCalled();
    });

    test('the circles of action points can be clicked in it', () => {
        renderDrawer(player({ action_points: 3 }));
        fireEvent.click(screen.getAllByRole('button', { name: 'Action point 3' })[0]);
        expect(api.setAp).toHaveBeenCalledWith(expect.objectContaining({ id: 'character:c1' }), 2);
    });
});

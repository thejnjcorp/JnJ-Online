/* eslint-disable testing-library/no-node-access -- the tile's own element has no role to find it by */
import { screen, fireEvent, within } from '@testing-library/react';
import { EntityTile } from '../../src/components/EntityTile';
import { enemyCombatant, enemyTiles, playerCombatant, withModifier } from '../../src/utils/combatants';
import { renderWithRouter } from '../testUtils/renderWithRouter';

const character = (fields = {}) => ({
    character_id: 'c1', character_name: 'Leon', class_name: 'Fighter',
    current_health: 11, maximum_health: 20, temporary_health: 0, action_points: 1, base_armor_class: 13, hero_points: 1,
    strength_stat: 1, dexterity_stat: 2, intelligence_stat: 0, charisma_stat: -1, statuses: [], ...fields,
});
const enemy = (fields = {}) => ({
    id: 'e1', enemy_name: 'Tree Sentinel', enemy_type: 'Elite', level: 2, current_health: 52, maximum_health: 60, action_points: 3, base_armor_class: 14,
    strength_stat: 9, dexterity_stat: 0, intelligence_stat: 0, charisma_stat: 0, statuses: [], Weaknesses: ['Fire 10'], Immunities: ['Poison'], ...fields,
});
const sound = { id: 's1', name: 'Sound', stacks: 1, duration: 'scene', effects: ['strength_stat', 'dexterity_stat'].map(stat => ({ stat, trigger: 'passive', mode: 'flat', delta: -1 })) };

let api;
beforeEach(() => {
    api = {
        openDrawer: jest.fn(), setHp: jest.fn(), setStatuses: jest.fn(), setAp: jest.fn(), setReaction: jest.fn(), setHero: jest.fn(),
        setBaseStat: jest.fn(), setDefeated: jest.fn(), addStatus: jest.fn(),
    };
});

const renderTile = (tile, props = {}) => renderWithRouter(<EntityTile tile={tile} active={false} api={api} {...props}/>);
const player = fields => playerCombatant(character(fields));
const foe = fields => enemyCombatant(enemy(fields));

describe('EntityTile, a player', () => {
    test('shows their name, armor class, hit points, abilities, action points, reaction, hero points and statuses', () => {
        renderTile(player({ temporary_health: 4, statuses: [sound] }));
        expect(screen.getByRole('button', { name: 'Open Leon details' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Armor class 13, edit' })).toHaveTextContent('13');
        expect(screen.getByRole('button', { name: 'Edit hit points: 11 of 20, plus 4 temporary' })).toHaveTextContent('11/20');
        expect(screen.getByText('+4 temp')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Strength +0 (base +1), edit' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Charisma −1, edit' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Action points: 1 of 4, edit' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Reaction ready. Click to toggle.' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Hero points: 1' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Status: Sound 1. Click to edit.' })).toBeInTheDocument();
    });

    test('has no tier, and the name opens their drawer', () => {
        renderTile(player());
        expect(screen.queryByText(/T\d/)).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Open Leon details' }));
        expect(api.openDrawer).toHaveBeenCalledWith('character:c1', null);
    });

    test('says whose turn it is, and when they are down', () => {
        const { unmount } = renderTile(player(), { active: true });
        expect(screen.getByText('Turn')).toBeInTheDocument();
        unmount();
        renderTile(player({ current_health: 0 }));
        expect(screen.getByText('Down')).toBeInTheDocument();
    });

    test('the reaction toggles at a click, giving it back when used', () => {
        renderTile(player({ reaction_used: true }));
        fireEvent.click(screen.getByRole('button', { name: 'Reaction used. Click to toggle.' }));
        expect(api.setReaction).toHaveBeenCalledWith(expect.objectContaining({ id: 'character:c1' }), true);
    });

    test('a status chip with no stacks has no count', () => {
        renderTile(player({ statuses: [{ id: 'p', name: 'Prone', stacks: -1, polarity: 'debuff' }] }));
        expect(screen.getByRole('button', { name: 'Status: Prone. Click to edit.' })).toBeInTheDocument();
    });
});

describe('the colour picked for a tile', () => {
    test('outlines the tile in it, for a player and for an enemy', () => {
        const { unmount } = renderTile(player({ navigation_color: '#00ff85' }));
        const tile = screen.getByRole('button', { name: 'Open Leon details' }).closest('.Entity-tile');
        expect(tile).toHaveClass('Entity-tile-colored');
        expect(tile.style.getPropertyValue('--entity-color')).toBe('#00ff85');
        unmount();
        renderTile(foe({ color: '#ff7a1f' }));
        const enemyTile = screen.getByRole('button', { name: 'Open Tree Sentinel details' }).closest('.Entity-tile');
        expect(enemyTile.style.getPropertyValue('--entity-color')).toBe('#ff7a1f');
    });

    test('a tile with none is left as it was', () => {
        renderTile(foe());
        const tile = screen.getByRole('button', { name: 'Open Tree Sentinel details' }).closest('.Entity-tile');
        expect(tile).not.toHaveClass('Entity-tile-colored');
        expect(tile.style.getPropertyValue('--entity-color')).toBe('');
    });
});

describe('EntityTile, an enemy', () => {
    test('shows its tier and level, and has no hero points', () => {
        renderTile(foe());
        expect(screen.getByText('Elite · T2')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Hero points/ })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Action points: 3 of 4, edit' })).toBeInTheDocument();
    });

    test('an enemy whose hit points are not tracked says so', () => {
        renderTile(foe({ maximum_health: undefined, current_health: undefined }));
        expect(screen.getByLabelText('Hit points not tracked for this enemy')).toHaveTextContent('HP n/a');
    });

    test('a defeated enemy says so, and offers to restore it', () => {
        renderTile(foe({ defeated: true }));
        expect(screen.getByText('Defeated')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Edit hit points/ })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Restore' }));
        expect(api.setDefeated).toHaveBeenCalledWith(expect.objectContaining({ id: 'npc:e1' }), false);
    });
});

describe('the hit points edit', () => {
    const open = fields => {
        renderTile(foe(fields));
        fireEvent.click(screen.getByRole('button', { name: /Edit hit points/ }));
        return screen.getByRole('group', { name: /Hit points/ });
    };

    test('shows what a hit does before it is applied, and applies it', () => {
        const panel = open();
        fireEvent.change(within(panel).getByLabelText('Amount'), { target: { value: '5' } });
        fireEvent.change(within(panel).getByLabelText('Damage type'), { target: { value: 'Physical' } });
        expect(within(panel).getByText('52 → 47')).toBeInTheDocument();
        fireEvent.click(within(panel).getByRole('button', { name: 'Apply 5 damage' }));
        expect(api.setHp).toHaveBeenCalledWith(expect.objectContaining({ id: 'npc:e1' }), { now: 47, max: 60, temp: 0, tracked: true });
        expect(screen.queryByRole('group', { name: /Hit points/ })).not.toBeInTheDocument();
    });

    test('a weakness makes it hit harder, unless the director turns that off', () => {
        const panel = open();
        fireEvent.change(within(panel).getByLabelText('Damage type'), { target: { value: 'Fire' } });
        expect(within(panel).getByText('52 → 37')).toBeInTheDocument();
        fireEvent.click(within(panel).getByRole('button', { name: 'Apply 15 damage' }));
        expect(api.setHp).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ now: 37 }));
    });

    test('turning the weakness off applies the amount as typed', () => {
        const panel = open();
        fireEvent.change(within(panel).getByLabelText('Damage type'), { target: { value: 'Fire' } });
        fireEvent.click(within(panel).getByRole('checkbox'));
        expect(within(panel).getByRole('button', { name: 'Apply 5 damage' })).toBeInTheDocument();
    });

    test('an immunity stops it', () => {
        const panel = open();
        fireEvent.change(within(panel).getByLabelText('Damage type'), { target: { value: 'Poison' } });
        expect(within(panel).getByRole('button', { name: 'Apply 0 damage' })).toBeInTheDocument();
    });

    test('healing and temporary hit points', () => {
        const panel = open({ current_health: 40 });
        fireEvent.click(within(panel).getByRole('button', { name: 'Heal' }));
        fireEvent.click(within(panel).getByRole('button', { name: 'Set amount to 15' }));
        expect(within(panel).queryByLabelText('Damage type')).not.toBeInTheDocument();
        fireEvent.click(within(panel).getByRole('button', { name: 'Apply 15 healing' }));
        expect(api.setHp).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ now: 55 }));

        fireEvent.click(screen.getByRole('button', { name: /Edit hit points/ }));
        const again = screen.getByRole('group', { name: /Hit points/ });
        fireEvent.click(within(again).getByRole('button', { name: 'Temp HP' }));
        fireEvent.click(within(again).getByRole('button', { name: 'Set amount to 10' }));
        expect(within(again).getByText('0 → 10 temp')).toBeInTheDocument();
        fireEvent.click(within(again).getByRole('button', { name: 'Apply 10 temp HP' }));
        expect(api.setHp).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ temp: 10 }));
    });

    test('Cancel closes it without changing anything', () => {
        const panel = open();
        fireEvent.click(within(panel).getByRole('button', { name: 'Cancel' }));
        expect(screen.queryByRole('group', { name: /Hit points/ })).not.toBeInTheDocument();
        expect(api.setHp).not.toHaveBeenCalled();
    });

    test('a player has no damage type', () => {
        renderTile(player());
        fireEvent.click(screen.getByRole('button', { name: /Edit hit points/ }));
        expect(screen.queryByLabelText('Damage type')).not.toBeInTheDocument();
    });

    test('clicking the hit points again closes it', () => {
        renderTile(foe());
        const button = screen.getByRole('button', { name: /Edit hit points/ });
        fireEvent.click(button);
        fireEvent.click(button);
        expect(screen.queryByRole('group', { name: /Hit points/ })).not.toBeInTheDocument();
    });
});

describe('the statuses edit', () => {
    const open = (statuses, tile = player({ statuses })) => {
        renderTile(tile);
        fireEvent.click(screen.getAllByRole('button', { name: /^Status:/ })[0]);
        return screen.getByRole('group', { name: 'Statuses' });
    };

    test('changes a status\'s count, how long it lasts, or takes it away', () => {
        const panel = open([sound, { id: 'v', name: 'Venomous', stacks: -1 }]);
        fireEvent.click(within(panel).getByRole('button', { name: 'Increase Sound' }));
        expect(api.setStatuses).toHaveBeenLastCalledWith(expect.anything(), [{ ...sound, stacks: 2 }, expect.objectContaining({ id: 'v' })]);
        fireEvent.change(within(panel).getByLabelText('Sound duration'), { target: { value: 'turn' } });
        expect(api.setStatuses).toHaveBeenLastCalledWith(expect.anything(), [{ ...sound, duration: 'turn' }, expect.anything()]);
        fireEvent.click(within(panel).getByRole('button', { name: 'Remove Venomous' }));
        expect(api.setStatuses).toHaveBeenLastCalledWith(expect.anything(), [sound]);
    });

    test('a status with no count has no stepper, and a hand-set modifier has none either', () => {
        const panel = open([{ id: 'v', name: 'Venomous', stacks: -1 }, ...withModifier([], 'strength_stat', { delta: 2 })]);
        expect(within(panel).queryByRole('button', { name: /Increase/ })).not.toBeInTheDocument();
    });

    test('+ Add status opens the status catalog for them', () => {
        const panel = open([sound]);
        fireEvent.click(within(panel).getByRole('button', { name: '+ Add status' }));
        expect(api.addStatus).toHaveBeenCalledWith(expect.objectContaining({ id: 'character:c1' }));
    });

    test('Done closes it', () => {
        const panel = open([sound]);
        fireEvent.click(within(panel).getByRole('button', { name: 'Done' }));
        expect(screen.queryByRole('group', { name: 'Statuses' })).not.toBeInTheDocument();
    });
});

describe('the armor class edit', () => {
    test('sets a modifier with a reason and how long it lasts, and shows the total before applying it', () => {
        renderTile(player());
        fireEvent.click(screen.getByRole('button', { name: 'Armor class 13, edit' }));
        const panel = screen.getByRole('group', { name: 'Armor class' });
        fireEvent.click(within(panel).getByRole('button', { name: 'Increase AC modifier' }));
        fireEvent.change(within(panel).getByLabelText('Reason'), { target: { value: 'Raised shield' } });
        fireEvent.change(within(panel).getByLabelText('Modifier duration'), { target: { value: 'round' } });
        expect(within(panel).getByText('14')).toBeInTheDocument();
        fireEvent.click(within(panel).getByRole('button', { name: 'Apply' }));
        expect(api.setStatuses).toHaveBeenCalledWith(expect.objectContaining({ id: 'character:c1' }), [expect.objectContaining({ id: 'mod:base_armor_class', name: 'Raised shield +1', duration: 'round' })]);
        expect(screen.queryByRole('group', { name: 'Armor class' })).not.toBeInTheDocument();
    });

    test('an existing modifier starts as it is, and Clear takes it away', () => {
        renderTile(player({ statuses: withModifier([], 'base_armor_class', { delta: 2, reason: 'Cover' }) }));
        fireEvent.click(screen.getByRole('button', { name: 'Armor class 15, edit' }));
        const panel = screen.getByRole('group', { name: 'Armor class' });
        expect(within(panel).getByLabelText('Reason')).toHaveValue('Cover');
        fireEvent.click(within(panel).getByRole('button', { name: 'Clear' }));
        expect(api.setStatuses).toHaveBeenCalledWith(expect.anything(), []);
    });
});

describe('the resources edit', () => {
    const open = tile => {
        renderTile(tile);
        fireEvent.click(screen.getByRole('button', { name: /Action points:/ }));
        return screen.getByRole('group', { name: 'Resources' });
    };

    test('spends, refills and changes action points, in steps and in one go', () => {
        const panel = open(player());
        fireEvent.click(within(panel).getByRole('button', { name: 'Increase AP' }));
        expect(api.setAp).toHaveBeenLastCalledWith(expect.anything(), 2);
        fireEvent.click(within(panel).getByRole('button', { name: 'Reset action points to 4' }));
        expect(api.setAp).toHaveBeenLastCalledWith(expect.anything(), 4);
        fireEvent.click(within(panel).getByRole('button', { name: 'Spend one action point' }));
        expect(api.setAp).toHaveBeenLastCalledWith(expect.anything(), 0);
        expect(within(panel).getByRole('button', { name: 'Spend two action points' })).toBeDisabled();
    });

    test('toggles the reaction and changes hero points for a player', () => {
        const panel = open(player());
        fireEvent.click(within(panel).getByRole('checkbox', { name: 'Reaction ready' }));
        expect(api.setReaction).toHaveBeenCalledWith(expect.anything(), false);
        fireEvent.click(within(panel).getByRole('button', { name: 'Increase hero points' }));
        expect(api.setHero).toHaveBeenCalledWith(expect.anything(), 2);
    });

    test('an enemy has no hero points here', () => {
        const panel = open(foe());
        expect(within(panel).queryByText('Hero points')).not.toBeInTheDocument();
    });

    test('hero points open the same panel', () => {
        renderTile(player());
        fireEvent.click(screen.getByRole('button', { name: 'Hero points: 1' }));
        expect(screen.getByRole('group', { name: 'Resources' })).toBeInTheDocument();
    });
});

describe('the ability edit', () => {
    test('an enemy\'s base can be changed, with what its statuses do shown, and a modifier added', () => {
        renderTile(foe({ statuses: [sound] }));
        fireEvent.click(screen.getByRole('button', { name: 'Strength +8 (base +9), edit' }));
        const panel = screen.getByRole('group', { name: 'Strength' });
        expect(within(panel).getByText('Sound')).toBeInTheDocument();
        fireEvent.click(within(panel).getByRole('button', { name: 'Increase base Strength' }));
        expect(api.setBaseStat).toHaveBeenCalledWith(expect.objectContaining({ id: 'npc:e1' }), 'strength_stat', 10);
        fireEvent.click(within(panel).getByRole('button', { name: 'Increase Strength modifier' }));
        expect(within(panel).getAllByText('+9').length).toBeGreaterThan(0);
        fireEvent.click(within(panel).getByRole('button', { name: 'Apply' }));
        expect(api.setStatuses).toHaveBeenCalledWith(expect.anything(), [sound, expect.objectContaining({ id: 'mod:strength_stat', name: 'STR +1' })]);
    });

    test('a player\'s base cannot be changed from here - only their sheet owns it', () => {
        renderTile(player());
        fireEvent.click(screen.getByRole('button', { name: 'Strength +1, edit' }));
        const panel = screen.getByRole('group', { name: 'Strength' });
        expect(within(panel).queryByRole('button', { name: /base Strength/ })).not.toBeInTheDocument();
        fireEvent.click(within(panel).getByRole('button', { name: 'Clear' }));
        expect(api.setStatuses).toHaveBeenCalledWith(expect.anything(), []);
    });

    test('one panel at a time: opening another closes the first', () => {
        renderTile(player());
        fireEvent.click(screen.getByRole('button', { name: 'Strength +1, edit' }));
        fireEvent.click(screen.getByRole('button', { name: 'Armor class 13, edit' }));
        expect(screen.queryByRole('group', { name: 'Strength' })).not.toBeInTheDocument();
        expect(screen.getByRole('group', { name: 'Armor class' })).toBeInTheDocument();
    });
});

describe('a group of minions', () => {
    const goons = [1, 2, 3].map(n => ({ id: `g${n}`, enemy_name: `Goober ${n}`, enemy_type: 'Regular', level: 1, current_health: 4, maximum_health: 4, action_points: 3, base_armor_class: 14,
        strength_stat: 2, dexterity_stat: 0, intelligence_stat: 0, charisma_stat: 0, statuses: [] }));
    const group = extra => enemyTiles(goons.map((goon, index) => (index === 2 ? { ...goon, ...extra } : goon)))[0];

    test('is one tile named for how many are standing, with a pip of hit points for each', () => {
        renderTile(group({ current_health: 1 }));
        expect(screen.getByRole('button', { name: 'Open Goober ×3 details' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Goober 3: 1 of 4 hit points' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Action points/ })).not.toBeInTheDocument();
    });

    test('a minion that is down shows as down, and the group is named without it', () => {
        renderTile(group({ current_health: 0 }));
        expect(screen.getByRole('button', { name: 'Goober 3: 0 of 4 hit points (down)' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Open Goober ×2 details' })).toBeInTheDocument();
    });

    test('the name opens the drawer for the whole group', () => {
        const tile = group();
        renderTile(tile);
        fireEvent.click(screen.getByRole('button', { name: 'Open Goober ×3 details' }));
        expect(api.openDrawer).toHaveBeenCalledWith('npc:g1', tile.key);
    });

    test('a pip opens the hit points edit for that minion alone', () => {
        renderTile(group());
        fireEvent.click(screen.getByRole('button', { name: 'Goober 2: 4 of 4 hit points' }));
        const panel = screen.getByRole('group', { name: 'Hit points: Goober 2' });
        fireEvent.click(within(panel).getByRole('button', { name: 'Apply 5 damage' }));
        expect(api.setHp).toHaveBeenCalledWith(expect.objectContaining({ id: 'npc:g2' }), { now: 0, max: 4, temp: 0, tracked: true });
    });

    test('clicking the same pip again closes it', () => {
        renderTile(group());
        const pip = screen.getByRole('button', { name: 'Goober 2: 4 of 4 hit points' });
        fireEvent.click(pip);
        fireEvent.click(pip);
        expect(screen.queryByRole('group', { name: /Hit points/ })).not.toBeInTheDocument();
    });

    test('an armor class modifier or a base change goes to every one of them', () => {
        renderTile(group());
        fireEvent.click(screen.getByRole('button', { name: 'Armor class 14, edit' }));
        fireEvent.click(screen.getByRole('button', { name: 'Increase AC modifier' }));
        fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
        expect(api.setStatuses).toHaveBeenCalledTimes(3);
        expect(api.setStatuses.mock.calls.map(call => call[0].id)).toEqual(['npc:g1', 'npc:g2', 'npc:g3']);

        fireEvent.click(screen.getByRole('button', { name: 'Strength +2, edit' }));
        fireEvent.click(screen.getByRole('button', { name: 'Increase base Strength' }));
        expect(api.setBaseStat).toHaveBeenCalledTimes(3);
    });

    test('group statuses are the group\'s, written to each of them', () => {
        const tile = enemyTiles(goons.map(goon => ({ ...goon, statuses: [sound] })))[0];
        renderTile(tile);
        fireEvent.click(screen.getAllByRole('button', { name: /^Status:/ })[0]);
        fireEvent.click(screen.getByRole('button', { name: 'Remove Sound' }));
        expect(api.setStatuses).toHaveBeenCalledTimes(3);
    });
});

describe('the circles of action points', () => {
    test('clicking one gives that many, and the last filled one spends itself, as on the character page', () => {
        renderTile(player({ action_points: 2 }));
        fireEvent.click(screen.getByRole('button', { name: 'Action point 4' }));
        expect(api.setAp).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'character:c1' }), 4);
        fireEvent.click(screen.getByRole('button', { name: 'Action point 2' }));
        expect(api.setAp).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'character:c1' }), 1);
        expect(screen.getByRole('button', { name: 'Action point 2' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('button', { name: 'Action point 3' })).toHaveAttribute('aria-pressed', 'false');
    });

    test('the fourth is the one haste gives, and has a colour of its own', () => {
        renderTile(player({ action_points: 3 }));
        expect(screen.getByRole('button', { name: 'Action point 4' }).firstChild).toHaveClass('Entity-dot-haste');
        expect(screen.getByRole('button', { name: 'Action point 3' }).firstChild).not.toHaveClass('Entity-dot-haste');
    });

    test('an enemy has four, for the one with haste, and the label still opens the resources', () => {
        renderTile(foe({ action_points: 3 }));
        expect(screen.getAllByRole('button', { name: /^Action point \d$/ })).toHaveLength(4);
        fireEvent.click(screen.getByRole('button', { name: 'Action point 3' }));
        expect(api.setAp).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'npc:e1' }), 2);
        fireEvent.click(screen.getByRole('button', { name: 'Action points: 3 of 4, edit' }));
        expect(screen.getByRole('group', { name: 'Resources' })).toBeInTheDocument();
    });
});

describe('closing a popover by clicking away', () => {
    test('a click anywhere else closes it, and one inside it does not', () => {
        renderTile(player());
        fireEvent.click(screen.getByRole('button', { name: 'Strength +1, edit' }));
        const panel = screen.getByRole('group', { name: /Strength/ });
        fireEvent.mouseDown(within(panel).getByText(/Strength/, { selector: 'span' }));
        expect(screen.getByRole('group', { name: /Strength/ })).toBeInTheDocument();
        fireEvent.mouseDown(document.body);
        expect(screen.queryByRole('group', { name: /Strength/ })).not.toBeInTheDocument();
    });

    test('a click on a button of the same tile is left to that button, so the one that opened it can close it', () => {
        renderTile(player());
        const strength = screen.getByRole('button', { name: 'Strength +1, edit' });
        fireEvent.click(strength);
        fireEvent.mouseDown(strength);
        fireEvent.click(strength);
        expect(screen.queryByRole('group', { name: /Strength/ })).not.toBeInTheDocument();
        fireEvent.click(strength);
        fireEvent.mouseDown(screen.getByRole('button', { name: 'Armor class 13, edit' }));
        fireEvent.click(screen.getByRole('button', { name: 'Armor class 13, edit' }));
        expect(screen.queryByRole('group', { name: /Strength/ })).not.toBeInTheDocument();
        expect(screen.getByRole('group', { name: /Armor class/ })).toBeInTheDocument();
    });
});

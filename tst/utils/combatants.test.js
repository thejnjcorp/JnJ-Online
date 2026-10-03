import {
    AC_STAT, DURATIONS, abilityLabel, adjustDamage, applyHp, chipLabel, durationLabel, enemyCombatant, enemyKind, enemyTiles, groupName, hpRatio, hpTone,
    modifierId, modifierOf, playerCombatant, signed, statName, statusContributions, withModifier, withoutCount, withoutEnded,
} from '../../src/utils/combatants';

const character = (fields = {}) => ({
    character_id: 'c1', character_name: 'Leon', class_name: 'Fighter', race_name: 'Human',
    current_health: 11, maximum_health: 20, temporary_health: 0, action_points: 1, base_armor_class: 13, hero_points: 2,
    strength_stat: 2, dexterity_stat: 3, intelligence_stat: 1, charisma_stat: 0, statuses: [], ...fields,
});
const enemy = (fields = {}) => ({
    id: 'e1', enemy_name: 'Grinch Goober 1', enemy_type: 'Regular', current_health: 4, maximum_health: 4, action_points: 3, base_armor_class: 14,
    strength_stat: 2, dexterity_stat: 3, intelligence_stat: 0, charisma_stat: 0, statuses: [], ...fields,
});
const soundStatus = { id: 's', name: 'Sound', stacks: 1, effects: ['strength_stat', 'dexterity_stat', 'intelligence_stat', 'charisma_stat'].map(stat => ({ stat, trigger: 'passive', mode: 'flat', delta: -1 })) };

describe('signed', () => {
    test('writes a modifier with its sign, a real minus for a negative', () => {
        expect(signed(3)).toBe('+3');
        expect(signed(0)).toBe('+0');
        expect(signed(-2)).toBe('−2');
        expect(signed('x')).toBe('+0');
    });
});

describe('playerCombatant', () => {
    test('has the facts a tile shows', () => {
        const player = playerCombatant(character());
        expect(player).toMatchObject({
            id: 'character:c1', kind: 'player', name: 'Leon', subtitle: 'Fighter · Human', ac: 13, acBase: 13, hero: 2, reactionReady: true, down: false,
            hp: { now: 11, max: 20, temp: 0, tracked: true }, ap: { now: 1, max: 4 },
        });
        expect(player.abilities.map(ability => [ability.key, ability.value])).toEqual([['STR', 2], ['DEX', 3], ['INT', 1], ['CHR', 0]]);
    });

    test('counts what its statuses do: the effective modifier, and how far it is from the base', () => {
        const player = playerCombatant(character({ statuses: [soundStatus] }));
        expect(player.abilities[0]).toMatchObject({ base: 2, value: 1, delta: -1 });
    });

    test('is down at 0 hit points, has used its reaction when it says so, and defaults to 1 hero point', () => {
        const player = playerCombatant(character({ current_health: 0, reaction_used: true, hero_points: undefined }));
        expect(player).toMatchObject({ down: true, reactionReady: false, hero: 1 });
    });

    test('an armor class modifier is in the total but not the base', () => {
        const mod = withModifier([], AC_STAT, { delta: 1 });
        expect(playerCombatant(character({ statuses: mod }))).toMatchObject({ ac: 14, acBase: 13 });
    });
});

describe('enemyCombatant', () => {
    test('is an enemy with its tier, weaknesses and a maximum for its action points', () => {
        const goblin = enemyCombatant(enemy({ Weaknesses: ['Fire 5'], action_points: 1, max_action_points: 4 }));
        expect(goblin).toMatchObject({ id: 'npc:e1', kind: 'enemy', tier: 'Regular', weaknesses: ['Fire 5'], hero: null, ap: { now: 1, max: 4 } });
    });

    test('an enemy has four circles like a player (it may be hasted), and gets back what it started with', () => {
        expect(enemyCombatant(enemy({ action_points: 1, max_action_points: 3 })).ap).toEqual({ now: 1, max: 4, refresh: 3 });
        expect(enemyCombatant(enemy({ action_points: 5 })).ap.max).toBe(5);
        expect(enemyCombatant(enemy({ action_points: 1 })).ap.refresh).toBe(3);
    });

    test('without hit points it is not tracked, and a defeated enemy is down', () => {
        expect(enemyCombatant(enemy({ maximum_health: undefined, current_health: undefined })).hp.tracked).toBe(false);
        expect(enemyCombatant(enemy({ defeated: true })).down).toBe(true);
    });
});

describe('enemyTiles', () => {
    const goons = [1, 2, 3].map(n => enemy({ id: `g${n}`, enemy_name: `Grinch Goober ${n}` }));

    test('minions of one kind are one group tile, with every other enemy on its own', () => {
        const tiles = enemyTiles([enemy({ id: 'boss', enemy_name: 'Saph', enemy_type: 'Captain' }), ...goons]);
        expect(tiles.map(tile => [tile.kind, tile.key])).toEqual([['single', 'npc:boss'], ['group', 'group:Regular:Grinch Goober']]);
        expect(tiles[1].members).toHaveLength(3);
    });

    test('a single minion is not a group, and elites are never grouped', () => {
        expect(enemyTiles([goons[0]])[0].kind).toBe('single');
        const elites = [1, 2].map(n => enemy({ id: `t${n}`, enemy_name: `Tree ${n}`, enemy_type: 'Elite' }));
        expect(enemyTiles(elites).map(tile => tile.kind)).toEqual(['single', 'single']);
    });

    test('enemies staged from the same template are grouped by it, whatever their names', () => {
        const twins = [enemy({ id: 'a', enemy_name: 'Bandit', templateId: 't1' }), enemy({ id: 'b', enemy_name: 'Rogue', templateId: 't1' })];
        expect(enemyTiles(twins)).toHaveLength(1);
        expect(enemyKind(twins[0])).toBe('t1');
    });

    test('the group is named for how many are standing', () => {
        const members = enemyTiles([goons[0], goons[1], { ...goons[2], current_health: 0 }])[0].members;
        expect(groupName(members)).toBe('Grinch Goober ×2');
    });
});

describe('hit points', () => {
    const hp = { now: 10, max: 20, temp: 3, tracked: true };

    test('damage takes temporary hit points first, and stops at 0', () => {
        expect(applyHp(hp, 5, 'damage')).toMatchObject({ now: 8, temp: 0 });
        expect(applyHp(hp, 2, 'damage')).toMatchObject({ now: 10, temp: 1 });
        expect(applyHp(hp, 99, 'damage')).toMatchObject({ now: 0, temp: 0 });
    });

    test('healing stops at the maximum, and temporary hit points do not add up', () => {
        expect(applyHp(hp, 4, 'heal')).toMatchObject({ now: 14 });
        expect(applyHp(hp, 99, 'heal')).toMatchObject({ now: 20 });
        expect(applyHp(hp, 2, 'temp').temp).toBe(3);
        expect(applyHp(hp, 8, 'temp').temp).toBe(8);
    });

    test('an amount that is not a number does nothing, and a negative one is nothing', () => {
        expect(applyHp(hp, 'x', 'damage')).toEqual(hp);
        expect(applyHp(hp, -5, 'heal')).toEqual(hp);
    });

    test('the bar fills in proportion, and turns from good to hurt to low', () => {
        expect(hpRatio({ now: 5, max: 20 })).toBe(0.25);
        expect(hpRatio({ now: 5, max: 0 })).toBe(0);
        expect(hpRatio({ now: 30, max: 20 })).toBe(1);
        expect([20, 13, 12, 11, 5, 0].map(now => hpTone({ now, max: 20 }))).toEqual(['good', 'good', 'hurt', 'hurt', 'low', 'low']);
    });
});

describe('adjustDamage', () => {
    const tree = { weaknesses: ['Fire 10'], resistances: ['Cold 4'], immunities: ['Poison'] };

    test('a weakness adds its amount, a resistance takes it off, an immunity stops it', () => {
        expect(adjustDamage(tree, 'Fire', 5)).toEqual({ amount: 15, note: { kind: 'weakness', text: 'Weakness: Fire 10' } });
        expect(adjustDamage(tree, 'Cold', 10)).toEqual({ amount: 6, note: { kind: 'resistance', text: 'Resistance: Cold 4' } });
        expect(adjustDamage(tree, 'Cold', 3).amount).toBe(0);
        expect(adjustDamage(tree, 'poison', 7)).toEqual({ amount: 0, note: { kind: 'immunity', text: 'Immune: poison' } });
    });

    test('any other type, or any type at all, is taken as it comes', () => {
        expect(adjustDamage(tree, 'Physical', 5)).toEqual({ amount: 5, note: null });
        expect(adjustDamage(tree, 'Any', 5)).toEqual({ amount: 5, note: null });
        expect(adjustDamage(tree, '', 5).amount).toBe(5);
        expect(adjustDamage({}, 'Fire', 5).amount).toBe(5);
    });

    test('a weakness with no number is not applied', () => {
        expect(adjustDamage({ weaknesses: ['Fire'] }, 'Fire', 5).amount).toBe(5);
    });
});

describe('hand-set modifiers', () => {
    test('are ordinary statuses with one passive effect, replacing the last one for that stat', () => {
        const first = withModifier([], 'strength_stat', { delta: 2, duration: 'turn', reason: 'Rage' });
        expect(first).toHaveLength(1);
        expect(first[0]).toMatchObject({ id: modifierId('strength_stat'), name: 'Rage +2', duration: 'turn', modifier: true, polarity: 'buff' });
        const second = withModifier(first, 'strength_stat', { delta: -1 });
        expect(second).toHaveLength(1);
        expect(second[0]).toMatchObject({ name: 'STR −1', polarity: 'debuff', duration: 'scene' });
    });

    test('a modifier of nothing takes it away and leaves every other status alone', () => {
        const other = { id: 'x', name: 'Prone' };
        const statuses = withModifier([other], AC_STAT, { delta: 1 });
        expect(withModifier(statuses, AC_STAT, { delta: 0 })).toEqual([other]);
    });

    test('is found again by its stat', () => {
        const statuses = withModifier([], AC_STAT, { delta: 1 });
        expect(modifierOf(statuses, AC_STAT)).toBe(statuses[0]);
        expect(modifierOf(statuses, 'strength_stat')).toBeNull();
        expect(modifierOf(undefined, AC_STAT)).toBeNull();
    });

    test('what the statuses are doing to a stat, apart from the hand-set one', () => {
        const statuses = [soundStatus, ...withModifier([], 'strength_stat', { delta: 3 })];
        expect(statusContributions(statuses, 'strength_stat')).toEqual([{ name: 'Sound', delta: -1 }]);
        expect(statusContributions(statuses, 'base_armor_class')).toEqual([]);
        expect(statusContributions(undefined, 'strength_stat')).toEqual([]);
    });

    test('names a stat as the tile does', () => {
        expect(statName(AC_STAT)).toBe('AC');
        expect(statName('charisma_stat')).toBe('CHR');
        expect(statName('hardness')).toBe('hardness');
    });
});

describe('durations and chips', () => {
    test('statuses that end with the turn, the round or the scene are taken away, the others stay', () => {
        const statuses = [{ id: 'a', duration: 'turn' }, { id: 'b', duration: 'scene' }, { id: 'c', duration: 'removed' }, { id: 'd' }];
        expect(withoutEnded(statuses, ['turn']).map(status => status.id)).toEqual(['b', 'c', 'd']);
        expect(withoutEnded(statuses, ['turn', 'scene']).map(status => status.id)).toEqual(['c', 'd']);
        expect(withoutEnded(undefined, ['turn'])).toEqual([]);
    });

    test('knows the durations by name', () => {
        expect(DURATIONS).toHaveLength(4);
        expect(durationLabel('scene')).toBe('Rest of scene');
        expect(durationLabel('nonsense')).toBe('Until removed');
    });

    test('a chip shows the status name with its count where it has one', () => {
        expect(chipLabel({ name: 'Slowed', stacks: 2 })).toBe('Slowed 2');
        expect(chipLabel({ name: 'Prone', stacks: -1 })).toBe('Prone');
        expect(chipLabel({ name: 'Rage +2', stacks: 1, modifier: true })).toBe('Rage +2');
    });
});

describe('withoutCount', () => {
    it('drops the number that tells copies apart', () => {
        expect(withoutCount('Grinch Goober 3')).toBe('Grinch Goober');
        expect(withoutCount('Goon  12')).toBe('Goon');
    });

    it('leaves names with no trailing count alone', () => {
        expect(withoutCount('Goon')).toBe('Goon');
        expect(withoutCount('Room101')).toBe('Room101');
        expect(withoutCount('42')).toBe('42');
        expect(withoutCount(undefined)).toBe('');
    });
});

describe('abilityLabel', () => {
    it('names the value, and the base only when it was changed', () => {
        expect(abilityLabel({ name: 'Strength', value: 2, base: 2, delta: 0 })).toBe('Strength +2, edit');
        expect(abilityLabel({ name: 'Strength', value: 3, base: 2, delta: 1 })).toBe('Strength +3 (base +2), edit');
    });
});

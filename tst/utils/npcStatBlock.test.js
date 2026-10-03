import { byName, checkText, npcAbilities, npcDefenses, npcVitals, rollCheck, statBlockLine, statBlockOf } from '../../src/utils/npcStatBlock';

const goblin = {
    id: 'e1', enemy_name: 'Goblin', base_armor_class: 12, maximum_health: 7, action_points: 2, base_hit_modifier: 3, hardness: 0,
    base_damage_dice: 2, base_damage_dice_type: 3, base_damage_modifier: -1,
    strength_stat: 2, dexterity_stat: -1, intelligence_stat: 0, charisma_stat: 4,
    Weaknesses: ['Fire 5'], Resistances: [], Immunities: ['Poison'],
};

describe('statBlockOf', () => {
    test('finds the entry a beat names, and nothing for none, an unknown one or no bestiary', () => {
        expect(statBlockOf([goblin], 'e1')).toBe(goblin);
        expect(statBlockOf([goblin], 'gone')).toBeNull();
        expect(statBlockOf([goblin], '')).toBeNull();
        expect(statBlockOf(undefined, 'e1')).toBeNull();
    });
});

describe('byName and statBlockLine', () => {
    test('sorts the bestiary by name without changing it', () => {
        const list = [{ enemy_name: 'Wraith' }, { enemy_name: 'Ash' }, {}];
        expect(byName(list).map(enemy => enemy.enemy_name)).toEqual([undefined, 'Ash', 'Wraith']);
        expect(list[0].enemy_name).toBe('Wraith');
        expect(byName(undefined)).toEqual([]);
    });

    test('says AC, health and action points', () => {
        expect(statBlockLine(goblin)).toBe('AC 12 · 7 HP · 2 AP');
        expect(statBlockLine({})).toBe('AC 0 · 0 HP · 0 AP');
    });
});

describe('npcVitals', () => {
    test('are the numbers a turn is run on, with the damage written out', () => {
        expect(npcVitals(goblin)).toEqual([
            { label: 'AC', value: '12' }, { label: 'HP', value: '7' }, { label: 'AP', value: '2' }, { label: 'To hit', value: '+3' }, { label: 'Damage', value: '2d8-1' },
        ]);
    });

    test('hardness is there only when it is more than none, and damage that is not set is a dash', () => {
        const vitals = npcVitals({ ...goblin, hardness: 3, base_damage_dice: 0 });
        expect(vitals.at(-1)).toEqual({ label: 'Hardness', value: '3' });
        expect(vitals.find(vital => vital.label === 'Damage').value).toBe('—');
    });
});

describe('npcAbilities', () => {
    test('are the four abilities with what each adds to a roll', () => {
        expect(npcAbilities(goblin)).toEqual([
            { key: 'STR', name: 'Strength', modifier: 2 }, { key: 'DEX', name: 'Dexterity', modifier: -1 },
            { key: 'INT', name: 'Intelligence', modifier: 0 }, { key: 'CHR', name: 'Charisma', modifier: 4 },
        ]);
        expect(npcAbilities({}).every(ability => ability.modifier === 0)).toBe(true);
    });
});

describe('npcDefenses', () => {
    test('are those of weaknesses, resistances and immunities that it has any of', () => {
        expect(npcDefenses(goblin)).toEqual([{ label: 'Weak to', entries: ['Fire 5'] }, { label: 'Immune to', entries: ['Poison'] }]);
        expect(npcDefenses({})).toEqual([]);
    });
});

describe('rollCheck', () => {
    test('is a d20 with the modifier added, from 1 to 20', () => {
        expect(rollCheck(2, () => 0)).toEqual({ roll: 1, modifier: 2, total: 3 });
        expect(rollCheck(-1, () => 0.999)).toEqual({ roll: 20, modifier: -1, total: 19 });
        expect(rollCheck(undefined, () => 0.5)).toEqual({ roll: 11, modifier: 0, total: 11 });
    });

    test('is written with its parts', () => {
        expect(checkText({ roll: 7, modifier: -2, total: 5 })).toBe('d20 7 −2 = 5');
        expect(checkText({ roll: 7, modifier: 3, total: 10 })).toBe('d20 7 +3 = 10');
    });
});

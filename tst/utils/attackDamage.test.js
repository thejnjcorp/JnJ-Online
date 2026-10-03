import { attackDamage, attackKind, attackKindLabel, damageText } from '../../src/utils/attackDamage';

const tag = label => ({ id: label, tagInfo: label });

describe('attackKind', () => {
    test('is the Melee or Ranged tag on the action, whatever its case', () => {
        expect(attackKind({ tags: [tag('Fire'), tag('melee')] })).toBe('melee');
        expect(attackKind({ tags: [tag(' RANGED ')] })).toBe('ranged');
    });

    test('is nothing with neither, with both, or with a tag not yet named', () => {
        expect(attackKind({ tags: [tag('Fire')] })).toBeNull();
        expect(attackKind({ tags: [tag('Melee'), tag('Ranged')] })).toBeNull();
        expect(attackKind({ tags: [tag('')] })).toBeNull();
        expect(attackKind({})).toBeNull();
    });

    test('has a label to show', () => {
        expect(attackKindLabel('melee')).toBe('Melee');
        expect(attackKindLabel('ranged')).toBe('Ranged');
        expect(attackKindLabel(null)).toBe('');
    });
});

describe('damageText', () => {
    test('is the dice and die, the modifier with its sign, and the kind of damage', () => {
        expect(damageText(2, 3, 4, 'Fire')).toBe('2d8+4 Fire');
        expect(damageText(1, 2, -1, 'Physical')).toBe('1d6-1 Physical');
        expect(damageText(1, 6, 0, '')).toBe('1d20');
    });

    test('is nothing without dice or with a die that is not one', () => {
        expect(damageText(0, 2, 3, 'x')).toBe('');
        expect(damageText(1, 0, 3, 'x')).toBe('');
        expect(damageText(1, 9, 3, 'x')).toBe('');
    });
});

describe('attackDamage', () => {
    const character = {
        base_damage_modifier: 1, base_damage_dice: 1,
        base_melee_damage_dice: 1, base_melee_damage_dice_type: 2, base_melee_damage_modifier: 1, base_melee_damage_type: 'Physical',
        base_ranged_damage_dice: 2, base_ranged_damage_dice_type: 3, base_ranged_damage_modifier: 0, base_ranged_damage_type: '',
    };
    const base = { dice: 1, modifier: 1 };

    test('is what the class gives for that kind when nothing adds to it', () => {
        expect(attackDamage('melee', character, { DamageDice: 1, DamageModifier: 1 }, base)).toBe('1d6+1 Physical');
        expect(attackDamage('ranged', character, { DamageDice: 1, DamageModifier: 1 }, base)).toBe('2d8');
    });

    test('adds the dice and damage that level, and statuses, bring on top', () => {
        expect(attackDamage('melee', character, { DamageDice: 2, DamageModifier: 4 }, base)).toBe('2d6+4 Physical');
        // a status that takes damage down by 2
        expect(attackDamage('melee', character, { DamageDice: 1, DamageModifier: -1 }, { dice: 1, modifier: -1 })).toBe('1d6-1 Physical');
    });

    test('is nothing for a class that gives no damage of that kind, or no character', () => {
        expect(attackDamage('melee', { base_damage_modifier: 0 }, { DamageDice: 1, DamageModifier: 0 }, base)).toBe('');
        expect(attackDamage('melee', undefined, { DamageDice: 1, DamageModifier: 0 }, base)).toBe('');
    });

    test('works from the stat sheet\'s own modifier when the character has none of its own', () => {
        const noBase = { ...character, base_damage_modifier: undefined };
        expect(attackDamage('melee', noBase, { DamageDice: 1, DamageModifier: 3 }, { dice: 1, modifier: 1 })).toBe('1d6+3 Physical');
    });
});

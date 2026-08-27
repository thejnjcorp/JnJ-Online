import {
    CharacterLevelCalculator,
    CharacterDiceConverter,
    reverseCharacterDiceConverter,
    CharacterStatCalculator,
} from '../../src/components/CharacterStatCalculator';

describe('CharacterLevelCalculator', () => {
    test.each([
        [0, 1],
        [1, 1],
        [999, 1],
        [1000, 2],
        [1999, 2],
        [2000, 3],
        [14999, 15],
        [15000, 16],
    ])('experience=%i -> level %i', (experience, expectedLevel) => {
        expect(CharacterLevelCalculator(experience)).toBe(expectedLevel);
    });
});

describe('CharacterDiceConverter', () => {
    test.each([
        [1, 'd4'],
        [2, 'd6'],
        [3, 'd8'],
        [4, 'd10'],
        [5, 'd12'],
        [6, 'd20'],
    ])('code %i -> %s', (code, expected) => {
        expect(CharacterDiceConverter(code)).toBe(expected);
    });

    test.each([0, 7, -1, undefined, null, 'x'])('unrecognized code %p -> "N/A"', (code) => {
        expect(CharacterDiceConverter(code)).toBe('N/A');
    });
});

describe('reverseCharacterDiceConverter', () => {
    test.each([
        ['d4', 1],
        ['d6', 2],
        ['d8', 3],
        ['d10', 4],
        ['d12', 5],
        ['d20', 6],
    ])('%s -> code %i', (die, expected) => {
        expect(reverseCharacterDiceConverter(die)).toBe(expected);
    });

    test.each(['d100', '', undefined, null, 'd4 '])('unrecognized die %p -> 0', (die) => {
        expect(reverseCharacterDiceConverter(die)).toBe(0);
    });

    test('round-trips with CharacterDiceConverter for every real die code', () => {
        for (let code = 1; code <= 6; code++) {
            expect(reverseCharacterDiceConverter(CharacterDiceConverter(code))).toBe(code);
        }
    });
});

describe('CharacterStatCalculator', () => {
    // baseArmorClass=10, baseHitModifier=1, baseDamageModifier=2,
    // baseDamageDice=1, baseDamageDiceType=1, baseHealingDiceType=1
    const BASE_ARMOR_CLASS = 10;
    const BASE_HIT_MODIFIER = 1;
    const BASE_DAMAGE_MODIFIER = 2;
    const BASE_DAMAGE_DICE = 1;
    const BASE_DAMAGE_DICE_TYPE = 1;
    const BASE_HEALING_DICE_TYPE = 1;

    function statsAtLevel(level) {
        // CharacterLevelCalculator gives level = floor(experience/1000) + 1,
        // so experience = (level - 1) * 1000 lands exactly on that level.
        const experience = (level - 1) * 1000;
        return CharacterStatCalculator(
            experience,
            BASE_ARMOR_CLASS,
            BASE_HIT_MODIFIER,
            BASE_DAMAGE_MODIFIER,
            BASE_DAMAGE_DICE,
            BASE_DAMAGE_DICE_TYPE,
            BASE_HEALING_DICE_TYPE
        );
    }

    // Expected values transcribed directly from the level-by-level deltas in
    // CharacterStatCalculator, applied on top of the base stats above (with
    // baseClassDifficultyClass=14, baseHealingDice=1, baseHealingModifier=2,
    // baseAttuneRelics=2, all fixed inside the function itself).
    const EXPECTED_BY_LEVEL = {
        1: { ArmorClass: 10, HitModifier: 1, DamageModifier: 2, DamageDice: 1, DamageDiceType: 1, HealingModifier: 2, HealingDice: 1, HealingDiceType: 1, ClassDifficultyClass: 14, AttuneRelics: 2 },
        2: { ArmorClass: 10, HitModifier: 2, DamageModifier: 2, DamageDice: 1, DamageDiceType: 1, HealingModifier: 2, HealingDice: 1, HealingDiceType: 1, ClassDifficultyClass: 15, AttuneRelics: 2 },
        3: { ArmorClass: 10, HitModifier: 2, DamageModifier: 4, DamageDice: 1, DamageDiceType: 1, HealingModifier: 4, HealingDice: 2, HealingDiceType: 1, ClassDifficultyClass: 15, AttuneRelics: 2 },
        4: { ArmorClass: 11, HitModifier: 2, DamageModifier: 4, DamageDice: 1, DamageDiceType: 1, HealingModifier: 4, HealingDice: 2, HealingDiceType: 1, ClassDifficultyClass: 15, AttuneRelics: 2 },
        5: { ArmorClass: 11, HitModifier: 2, DamageModifier: 4, DamageDice: 2, DamageDiceType: 1, HealingModifier: 4, HealingDice: 2, HealingDiceType: 2, ClassDifficultyClass: 15, AttuneRelics: 2 },
        6: { ArmorClass: 11, HitModifier: 3, DamageModifier: 4, DamageDice: 2, DamageDiceType: 1, HealingModifier: 4, HealingDice: 2, HealingDiceType: 2, ClassDifficultyClass: 16, AttuneRelics: 3 },
        7: { ArmorClass: 11, HitModifier: 3, DamageModifier: 6, DamageDice: 2, DamageDiceType: 1, HealingModifier: 6, HealingDice: 3, HealingDiceType: 2, ClassDifficultyClass: 16, AttuneRelics: 3 },
        8: { ArmorClass: 11, HitModifier: 3, DamageModifier: 6, DamageDice: 2, DamageDiceType: 1, HealingModifier: 6, HealingDice: 3, HealingDiceType: 2, ClassDifficultyClass: 16, AttuneRelics: 3 },
        9: { ArmorClass: 12, HitModifier: 3, DamageModifier: 7, DamageDice: 2, DamageDiceType: 2, HealingModifier: 7, HealingDice: 3, HealingDiceType: 3, ClassDifficultyClass: 16, AttuneRelics: 3 },
        10: { ArmorClass: 12, HitModifier: 3, DamageModifier: 7, DamageDice: 3, DamageDiceType: 2, HealingModifier: 7, HealingDice: 3, HealingDiceType: 3, ClassDifficultyClass: 16, AttuneRelics: 3 },
        11: { ArmorClass: 12, HitModifier: 4, DamageModifier: 7, DamageDice: 3, DamageDiceType: 2, HealingModifier: 7, HealingDice: 3, HealingDiceType: 3, ClassDifficultyClass: 17, AttuneRelics: 4 },
        12: { ArmorClass: 12, HitModifier: 4, DamageModifier: 9, DamageDice: 3, DamageDiceType: 2, HealingModifier: 9, HealingDice: 4, HealingDiceType: 3, ClassDifficultyClass: 17, AttuneRelics: 4 },
        13: { ArmorClass: 12, HitModifier: 4, DamageModifier: 9, DamageDice: 3, DamageDiceType: 2, HealingModifier: 9, HealingDice: 4, HealingDiceType: 3, ClassDifficultyClass: 17, AttuneRelics: 4 },
        14: { ArmorClass: 13, HitModifier: 4, DamageModifier: 10, DamageDice: 3, DamageDiceType: 3, HealingModifier: 10, HealingDice: 4, HealingDiceType: 3, ClassDifficultyClass: 17, AttuneRelics: 4 },
        15: { ArmorClass: 13, HitModifier: 5, DamageModifier: 10, DamageDice: 4, DamageDiceType: 3, HealingModifier: 10, HealingDice: 4, HealingDiceType: 4, ClassDifficultyClass: 18, AttuneRelics: 4 },
    };

    test.each(Object.keys(EXPECTED_BY_LEVEL).map(Number))('level %i matches the expected stat block', (level) => {
        expect(statsAtLevel(level)).toEqual(EXPECTED_BY_LEVEL[level]);
    });

    test('level 16+ (no explicit case) falls back to the same block as level 15', () => {
        expect(statsAtLevel(16)).toEqual(EXPECTED_BY_LEVEL[15]);
        expect(statsAtLevel(50)).toEqual(EXPECTED_BY_LEVEL[15]);
    });

    test('merged case pairs produce identical output (7/8, 12/13)', () => {
        expect(statsAtLevel(7)).toEqual(statsAtLevel(8));
        expect(statsAtLevel(12)).toEqual(statsAtLevel(13));
    });

    test('every returned stat block has the same 10 fields, all numbers', () => {
        const expectedKeys = ['ArmorClass', 'HitModifier', 'DamageModifier', 'DamageDice', 'DamageDiceType', 'HealingModifier', 'HealingDice', 'HealingDiceType', 'ClassDifficultyClass', 'AttuneRelics'].sort();
        for (let level = 1; level <= 16; level++) {
            const stats = statsAtLevel(level);
            expect(Object.keys(stats).sort()).toEqual(expectedKeys);
            for (const key of expectedKeys) {
                expect(typeof stats[key]).toBe('number');
            }
        }
    });
});

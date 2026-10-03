import { FLAW_LEVELS, SKILL_LEVELS, levelOf, levelsFor, modifierOf } from '../../src/utils/skillsAndFlaws';

describe('levelsFor', () => {
    test('a skill uses the skill levels, a flaw the flaw levels', () => {
        expect(levelsFor(true)).toBe(SKILL_LEVELS);
        expect(levelsFor(false)).toBe(FLAW_LEVELS);
    });
});

describe('levelOf', () => {
    test('a real level key is returned as-is', () => {
        expect(levelOf({ isSkill: true, level: 'trained' })).toEqual({ key: 'trained', label: 'Trained', modifier: 3 });
        expect(levelOf({ isSkill: false, level: 'ptsd' })).toEqual({ key: 'ptsd', label: 'PTSD', modifier: 5 });
    });

    test('no level falls back to the first level', () => {
        expect(levelOf({ isSkill: true })).toEqual(SKILL_LEVELS[0]);
        expect(levelOf({ isSkill: false })).toEqual(FLAW_LEVELS[0]);
    });

    test('a level key that no longer exists is treated the same as missing', () => {
        expect(levelOf({ isSkill: true, level: 'nonsense' })).toEqual(SKILL_LEVELS[0]);
    });
});

describe('modifierOf', () => {
    test('is the resolved level\'s modifier', () => {
        expect(modifierOf({ isSkill: true, level: 'ultimate' })).toBe(5);
        expect(modifierOf({ isSkill: false, level: 'flaw' })).toBe(3);
    });
});

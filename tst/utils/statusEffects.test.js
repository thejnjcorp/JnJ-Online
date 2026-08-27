import {
    ADMIN_UIDS,
    STATUS_STAT_DEFINITIONS,
    getEffectsArray,
    getEffectiveCharacterStats,
    getPassiveDelta,
    getGrantedActions,
    advanceTurnStatuses,
} from '../../src/utils/statusEffects';

describe('ADMIN_UIDS / STATUS_STAT_DEFINITIONS', () => {
    test('ADMIN_UIDS is a non-empty array of strings', () => {
        expect(Array.isArray(ADMIN_UIDS)).toBe(true);
        expect(ADMIN_UIDS.length).toBeGreaterThan(0);
        ADMIN_UIDS.forEach(uid => expect(typeof uid).toBe('string'));
    });

    test('every STATUS_STAT_DEFINITIONS entry has a key, label, and non-empty triggers list', () => {
        expect(STATUS_STAT_DEFINITIONS.length).toBeGreaterThan(0);
        STATUS_STAT_DEFINITIONS.forEach(def => {
            expect(typeof def.key).toBe('string');
            expect(typeof def.label).toBe('string');
            expect(Array.isArray(def.triggers)).toBe(true);
            expect(def.triggers.length).toBeGreaterThan(0);
        });
    });
});

describe('getEffectsArray', () => {
    test('returns status.effects as-is when it is already an array', () => {
        const effects = [{ stat: 'hardness', delta: 1 }];
        expect(getEffectsArray({ effects })).toBe(effects);
    });

    test('wraps a legacy single status.effect object in an array', () => {
        const effect = { stat: 'hardness', delta: 1 };
        expect(getEffectsArray({ effect })).toEqual([effect]);
    });

    test('returns an empty array when neither effects nor effect is present', () => {
        expect(getEffectsArray({})).toEqual([]);
    });

    test('prefers effects over a legacy effect if both are somehow present', () => {
        const effects = [{ stat: 'a' }];
        const effect = { stat: 'b' };
        expect(getEffectsArray({ effects, effect })).toBe(effects);
    });
});

describe('getEffectiveCharacterStats', () => {
    const baseCharacter = {
        base_armor_class: 10,
        base_hit_modifier: 2,
        base_damage_modifier: 3,
        hardness: 0,
        strength_stat: 10,
        dexterity_stat: 10,
        intelligence_stat: 10,
        charisma_stat: 10,
        statuses: [],
    };

    test('with no statuses, every stat passes through unchanged', () => {
        expect(getEffectiveCharacterStats(baseCharacter)).toEqual(baseCharacter);
    });

    test('a flat passive effect adds its delta to only the targeted stat', () => {
        const character = {
            ...baseCharacter,
            statuses: [{
                stacks: 1,
                effects: [{ stat: 'base_armor_class', trigger: 'passive', mode: 'flat', delta: 2 }],
            }],
        };
        const result = getEffectiveCharacterStats(character);
        expect(result.base_armor_class).toBe(12);
        expect(result.base_hit_modifier).toBe(baseCharacter.base_hit_modifier);
    });

    test('multiple statuses targeting the same stat stack additively', () => {
        const character = {
            ...baseCharacter,
            statuses: [
                { stacks: 1, effects: [{ stat: 'strength_stat', trigger: 'passive', delta: 2 }] },
                { stacks: 1, effects: [{ stat: 'strength_stat', trigger: 'passive', delta: -1 }] },
            ],
        };
        expect(getEffectiveCharacterStats(character).strength_stat).toBe(11);
    });

    test('a turn_start effect is never applied passively, even if targeting a passive-eligible stat', () => {
        const character = {
            ...baseCharacter,
            statuses: [{
                stacks: 3,
                effects: [{ stat: 'base_armor_class', trigger: 'turn_start', delta: 5 }],
            }],
        };
        expect(getEffectiveCharacterStats(character).base_armor_class).toBe(baseCharacter.base_armor_class);
    });

    test('a non-numeric delta is treated as 0 rather than NaN-poisoning the total', () => {
        const character = {
            ...baseCharacter,
            statuses: [{
                stacks: 1,
                effects: [{ stat: 'hardness', trigger: 'passive', delta: undefined }],
            }],
        };
        expect(getEffectiveCharacterStats(character).hardness).toBe(0);
    });

    describe('scaled-mode effects', () => {
        const scaledTable = [
            { level: 1, delta: -1 },
            { level: 3, delta: -2 },
            { level: 6, delta: -4 },
        ];

        function withStacks(stacks) {
            return {
                ...baseCharacter,
                statuses: [{
                    stacks,
                    effects: [{ stat: 'base_hit_modifier', trigger: 'passive', mode: 'scaled', table: scaledTable }],
                }],
            };
        }

        test('below the lowest defined level resolves to a delta of 0', () => {
            expect(getEffectiveCharacterStats(withStacks(0)).base_hit_modifier).toBe(baseCharacter.base_hit_modifier);
        });

        test('exactly on a defined level uses that level', () => {
            expect(getEffectiveCharacterStats(withStacks(3)).base_hit_modifier).toBe(baseCharacter.base_hit_modifier - 2);
        });

        test('between two defined levels uses the closest one at or below', () => {
            expect(getEffectiveCharacterStats(withStacks(5)).base_hit_modifier).toBe(baseCharacter.base_hit_modifier - 2);
        });

        test('above the highest defined level still resolves to that highest level (does not extrapolate)', () => {
            expect(getEffectiveCharacterStats(withStacks(100)).base_hit_modifier).toBe(baseCharacter.base_hit_modifier - 4);
        });

        test('a scaled effect with no table at all resolves to a delta of 0 rather than throwing', () => {
            const character = {
                ...baseCharacter,
                statuses: [{ stacks: 5, effects: [{ stat: 'base_hit_modifier', trigger: 'passive', mode: 'scaled' }] }],
            };
            expect(getEffectiveCharacterStats(character).base_hit_modifier).toBe(baseCharacter.base_hit_modifier);
        });

        test('a matched table row with a non-numeric delta resolves to 0 rather than NaN', () => {
            const character = {
                ...baseCharacter,
                statuses: [{
                    stacks: 1,
                    effects: [{ stat: 'base_hit_modifier', trigger: 'passive', mode: 'scaled', table: [{ level: 1, delta: undefined }] }],
                }],
            };
            expect(getEffectiveCharacterStats(character).base_hit_modifier).toBe(baseCharacter.base_hit_modifier);
        });

        test('finds the true highest applicable level even when the table rows are out of order', () => {
            const character = {
                ...baseCharacter,
                statuses: [{
                    stacks: 5,
                    effects: [{
                        stat: 'base_hit_modifier',
                        trigger: 'passive',
                        mode: 'scaled',
                        table: [{ level: 3, delta: -2 }, { level: 1, delta: -1 }], // level 3 listed before level 1
                    }],
                }],
            };
            expect(getEffectiveCharacterStats(character).base_hit_modifier).toBe(baseCharacter.base_hit_modifier - 2);
        });
    });
});

describe('getPassiveDelta', () => {
    test('returns 0 with no active statuses', () => {
        expect(getPassiveDelta({ statuses: [] }, 'hardness')).toBe(0);
    });

    test('returns just the delta contribution, independent of the stat\'s base value', () => {
        const character = {
            statuses: [{ stacks: 1, effects: [{ stat: 'hardness', trigger: 'passive', delta: 3 }] }],
        };
        expect(getPassiveDelta(character, 'hardness')).toBe(3);
    });
});

describe('getGrantedActions', () => {
    test('a status with no grantedAction contributes nothing', () => {
        expect(getGrantedActions({ statuses: [{ name: 'Wounded' }] })).toEqual([]);
    });

    test('a characterPage with no statuses field at all (not just an empty array) is treated as having none', () => {
        expect(getGrantedActions({})).toEqual([]);
    });

    test('a nullish characterPage does not throw - treated as having no active statuses', () => {
        expect(getGrantedActions(undefined)).toEqual([]);
        expect(getGrantedActions(null)).toEqual([]);
    });

    test('a status whose grantedAction has no actionName is excluded', () => {
        const statuses = [{ name: 'Empty', grantedAction: { actionName: '' } }];
        expect(getGrantedActions({ statuses })).toEqual([]);
    });

    test('a granted action is tagged with the source status name and id, ahead of any of its own tags', () => {
        const statuses = [{
            id: 'status-1',
            name: 'Identify',
            grantedAction: {
                actionName: 'Identify',
                tags: [{ tagInfo: 'Utility' }],
            },
        }];
        const [action] = getGrantedActions({ statuses });
        expect(action.actionName).toBe('Identify');
        expect(action.grantedByStatusId).toBe('status-1');
        expect(action.tags[0]).toEqual({ tagInfo: 'Identify', tagColor: 'var(--jnj-color-arcane)', textColor: '#fff' });
        expect(action.tags[1]).toEqual({ tagInfo: 'Utility' });
    });

    test('multiple qualifying statuses each contribute one granted action', () => {
        const statuses = [
            { id: 'a', name: 'A', grantedAction: { actionName: 'Act A' } },
            { id: 'b', name: 'B', grantedAction: { actionName: 'Act B' } },
        ];
        expect(getGrantedActions({ statuses }).map(a => a.actionName)).toEqual(['Act A', 'Act B']);
    });
});

describe('advanceTurnStatuses', () => {
    test('a status with no statuses on the character just passes action_points through', () => {
        expect(advanceTurnStatuses({ action_points: 2, statuses: [] })).toEqual({ action_points: 2, statuses: [] });
    });

    test('a status that does not decay per turn is left completely untouched', () => {
        const status = { name: 'Exhaustion', decaysPerTurn: false, stacks: 3, effects: [] };
        const result = advanceTurnStatuses({ action_points: 2, statuses: [status] });
        expect(result.statuses).toEqual([status]);
        expect(result.action_points).toBe(2);
    });

    test('a decaying turn_start effect on action_points is applied and the stack count drops by one', () => {
        const status = {
            name: 'Haste',
            decaysPerTurn: true,
            stacks: 2,
            effects: [{ stat: 'action_points', trigger: 'turn_start', delta: 1 }],
        };
        const result = advanceTurnStatuses({ action_points: 1, statuses: [status] });
        expect(result.action_points).toBe(2);
        expect(result.statuses).toEqual([{ ...status, stacks: 1 }]);
    });

    test('a status is dropped entirely once its last stack decays away', () => {
        const status = {
            name: 'Haste',
            decaysPerTurn: true,
            stacks: 1,
            effects: [{ stat: 'action_points', trigger: 'turn_start', delta: 1 }],
        };
        const result = advanceTurnStatuses({ action_points: 0, statuses: [status] });
        expect(result.statuses).toEqual([]);
        expect(result.action_points).toBe(1);
    });

    test('action_points is clamped to the [0, 4] range', () => {
        const boost = { name: 'Haste', decaysPerTurn: true, stacks: 2, effects: [{ stat: 'action_points', trigger: 'turn_start', delta: 10 }] };
        expect(advanceTurnStatuses({ action_points: 3, statuses: [boost] }).action_points).toBe(4);

        const drain = { name: 'Slowed', decaysPerTurn: true, stacks: 2, effects: [{ stat: 'action_points', trigger: 'turn_start', delta: -10 }] };
        expect(advanceTurnStatuses({ action_points: 1, statuses: [drain] }).action_points).toBe(0);
    });

    test('decaysPerTurn falls back to inferring from a turn_start effect when the field is missing (legacy statuses)', () => {
        const legacyDecaying = { name: 'Haste (legacy)', stacks: 1, effect: { stat: 'action_points', trigger: 'turn_start', delta: 1 } };
        const result = advanceTurnStatuses({ action_points: 0, statuses: [legacyDecaying] });
        expect(result.action_points).toBe(1);
        expect(result.statuses).toEqual([]); // its single stack decayed away
    });

    test('decaysPerTurn=false is honored even if the status has a turn_start effect (explicit flag wins over inference)', () => {
        const status = {
            name: 'Weird one-off',
            decaysPerTurn: false,
            stacks: 1,
            effects: [{ stat: 'action_points', trigger: 'turn_start', delta: 1 }],
        };
        const result = advanceTurnStatuses({ action_points: 0, statuses: [status] });
        expect(result.action_points).toBe(0);
        expect(result.statuses).toEqual([status]);
    });

    test('a decaying status with stacks missing/undefined is treated as not currently active and left untouched', () => {
        const status = { name: 'Malformed', decaysPerTurn: true, effects: [{ stat: 'action_points', trigger: 'turn_start', delta: 1 }] };
        const result = advanceTurnStatuses({ action_points: 2, statuses: [status] });
        expect(result.statuses).toEqual([status]);
        expect(result.action_points).toBe(2);
    });

    test('a decaying status with stacks at 0 is left untouched rather than erroring', () => {
        const status = { name: 'Zeroed out', decaysPerTurn: true, stacks: 0, effects: [{ stat: 'action_points', trigger: 'turn_start', delta: 1 }] };
        const result = advanceTurnStatuses({ action_points: 2, statuses: [status] });
        expect(result.statuses).toEqual([status]);
        expect(result.action_points).toBe(2);
    });

    test('multiple statuses are each processed independently in the same call', () => {
        const haste = { name: 'Haste', decaysPerTurn: true, stacks: 1, effects: [{ stat: 'action_points', trigger: 'turn_start', delta: 1 }] };
        const exhaustion = { name: 'Exhaustion', decaysPerTurn: false, stacks: 3, effects: [] };
        const slowed = { name: 'Slowed', decaysPerTurn: true, stacks: 2, effects: [{ stat: 'action_points', trigger: 'turn_start', delta: -1 }] };
        const result = advanceTurnStatuses({ action_points: 2, statuses: [haste, exhaustion, slowed] });
        expect(result.action_points).toBe(2); // +1 then -1
        expect(result.statuses).toEqual([exhaustion, { ...slowed, stacks: 1 }]); // haste's single stack decayed away
    });

    test('a turn_start effect on a stat other than action_points has no numeric effect (only action_points is turn-based)', () => {
        const status = { name: 'Weird', decaysPerTurn: true, stacks: 2, effects: [{ stat: 'base_armor_class', trigger: 'turn_start', delta: 5 }] };
        const result = advanceTurnStatuses({ action_points: 2, statuses: [status] });
        expect(result.action_points).toBe(2);
        expect(result.statuses).toEqual([{ ...status, stacks: 1 }]);
    });
});

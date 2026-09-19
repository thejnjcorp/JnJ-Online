import {
    ENCOUNTER_TIERS, OBJECTIVE_LOADS, ROLE_BENCHMARKS, adjustedEhpRange, benchmarkFor, checkEnemy, evaluateEncounter, landingFor,
    landingText, objectiveByKey, rangeStatus, rangeText, tierByKey,
} from '../../src/utils/encounterGuide';

const enemy = (tier, hp, ac, ap, extra = {}) => ({ enemy_name: `${tier} 1`, enemy_type: tier, maximum_health: hp, base_armor_class: ac, action_points: ap, ...extra });
const entry = (enemyStats, count = 1, id = enemyStats.enemy_name) => ({ id, count, enemy: enemyStats });

describe('rangeText', () => {
    test('writes a range, or one number when both ends are the same', () => {
        expect(rangeText([12, 18])).toBe('12-18');
        expect(rangeText([2, 2])).toBe('2');
    });
});

describe('the role benchmarks (guide section 1)', () => {
    test.each([
        ['Goon', [1, 5], [13, 14], [1, 2]],
        ['Regular', [12, 18], [14, 15], [2, 2]],
        ['Veteran', [20, 28], [15, 16], [2, 3]],
        ['Elite', [30, 45], [16, 16], [2, 3]],
        ['Captain', [45, 70], [16, 17], [3, 3]],
    ])('%s: HP %j, AC %j, actions %j', (tier, hp, ac, actions) => {
        expect(ROLE_BENCHMARKS[tier]).toMatchObject({ hp, ac, actions });
    });

    test('the guide\'s Boss is the app\'s Captain', () => {
        expect(benchmarkFor('Captain').role).toBe('Boss / Captain');
        expect(benchmarkFor('Boss')).toBeNull();
        expect(benchmarkFor(undefined)).toBeNull();
    });
});

describe('checkEnemy', () => {
    test('an enemy inside every range has no issues', () => {
        const { benchmark, issues } = checkEnemy(enemy('Regular', 15, 14, 2));
        expect(benchmark.role).toBe('Regular');
        expect(issues).toEqual([]);
    });

    test('the ends of a range count as inside it', () => {
        expect(checkEnemy(enemy('Regular', 12, 15, 2)).issues).toEqual([]);
        expect(checkEnemy(enemy('Regular', 18, 14, 2)).issues).toEqual([]);
    });

    test('names each number that is above or below its range', () => {
        const { issues } = checkEnemy(enemy('Regular', 25, 13, 3));
        expect(issues).toEqual([
            { field: 'hp', label: 'HP', value: 25, range: [12, 18], status: 'above' },
            { field: 'ac', label: 'AC', value: 13, range: [14, 15], status: 'below' },
            { field: 'actions', label: 'Actions', value: 3, range: [2, 2], status: 'above' },
        ]);
    });

    test('an enemy with no tier (or an unknown one) has no benchmark to compare with', () => {
        expect(checkEnemy(enemy('', 99, 99, 4))).toEqual({ benchmark: null, issues: [] });
        expect(checkEnemy({ enemy_type: 'Dragon', maximum_health: 500 })).toEqual({ benchmark: null, issues: [] });
        expect(checkEnemy(undefined)).toEqual({ benchmark: null, issues: [] });
    });

    test('a number the enemy does not have is skipped, not flagged', () => {
        expect(checkEnemy({ enemy_type: 'Goon', maximum_health: 3 }).issues).toEqual([]);
        expect(checkEnemy({ enemy_type: 'Goon', maximum_health: 3, base_armor_class: null, action_points: 'lots' }).issues).toEqual([]);
    });
});

describe('the encounter tiers (guide sections 4 and 5)', () => {
    test('have the guide\'s EHP, duration and starting actions', () => {
        expect(ENCOUNTER_TIERS.map(tier => [tier.key, tier.ehp, tier.rounds, tier.actions])).toEqual([
            ['easy', [40, 60], '3-4 rounds', [4, 6]],
            ['standard', [65, 90], '4-5 rounds', [6, 8]],
            ['hard', [90, 120], '5-6 rounds', [8, 9]],
            ['setpiece', [120, 160], '6-8 rounds', [8, 10]],
        ]);
    });

    test('a set piece uses 4-5 zones and the rest 3-4', () => {
        expect(tierByKey('setpiece').zones).toEqual([4, 5]);
        expect(tierByKey('standard').zones).toEqual([3, 4]);
    });

    test('tierByKey finds one, or nothing', () => {
        expect(tierByKey('hard').label).toBe('Hard');
        expect(tierByKey('epic')).toBeNull();
        expect(tierByKey('')).toBeNull();
    });
});

describe('landingFor: where a total of enemy HP lands', () => {
    test.each([
        [40, 'easy'], [60, 'easy'], [65, 'standard'], [90, 'standard'], [91, 'hard'], [120, 'hard'], [121, 'setpiece'], [160, 'setpiece'],
    ])('%i HP is %s', (total, key) => {
        expect(landingFor(total)).toEqual({ position: 'in', tier: tierByKey(key) });
    });

    test('the tiers touch at 90 and 120, and those count for the lighter tier', () => {
        expect(landingFor(90).tier.key).toBe('standard');
        expect(landingFor(120).tier.key).toBe('hard');
    });

    test('below Easy, in the gap between Easy and Standard, and above a Set Piece', () => {
        expect(landingFor(39)).toEqual({ position: 'below' });
        expect(landingFor(61)).toEqual({ position: 'between', lower: tierByKey('easy'), upper: tierByKey('standard') });
        expect(landingFor(64).position).toBe('between');
        expect(landingFor(161)).toEqual({ position: 'above' });
    });

    test('nothing to land when there is no HP', () => {
        expect(landingFor(0)).toBeNull();
        expect(landingFor(NaN)).toBeNull();
    });

    test('landingText says it in words', () => {
        expect(landingText(landingFor(82))).toBe('Standard (65-90 EHP, 4-5 rounds)');
        expect(landingText(landingFor(20))).toBe('Lighter than an Easy fight (under 40 EHP)');
        expect(landingText(landingFor(62))).toBe('Between Easy and Standard');
        expect(landingText(landingFor(200))).toBe('Bigger than a Set Piece (over 160 EHP)');
        expect(landingText(null)).toBe('');
    });
});

describe('secondary objectives (guide section 7)', () => {
    test('are Light, Moderate, Heavy and Primary, with the guide\'s party actions and adjustment', () => {
        expect(OBJECTIVE_LOADS.map(load => [load.key, load.partyActions])).toEqual([['light', '1-2'], ['moderate', '3-5'], ['heavy', '6-9'], ['primary', '10+']]);
        expect(objectiveByKey('moderate').adjustment).toBe('Reduce enemy EHP by about 10-15%, or remove one minor enemy');
        expect(objectiveByKey('none')).toBeNull();
    });

    test('a light objective changes nothing', () => {
        expect(adjustedEhpRange([65, 90], 'light')).toEqual([65, 90]);
        expect(adjustedEhpRange([65, 90], '')).toEqual([65, 90]);
    });

    test('a moderate one takes 10-15% off the range, a heavy one 20-25%', () => {
        expect(adjustedEhpRange([65, 90], 'moderate')).toEqual([55, 81]);
        expect(adjustedEhpRange([65, 90], 'heavy')).toEqual([49, 72]);
    });

    test('a primary objective has no number to take off', () => {
        expect(adjustedEhpRange([65, 90], 'primary')).toEqual([65, 90]);
    });
});

describe('rangeStatus', () => {
    test('is under, within or over a range, and by how much', () => {
        expect(rangeStatus(50, [65, 90])).toEqual({ state: 'under', by: 15 });
        expect(rangeStatus(65, [65, 90])).toEqual({ state: 'within', by: 0 });
        expect(rangeStatus(90, [65, 90])).toEqual({ state: 'within', by: 0 });
        expect(rangeStatus(122, [65, 90])).toEqual({ state: 'over', by: 32 });
    });
});

describe('evaluateEncounter', () => {
    const roster = [entry(enemy('Captain', 60, 17, 3)), entry(enemy('Regular', 25, 14, 3), 2), entry(enemy('Goon', 4, 13, 2), 3)];

    test('totals the enemies, their HP and their actions, counting each entry\'s count', () => {
        const result = evaluateEncounter({ roster });
        expect(result.enemies).toBe(6);
        expect(result.hp).toBe(60 + 2 * 25 + 3 * 4);
        expect(result.actions).toBe(3 + 2 * 3 + 3 * 2);
    });

    test('says which tier the HP lands in, whatever the target', () => {
        expect(evaluateEncounter({ roster }).landing.tier.key).toBe('setpiece');
    });

    test('with no target there is nothing to be on or off', () => {
        const result = evaluateEncounter({ roster });
        expect(result).toMatchObject({ tier: null, hpRange: null, hpStatus: null, actionStatus: null, zoneStatus: null });
    });

    test('with a target, compares HP and actions with its ranges', () => {
        const result = evaluateEncounter({ roster, target: 'standard' });
        expect(result.hpRange).toEqual([65, 90]);
        expect(result.hpStatus).toEqual({ state: 'over', by: 32 });
        expect(result.actionRange).toEqual([6, 8]);
        expect(result.actionStatus).toEqual({ state: 'over', by: 7 });
    });

    test('an encounter on target is within both', () => {
        const fight = [entry(enemy('Elite', 40, 16, 3)), entry(enemy('Regular', 15, 14, 2), 2), entry(enemy('Goon', 3, 13, 1), 1)];
        const result = evaluateEncounter({ roster: fight, target: 'standard' });
        expect(result.hp).toBe(73);
        expect(result.hpStatus.state).toBe('within');
        expect(result.actions).toBe(8);
        expect(result.actionStatus.state).toBe('within');
    });

    test('an objective shrinks the HP range it is compared with', () => {
        const result = evaluateEncounter({ roster, target: 'standard', objective: 'moderate' });
        expect(result.hpBaseRange).toEqual([65, 90]);
        expect(result.hpRange).toEqual([55, 81]);
        expect(result.hpStatus).toEqual({ state: 'over', by: 41 });
    });

    test('a primary objective has no HP range to compare with, but the actions still are', () => {
        const result = evaluateEncounter({ roster, target: 'standard', objective: 'primary' });
        expect(result.hpRange).toBeNull();
        expect(result.hpStatus).toBeNull();
        expect(result.actionStatus).not.toBeNull();
        expect(result.objective.key).toBe('primary');
    });

    test('compares the map\'s zones with the target\'s, only when there is a map', () => {
        expect(evaluateEncounter({ roster, target: 'standard', zoneCount: 5 }).zoneStatus).toEqual({ state: 'over', by: 1 });
        expect(evaluateEncounter({ roster, target: 'setpiece', zoneCount: 5 }).zoneStatus.state).toBe('within');
        expect(evaluateEncounter({ roster, target: 'standard', zoneCount: 3 }).zoneStatus.state).toBe('within');
        expect(evaluateEncounter({ roster, target: 'standard', zoneCount: 0 }).zoneStatus).toBeNull();
    });

    test('lists the enemies outside their role\'s benchmarks, with their issues', () => {
        const { flagged } = evaluateEncounter({ roster });
        expect(flagged).toHaveLength(1);
        expect(flagged[0]).toMatchObject({ name: 'Regular 1', tier: 'Regular' });
        expect(flagged[0].issues.map(issue => issue.field)).toEqual(['hp', 'actions']);
    });

    test('an empty roster is all zeros', () => {
        const result = evaluateEncounter({});
        expect(result).toMatchObject({ enemies: 0, hp: 0, actions: 0, landing: null, flagged: [] });
        expect(evaluateEncounter({ roster: [], target: 'easy' }).hpStatus).toEqual({ state: 'under', by: 40 });
    });

    test('a missing or zero count counts as one, and missing numbers as zero', () => {
        const result = evaluateEncounter({ roster: [{ id: 'a', count: 0, enemy: { enemy_type: 'Goon' } }, { id: 'b', enemy: { maximum_health: 10, action_points: 2 } }] });
        expect(result.enemies).toBe(2);
        expect(result.hp).toBe(10);
        expect(result.actions).toBe(2);
    });
});

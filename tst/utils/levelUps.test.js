import {
    MAX_LEVEL,
    actionsUnlockedAt,
    claimLevelUps,
    claimedLevel,
    describeReward,
    levelOf,
    newReward,
    pendingLevelUps,
    rewardsAtLevel,
    unchosenRewards,
    validateRewards,
} from '../../src/utils/levelUps';

const statPoint = (level, id = `sp${level}`, points = 1) => ({ id, level, kind: 'stat_point', points });
const bonus = (level, stat, amount, id = `b${level}${stat}`) => ({ id, level, kind: 'bonus', stat, amount });
const note = (level, text, id = `n${level}`) => ({ id, level, kind: 'note', text });

const classData = {
    level_rewards: [statPoint(2), bonus(2, 'armor_class', 1), bonus(3, 'maximum_health', 5), note(3, 'Pick a Stance'), statPoint(5)],
    actions: [{ actionName: 'Start' }, { actionName: 'Fleetfoot', actionLevel: 3 }, { actionName: 'Ultimate', actionLevel: 5 }],
};
const character = { experience_points: 2000, strength_stat: 4, dexterity_stat: 3, intelligence_stat: 2, charisma_stat: 1, maximum_health: 10, hardness: 0 };

describe('levelOf', () => {
    test('is 1 plus a level per 1000 experience, never below 1', () => {
        expect(levelOf(0)).toBe(1);
        expect(levelOf(999)).toBe(1);
        expect(levelOf(1000)).toBe(2);
        expect(levelOf(2500)).toBe(3);
        expect(levelOf(-500)).toBe(1);
        expect(levelOf(undefined)).toBe(1);
        expect(levelOf('3000')).toBe(4);
    });
});

describe('claimedLevel', () => {
    test('is the saved level, or 1 for a character that predates level-ups', () => {
        expect(claimedLevel({ claimed_level: 4 })).toBe(4);
        expect(claimedLevel({})).toBe(1);
        expect(claimedLevel({ claimed_level: '4' })).toBe(1);
        expect(claimedLevel(undefined)).toBe(1);
    });
});

describe('newReward', () => {
    test.each([
        ['stat_point', { points: 1 }],
        ['bonus', { stat: 'armor_class', amount: 1 }],
        ['note', { text: '' }],
    ])('a new %s has sensible defaults and its own id', (kind, expected) => {
        const reward = newReward(4, kind);
        expect(reward).toMatchObject({ level: 4, kind, ...expected });
        expect(typeof reward.id).toBe('string');
        expect(newReward(4, kind).id).not.toBe(reward.id);
    });
});

describe('describeReward', () => {
    test('reads as it would in a level-up', () => {
        expect(describeReward(statPoint(2))).toBe('+1 to an ability score of your choice');
        expect(describeReward(statPoint(2, 'x', 2))).toBe('+2 to an ability score of your choice');
        expect(describeReward(bonus(2, 'armor_class', 1))).toBe('+1 Armor Class');
        expect(describeReward(bonus(2, 'hit_modifier', -2))).toBe('-2 Hit Modifier');
        expect(describeReward(bonus(2, 'maximum_health', 5))).toBe('+5 Maximum Health');
        expect(describeReward(note(2, 'Pick a Stance'))).toBe('Pick a Stance');
    });
});

describe('rewardsAtLevel / actionsUnlockedAt', () => {
    test('pick out one level, and an action with no Level unlocks at 1', () => {
        expect(rewardsAtLevel(classData, 2).map(reward => reward.id)).toEqual(['sp2', 'b2armor_class']);
        expect(rewardsAtLevel(classData, 4)).toEqual([]);
        expect(rewardsAtLevel(undefined, 2)).toEqual([]);
        expect(actionsUnlockedAt(classData, 1).map(action => action.actionName)).toEqual(['Start']);
        expect(actionsUnlockedAt(classData, 3).map(action => action.actionName)).toEqual(['Fleetfoot']);
    });
});

describe('pendingLevelUps', () => {
    test('lists each level reached, above the claimed one, that has something to claim', () => {
        const pending = pendingLevelUps({ ...character, experience_points: 2000 }, classData);
        expect(pending.map(entry => entry.level)).toEqual([2, 3]);
        expect(pending[1].rewards.map(reward => reward.id)).toEqual(['b3maximum_health', 'n3']);
        expect(pending[1].unlockedActions.map(action => action.actionName)).toEqual(['Fleetfoot']);
    });

    test('skips levels with nothing to claim and levels already claimed', () => {
        expect(pendingLevelUps({ ...character, experience_points: 3000, claimed_level: 3 }, classData)).toEqual([]);
        expect(pendingLevelUps({ ...character, experience_points: 4000, claimed_level: 3 }, classData).map(entry => entry.level)).toEqual([5]);
    });

    test('nothing is pending at level 1, or for a class with no rewards', () => {
        expect(pendingLevelUps({ ...character, experience_points: 500 }, classData)).toEqual([]);
        expect(pendingLevelUps(character, { level_rewards: [] })).toEqual([]);
        expect(pendingLevelUps(character, {})).toEqual([]);
    });

    test('a character that predates level-ups is offered every level it has reached', () => {
        expect(pendingLevelUps({ ...character, experience_points: 4000 }, classData).map(entry => entry.level)).toEqual([2, 3, 5]);
    });

    test('never offers a level beyond the maximum', () => {
        const rewards = { level_rewards: [statPoint(15), statPoint(16, 'over')] };
        const pending = pendingLevelUps({ ...character, experience_points: 30000, claimed_level: MAX_LEVEL - 1 }, rewards);
        expect(pending.map(entry => entry.level)).toEqual([15]);
    });

    test('reads the rewards from the character itself when no class is given', () => {
        expect(pendingLevelUps({ ...character, ...classData }).map(entry => entry.level)).toEqual([2, 3]);
    });
});

describe('unchosenRewards', () => {
    const pending = pendingLevelUps(character, classData);

    test('a stat point needs an ability picked; other rewards never do', () => {
        expect(unchosenRewards(pending, {}).map(reward => reward.id)).toEqual(['sp2']);
        expect(unchosenRewards(pending, { sp2: 'strength_stat' })).toEqual([]);
    });

    test('a choice that is not an ability does not count', () => {
        expect(unchosenRewards(pending, { sp2: 'luck_stat' }).map(reward => reward.id)).toEqual(['sp2']);
    });
});

describe('claimLevelUps', () => {
    const pending = pendingLevelUps(character, classData);
    const claim = (choices = { sp2: 'intelligence_stat' }, from = character) => claimLevelUps(from, pending, choices, 1234);

    test('puts a stat point on the chosen ability', () => {
        expect(claim().intelligence_stat).toBe(3);
        expect(claim({ sp2: 'strength_stat' }).strength_stat).toBe(5);
    });

    test('keeps AC-style bonuses apart from the class stats, in level_bonuses, added to any it already has', () => {
        expect(claim().level_bonuses).toEqual({ armor_class: 1 });
        expect(claim(undefined, { ...character, level_bonuses: { armor_class: 2, hit_modifier: 1 } }).level_bonuses).toEqual({ armor_class: 3, hit_modifier: 1 });
    });

    test('raises max health and hardness directly on the character', () => {
        expect(claim().maximum_health).toBe(15);
        const hardness = claimLevelUps(character, [{ level: 2, rewards: [bonus(2, 'hardness', 1)] }], {}, 1);
        expect(hardness.hardness).toBe(1);
    });

    test('two stat points to the same ability add up', () => {
        const two = [{ level: 2, rewards: [statPoint(2, 'a'), statPoint(3, 'b')] }];
        expect(claimLevelUps(character, two, { a: 'strength_stat', b: 'strength_stat' }, 1).strength_stat).toBe(6);
    });

    test('claims every level reached, including ones with nothing on them', () => {
        expect(claim().claimed_level).toBe(3);
        expect(claimLevelUps({ ...character, experience_points: 4000 }, pending, { sp2: 'strength_stat' }, 1).claimed_level).toBe(5);
    });

    test('never lowers the claimed level', () => {
        expect(claimLevelUps({ ...character, claimed_level: 9 }, pending, { sp2: 'strength_stat' }, 1).claimed_level).toBe(9);
    });

    test('keeps a history of what each level gave, appended to what was there', () => {
        const earlier = [{ level: 1, at: 1, applied: ['x'] }];
        const { level_history } = claim(undefined, { ...character, level_history: earlier });
        expect(level_history).toEqual([
            earlier[0],
            { level: 2, at: 1234, applied: ['Intelligence +1', '+1 Armor Class'] },
            { level: 3, at: 1234, applied: ['+5 Maximum Health', 'Pick a Stance'] },
        ]);
    });

    test('writes no level_bonuses at all when there were none to add', () => {
        const onlyStat = [{ level: 2, rewards: [statPoint(2)] }];
        expect(claimLevelUps(character, onlyStat, { sp2: 'strength_stat' }, 1)).not.toHaveProperty('level_bonuses');
    });

    test('does not change what it was given', () => {
        const before = JSON.stringify(character);
        claim();
        expect(JSON.stringify(character)).toBe(before);
    });
});

describe('validateRewards', () => {
    test('a well-formed set of rewards has no problems', () => {
        expect(validateRewards(classData.level_rewards)).toEqual({ errors: {}, problems: [] });
        expect(validateRewards(undefined)).toEqual({ errors: {}, problems: [] });
    });

    test.each([
        ['a level outside 2-15', { ...statPoint(2), level: 1 }, 'level'],
        ['a level that is not whole', { ...statPoint(2), level: 2.5 }, 'level'],
        ['no points', statPoint(2, 'sp', 0), 'points'],
        ['too many points', statPoint(2, 'sp', 5), 'points'],
        ['a bonus with no stat', { id: 'b', level: 2, kind: 'bonus', amount: 1 }, 'stat'],
        ['a bonus of nothing', bonus(2, 'armor_class', 0), 'amount'],
        ['an enormous bonus', bonus(2, 'armor_class', 11), 'amount'],
        ['a fractional bonus', bonus(2, 'armor_class', 1.5), 'amount'],
        ['a blank note', note(2, '   '), 'text'],
        ['an unknown kind', { id: 'k', level: 2, kind: 'mystery' }, 'kind'],
    ])('flags %s', (_name, reward, field) => {
        const { errors, problems } = validateRewards([reward]);
        expect(Object.keys(errors[reward.id])).toContain(field);
        expect(problems.some(problem => problem.id === `reward-${reward.id}-${field}`)).toBe(true);
    });

    test('a negative bonus is allowed', () => {
        expect(validateRewards([bonus(2, 'hit_modifier', -1)]).problems).toEqual([]);
    });

    test('names the level in each problem for the page summary', () => {
        const { problems } = validateRewards([note(6, '')]);
        expect(problems[0].label).toBe('Level 6 reward - note');
    });
});

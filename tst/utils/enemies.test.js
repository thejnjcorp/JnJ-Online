import {
    ENEMY_TIERS, ENEMY_STAT_FIELDS, enemyDocFields, enemyInstance, formatModifier, instanceNames, newEnemy, parseModifier, removeEnemies,
    npcIdOf, rosterEntry, rosterSummary, stageEncounter, summaryText, tierClass, tierOf, uniqueEnemyName, validateEnemy,
} from '../../src/utils/enemies';
import { validAction } from '../testUtils/actions';

const bandit = { id: 'bestiary-bandit', ...newEnemy('Goon'), enemy_name: 'Rust Bandit', maximum_health: 12, level: 1, actions: [validAction({ actionName: 'Stab' })], Weaknesses: ['Fire 5'], description: 'Notes', canWrite: ['dm'], admins: ['dm'] };
const captain = { id: 'bestiary-captain', ...newEnemy('Captain'), enemy_name: 'Iron Captain', maximum_health: 80, level: 4, action_points: 4 };

describe('tiers', () => {
    test('are Goon, Regular, Veteran, Elite, Captain and Set Piece, weakest first, each with a plural', () => {
        expect(ENEMY_TIERS.map(tier => tier.key)).toEqual(['Goon', 'Regular', 'Veteran', 'Elite', 'Captain', 'Set Piece']);
        expect(ENEMY_TIERS.map(tier => tier.plural)).toEqual(['Goons', 'Regulars', 'Veterans', 'Elites', 'Captains', 'Set Pieces']);
    });

    test('tierOf finds one; tierClass is a class for its badge', () => {
        expect(tierOf('Elite').plural).toBe('Elites');
        expect(tierOf('Dragon')).toBeUndefined();
        expect(tierClass('Elite')).toBe('EnemyTier-elite');
        expect(tierClass('Set Piece')).toBe('EnemyTier-set-piece'); // one class, not two
        expect(tierClass(undefined)).toBe('EnemyTier-unknown');
    });
});

describe('enemyDocFields', () => {
    const form = () => ({ ...newEnemy('Elite'), enemy_name: '  Ash Warden ', description: 'Loves fire', visibility: 'private', canWrite: ['dm'], actions: [validAction({ actionName: 'Ash Cloud' })] });

    test('is the stat block, notes and actions, with the name trimmed', () => {
        const fields = enemyDocFields(form());
        expect(fields).toMatchObject({ enemy_name: 'Ash Warden', enemy_type: 'Elite', description: 'Loves fire', maximum_health: 10, level: 1 });
        expect(fields.actions).toHaveLength(1);
    });

    test('leaves out what the form only uses to run itself (visibility, who can write)', () => {
        const fields = enemyDocFields(form());
        expect(fields).not.toHaveProperty('visibility');
        expect(fields).not.toHaveProperty('canWrite');
    });

    test('an outcome table that was switched on and left empty is not saved', () => {
        const withEmpty = { ...form(), actions: [{ ...validAction({ actionName: 'A' }), outcomeTable: { success: '', failure: '' } }, { ...validAction({ actionName: 'B' }), outcomeTable: { success: 'Hit' } }] };
        const [first, second] = enemyDocFields(withEmpty).actions;
        expect(first).not.toHaveProperty('outcomeTable');
        expect(second.outcomeTable).toEqual({ success: 'Hit' });
    });

    test('a form with no name, notes or actions yet still gives a complete set', () => {
        expect(enemyDocFields({ ...newEnemy(), enemy_name: undefined, actions: undefined, description: undefined })).toMatchObject({ enemy_name: '', description: '', actions: [] });
    });
});

describe('newEnemy', () => {
    test('starts as a valid stat block but for its name, in the tier asked for', () => {
        expect(newEnemy()).toMatchObject({ enemy_type: 'Regular', level: 1, action_points: 3, Weaknesses: [], Resistances: [], actions: [] });
        expect(newEnemy('Elite').enemy_type).toBe('Elite');
        const problems = validateEnemy(newEnemy()).problems;
        expect(problems.map(problem => problem.id)).toEqual(['field-enemy_name']);
    });
});

describe('parseModifier / formatModifier', () => {
    test('read "Fire 5" and "Non Magical-Physical 4", including negatives and stray spaces', () => {
        expect(parseModifier('Fire 5')).toEqual({ type: 'Fire', amount: 5 });
        expect(parseModifier('Non Magical-Physical 4')).toEqual({ type: 'Non Magical-Physical', amount: 4 });
        expect(parseModifier('  Acid   -2 ')).toEqual({ type: 'Acid', amount: -2 });
    });

    test('text with no amount has none, rather than a guess', () => {
        expect(parseModifier('Fire').amount).toBeNaN();
        expect(parseModifier('').amount).toBeNaN();
        expect(parseModifier(undefined).amount).toBeNaN();
    });

    test('a modifier with no amount yet is just its type, and one with nothing is empty', () => {
        expect(formatModifier({ type: 'Fire', amount: NaN })).toBe('Fire');
        expect(formatModifier({ type: '', amount: NaN })).toBe('');
    });

    test('format is the inverse', () => {
        expect(formatModifier({ type: ' Fire ', amount: 5 })).toBe('Fire 5');
        expect(formatModifier(parseModifier('Acid 10'))).toBe('Acid 10');
    });
});

describe('validateEnemy', () => {
    const valid = () => ({ ...newEnemy('Veteran'), enemy_name: 'Wolf' });

    test('a complete enemy is valid', () => {
        expect(validateEnemy(valid())).toMatchObject({ valid: true, problems: [], fields: {} });
    });

    test.each([
        ['a blank name', { enemy_name: '  ' }, 'enemy_name'],
        ['an unknown tier', { enemy_type: 'Dragon' }, 'enemy_type'],
        ['level 0', { level: 0 }, 'level'],
        ['a fractional level', { level: 1.5 }, 'level'],
        ['negative armor class', { base_armor_class: -1 }, 'base_armor_class'],
        ['no health', { maximum_health: 0 }, 'maximum_health'],
        ['5 action points', { action_points: 5 }, 'action_points'],
        ['a blank ability score', { strength_stat: NaN }, 'strength_stat'],
        ['a text hit modifier', { base_hit_modifier: '2' }, 'base_hit_modifier'],
        ['no damage dice', { base_damage_dice: 0 }, 'base_damage_dice'],
        ['a die type of 7', { base_damage_dice_type: 7 }, 'base_damage_dice_type'],
        ['a weakness with no amount', { Weaknesses: ['Fire'] }, 'Weaknesses'],
        ['a resistance with no type', { Resistances: ['5'] }, 'Resistances'],
    ])('flags %s', (_name, change, field) => {
        const result = validateEnemy({ ...valid(), ...change });
        expect(result.valid).toBe(false);
        expect(result.fields[field]).toEqual(expect.any(String));
        expect(result.problems.some(problem => problem.id === `field-${field}`)).toBe(true);
    });

    test('negative ability scores, hardness and modifiers are fine', () => {
        expect(validateEnemy({ ...valid(), strength_stat: -2, hardness: -1, base_damage_modifier: -3 }).valid).toBe(true);
    });

    test('an action with a problem is flagged by its place, in the same terms as a class action', () => {
        const result = validateEnemy({ ...valid(), actions: [validAction(), validAction({ actionName: '' })] });
        expect(result.valid).toBe(false);
        expect(result.actions[1].actionName).toBeDefined();
        expect(result.actions[0]).toBeUndefined();
        expect(result.problems.at(-1).id).toBe('action-1-actionName');
    });

    test('reports every problem at once', () => {
        expect(validateEnemy({ ...valid(), enemy_name: '', level: 0, maximum_health: 0 }).problems).toHaveLength(3);
    });
});

describe('rosterEntry', () => {
    test('copies just the stat block, and remembers where it came from', () => {
        const entry = rosterEntry(bandit, 'Zone A');
        expect(entry).toMatchObject({ templateId: 'bestiary-bandit', count: 1, zone: 'Zone A' });
        expect(entry.enemy.enemy_name).toBe('Rust Bandit');
        ['canWrite', 'admins', 'description', 'id', 'public'].forEach(key => expect(entry.enemy).not.toHaveProperty(key));
        expect(Object.keys(entry.enemy).every(key => ENEMY_STAT_FIELDS.includes(key))).toBe(true);
    });

    test('is a deep copy - changing the roster never changes the bestiary', () => {
        const entry = rosterEntry(bandit);
        entry.enemy.actions[0].actionName = 'Changed';
        entry.enemy.Weaknesses.push('Ice 1');
        expect(bandit.actions[0].actionName).toBe('Stab');
        expect(bandit.Weaknesses).toEqual(['Fire 5']);
    });

    test('each entry has its own id', () => {
        expect(rosterEntry(bandit).id).not.toBe(rosterEntry(bandit).id);
    });
});

describe('instanceNames', () => {
    test('one enemy keeps its name; several are numbered', () => {
        expect(instanceNames({ count: 1, enemy: { enemy_name: 'Wolf' } })).toEqual(['Wolf']);
        expect(instanceNames({ count: 3, enemy: { enemy_name: 'Wolf' } })).toEqual(['Wolf 1', 'Wolf 2', 'Wolf 3']);
    });

    test('a missing or bad count is 1, and a missing name is "Enemy"', () => {
        expect(instanceNames({ enemy: { enemy_name: 'Wolf' } })).toEqual(['Wolf']);
        expect(instanceNames({ count: 0, enemy: { enemy_name: 'Wolf' } })).toEqual(['Wolf']);
        expect(instanceNames({ count: 2, enemy: {} })).toEqual(['Enemy 1', 'Enemy 2']);
    });
});

describe('enemyInstance', () => {
    test('is a live enemy at full health and full action points, with no statuses', () => {
        const instance = enemyInstance(captain, 'Iron Captain');
        expect(instance).toMatchObject({ enemy_name: 'Iron Captain', enemy_type: 'Captain', current_health: 80, maximum_health: 80, temporary_health: 0, action_points: 4, statuses: [], experience_points: 0 });
        expect(typeof instance.id).toBe('string');
    });

    test('every instance has its own id and its own copy of its lists', () => {
        const first = enemyInstance(bandit, 'A');
        const second = enemyInstance(bandit, 'B');
        expect(first.id).not.toBe(second.id);
        first.actions[0].actionName = 'Changed';
        expect(second.actions[0].actionName).toBe('Stab');
    });

    test('action points default to 3 when the stat block has none', () => {
        expect(enemyInstance({ maximum_health: 5 }, 'X').action_points).toBe(3);
    });
});

describe('stageEncounter', () => {
    const encounter = {
        roster: [
            { ...rosterEntry(bandit, 'Zone B'), count: 3 },
            { ...rosterEntry(captain, 'Nowhere'), count: 1 },
        ],
    };
    const campaign = { enemy_list: [{ id: 'old', enemy_name: 'Old' }] };
    // the party doc's tracker, who is already in the fight
    const tracker = [{ id: 'npc:old', status: 'Zone A', index: 0 }, { id: 'character:x', status: 'Zone B', index: 0 }];

    test('adds one live enemy per count, after the ones already there, numbered', () => {
        const staged = stageEncounter(encounter, campaign, ['Zone A', 'Zone B']);
        expect(staged.enemy_list.map(enemy => enemy.enemy_name)).toEqual(['Old', 'Rust Bandit 1', 'Rust Bandit 2', 'Rust Bandit 3', 'Iron Captain']);
        expect(staged.stagedIds).toHaveLength(4);
        expect(staged.enemy_list.slice(1).map(enemy => enemy.id)).toEqual(staged.stagedIds);
    });

    test('puts each on the tracker in its zone, after whoever is already there, keeping the tracker\'s ids in step with the enemies', () => {
        const staged = stageEncounter(encounter, campaign, ['Zone A', 'Zone B'], tracker);
        const added = staged.trackerPosts;
        expect(added.map(post => [post.title, post.status, post.index])).toEqual([
            ['Rust Bandit 1', 'Zone B', 1], ['Rust Bandit 2', 'Zone B', 2], ['Rust Bandit 3', 'Zone B', 3],
            ['Iron Captain', 'Zone A', 1], // "Nowhere" isn't a zone, so the first one
        ]);
        expect(added.map(post => post.id)).toEqual(staged.stagedIds.map(id => `npc:${id}`));
        expect(staged).not.toHaveProperty('combat_tracker'); // only the posts to add: the tracker is on the party doc
    });

    test('with no map there are no zones, so nothing goes on the tracker (the tracker adds them once there is one)', () => {
        const staged = stageEncounter(encounter, campaign, [], tracker);
        expect(staged.enemy_list).toHaveLength(5);
        expect(staged.trackerPosts).toEqual([]);
    });

    test('works on a campaign with no enemies or tracker yet, and an encounter with no roster', () => {
        expect(stageEncounter(encounter, {}, ['Zone A']).enemy_list).toHaveLength(4);
        expect(stageEncounter(encounter, {}, ['Zone A']).trackerPosts.map(post => post.index)).toEqual([0, 1, 2, 3]);
        expect(stageEncounter({}, campaign, ['Zone A'], tracker)).toMatchObject({ stagedIds: [], trackerPosts: [], enemy_list: campaign.enemy_list });
    });

    test('does not change the campaign it was given', () => {
        const before = JSON.stringify([campaign, tracker]);
        stageEncounter(encounter, campaign, ['Zone A'], tracker);
        expect(JSON.stringify([campaign, tracker])).toBe(before);
    });

    test('staging twice adds a second, separate set', () => {
        const once = stageEncounter(encounter, campaign, ['Zone A']);
        const twice = stageEncounter(encounter, { enemy_list: once.enemy_list }, ['Zone A'], [...tracker, ...once.trackerPosts]);
        expect(twice.enemy_list).toHaveLength(1 + 4 + 4);
        expect(new Set(twice.enemy_list.map(enemy => enemy.id)).size).toBe(9);
    });
});

describe('removeEnemies', () => {
    test('takes the enemies out of the campaign\'s enemy list, leaving the rest (the tracker is on the party doc)', () => {
        const campaign = { enemy_list: [{ id: 'a' }, { id: 'b' }], combat_tracker: [{ id: 'npc:a' }] };
        expect(removeEnemies(campaign, ['a'])).toEqual({ enemy_list: [{ id: 'b' }] });
    });

    test('ids that are not there, and a campaign with nothing, are fine', () => {
        expect(removeEnemies({ enemy_list: [{ id: 'a' }] }, ['zzz'])).toEqual({ enemy_list: [{ id: 'a' }] });
        expect(removeEnemies({}, ['a'])).toEqual({ enemy_list: [] });
    });
});

describe('rosterSummary / summaryText', () => {
    const roster = [
        { count: 4, enemy: { enemy_type: 'Goon', maximum_health: 10, level: 1 } },
        { count: 2, enemy: { enemy_type: 'Veteran', maximum_health: 40, level: 3 } },
        { count: 1, enemy: { enemy_type: 'Captain', maximum_health: 100, level: 5 } },
    ];

    test('counts each tier, totals health, and finds the highest level', () => {
        expect(rosterSummary(roster)).toEqual({
            total: 7, totalHealth: 4 * 10 + 2 * 40 + 100, highestLevel: 5, untiered: 0,
            byTier: [{ key: 'Goon', plural: 'Goons', count: 4 }, { key: 'Veteran', plural: 'Veterans', count: 2 }, { key: 'Captain', plural: 'Captains', count: 1 }],
        });
    });

    test('an empty roster is all zeros', () => {
        expect(rosterSummary([])).toEqual({ total: 0, totalHealth: 0, highestLevel: 0, byTier: [], untiered: 0 });
        expect(rosterSummary()).toMatchObject({ total: 0 });
    });

    test('a missing count is one, and an enemy with no known tier is counted as untiered', () => {
        expect(rosterSummary([{ enemy: { enemy_type: 'Dragon', maximum_health: 5 } }])).toMatchObject({ total: 1, untiered: 1, totalHealth: 5, byTier: [] });
    });

    test('reads as a line: plurals for several, singular for one, untiered last', () => {
        expect(summaryText(rosterSummary(roster))).toBe('4 Goons, 2 Veterans, 1 Captain');
        expect(summaryText(rosterSummary([{ count: 1, enemy: { enemy_type: 'Elite' } }, { count: 2, enemy: {} }]))).toBe('1 Elite, 2 untiered');
        expect(summaryText(rosterSummary([]))).toBe('No enemies yet');
    });
});

describe('uniqueEnemyName', () => {
    test('keeps a name that is free, and numbers one that is not, from 2', () => {
        expect(uniqueEnemyName([], 'Wolf')).toBe('Wolf');
        expect(uniqueEnemyName(['Wolf'], 'Wolf')).toBe('Wolf 2');
        expect(uniqueEnemyName(['Wolf', 'Wolf 2'], 'Wolf')).toBe('Wolf 3');
    });

    test('skips numbers already taken, even out of order', () => {
        expect(uniqueEnemyName(['Wolf', 'Wolf 3'], 'Wolf')).toBe('Wolf 2');
    });

    test('a missing or blank name becomes "Enemy"', () => {
        expect(uniqueEnemyName(['Enemy'], undefined)).toBe('Enemy 2');
        expect(uniqueEnemyName([], '   ')).toBe('Enemy');
    });
});

describe('npcIdOf', () => {
    test('is an NPC\'s id in the campaign\'s lists, from its id on the combat tracker', () => {
        expect(npcIdOf('npc:goblin-1')).toBe('goblin-1');
        expect(npcIdOf('npc:a:b')).toBe('a:b');
    });

    test('is nothing for a player\'s character or anything else', () => {
        [ 'character:char-1', 'goblin-1', '', 'npc', null, undefined, 5 ].forEach(value => expect(npcIdOf(value)).toBeNull());
    });
});

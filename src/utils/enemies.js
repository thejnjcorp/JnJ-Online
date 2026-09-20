// Enemies and encounters.
//
// The bestiary (`enemies` collection) holds an enemy's stat block. An encounter
// holds a roster of them - each entry a copy of a stat block, with a count and
// where they start. Staging an encounter turns each roster entry into that many
// live enemies on the campaign (`enemy_list`, the shape the Director's page
// already runs) and places them on the combat tracker.
//
// An enemy's tier (Goon ... Set Piece) is only a label: a badge, a filter, a
// line in an encounter's summary. Everything that makes one stronger - HP, AC,
// actions - is numbers the director sets.

import { actionProblems } from './classValidation';

export const ENEMY_TIERS = [
    { key: 'Goon', plural: 'Goons' },
    { key: 'Regular', plural: 'Regulars' },
    { key: 'Veteran', plural: 'Veterans' },
    { key: 'Elite', plural: 'Elites' },
    { key: 'Captain', plural: 'Captains' },
    { key: 'Set Piece', plural: 'Set Pieces' },
];

export const tierOf = key => ENEMY_TIERS.find(tier => tier.key === key);
export const tierClass = key => `EnemyTier-${String(key || 'unknown').toLowerCase().replace(/\s+/g, '-')}`;

// The stat block fields an enemy carries from the bestiary into a fight. Same
// names NPCLayout.json (and everything on the Director's page) already uses.
export const ENEMY_STAT_FIELDS = [
    'enemy_name', 'enemy_type', 'level', 'base_armor_class', 'maximum_health', 'action_points', 'hardness',
    'strength_stat', 'dexterity_stat', 'intelligence_stat', 'charisma_stat',
    'base_hit_modifier', 'base_damage_modifier', 'base_damage_dice', 'base_damage_dice_type', 'base_healing_dice_type',
    'Weaknesses', 'Resistances', 'actions',
];

export function newEnemy(tier = 'Regular') {
    return {
        enemy_name: '', enemy_type: tier, level: 1, description: '',
        base_armor_class: 12, maximum_health: 10, action_points: 3, hardness: 0,
        strength_stat: 0, dexterity_stat: 0, intelligence_stat: 0, charisma_stat: 0,
        base_hit_modifier: 0, base_damage_modifier: 0, base_damage_dice: 1, base_damage_dice_type: 2, base_healing_dice_type: 1,
        Weaknesses: [], Resistances: [], actions: [],
    };
}

// "Fire 5" <-> { type: 'Fire', amount: 5 } - how weaknesses and resistances are
// written on an enemy (and shown as chips on its card).
export function parseModifier(text) {
    const match = /^(.*?)\s*(-?\d+)\s*$/.exec(text || '');
    return match ? { type: match[1].trim(), amount: Number(match[2]) } : { type: (text || '').trim(), amount: NaN };
}

export const formatModifier = ({ type, amount }) => `${(type || '').trim()} ${Number.isNaN(amount) ? '' : amount}`.trim();

const isInt = value => Number.isInteger(value);
const isBlank = value => typeof value !== 'string' || value.trim() === '';

const NUMBER_RULES = [
    ['level', 'Level', 1],
    ['base_armor_class', 'Armor Class', 0],
    ['maximum_health', 'Maximum Health', 1],
    ['action_points', 'Action Points', 0, 4],
    ['hardness', 'Hardness'],
    ['strength_stat', 'Strength'], ['dexterity_stat', 'Dexterity'], ['intelligence_stat', 'Intelligence'], ['charisma_stat', 'Charisma'],
    ['base_hit_modifier', 'Hit Modifier'], ['base_damage_modifier', 'Damage Modifier'],
    ['base_damage_dice', 'Damage dice', 1],
    ['base_damage_dice_type', 'Damage die', 1, 6],
    ['base_healing_dice_type', 'Healing die', 1, 6],
];

// Same shape as classValidation's: messages by field, actions by index, and
// `problems` (in page order) for the summary list.
export function validateEnemy(enemy) {
    const fields = {};
    const problems = [];
    const add = (id, field, label, message) => {
        fields[field] = message;
        problems.push({ id, label, message });
    };

    if (isBlank(enemy.enemy_name)) add('field-enemy_name', 'enemy_name', 'Name', 'Give the enemy a name.');
    if (!tierOf(enemy.enemy_type)) add('field-enemy_type', 'enemy_type', 'Tier', 'Pick a tier.');
    NUMBER_RULES.forEach(([field, label, min, max]) => {
        const value = enemy[field];
        let message;
        if (!isInt(value)) message = 'Enter a whole number.';
        else if (min !== undefined && value < min) message = max === undefined ? `Must be at least ${min}.` : `Must be from ${min} to ${max}.`;
        else if (max !== undefined && value > max) message = `Must be from ${min ?? 'any'} to ${max}.`;
        if (message) add(`field-${field}`, field, label, message);
    });
    ['Weaknesses', 'Resistances'].forEach(field => {
        const bad = (enemy[field] || []).findIndex(entry => !isInt(parseModifier(entry).amount) || parseModifier(entry).type === '');
        if (bad >= 0) add(`field-${field}`, field, field, 'Each one needs a type and an amount, like "Fire 5".');
    });

    const actions = actionProblems(enemy.actions);
    return { fields, actions: actions.byIndex, problems: [...problems, ...actions.problems], valid: problems.length === 0 && actions.problems.length === 0 };
}

// What an enemy's form saves: its stat block, notes and actions (with an outcome
// table that was switched on and then left empty taken off), and its trimmed name.
export function enemyDocFields(form) {
    const payload = { description: form.description || '' };
    ENEMY_STAT_FIELDS.forEach(field => { payload[field] = form[field]; });
    payload.actions = (form.actions || []).map(action => {
        if (action.outcomeTable && !Object.values(action.outcomeTable).some(Boolean)) {
            const { outcomeTable, ...rest } = action;
            return rest;
        }
        return action;
    });
    payload.enemy_name = (form.enemy_name || '').trim();
    return payload;
}

export const NO_ENEMY_ERRORS = Object.freeze({ fields: {}, actions: {}, problems: [], valid: true });

// A copy of a bestiary enemy for an encounter's roster: the stat block as it is
// now, with a count and a starting zone.
export function rosterEntry(enemyDoc, zone = '') {
    const enemy = {};
    ENEMY_STAT_FIELDS.forEach(field => { if (enemyDoc[field] !== undefined) enemy[field] = structuredClone(enemyDoc[field]); });
    return { id: crypto.randomUUID(), templateId: enemyDoc.id, count: 1, zone, enemy };
}

// The names a roster entry's enemies get: the name alone for one, numbered for
// several ("Rust Bandit 1", "Rust Bandit 2").
export function instanceNames(entry) {
    const name = (entry.enemy?.enemy_name || 'Enemy').trim();
    const count = Math.max(1, Number(entry.count) || 1);
    return count === 1 ? [name] : Array.from({ length: count }, (_, index) => `${name} ${index + 1}`);
}

// A live enemy, ready for the campaign's enemy_list: full health, full action
// points, no statuses.
export function enemyInstance(stats, name) {
    const instance = {};
    ENEMY_STAT_FIELDS.forEach(field => { if (stats[field] !== undefined) instance[field] = structuredClone(stats[field]); });
    return {
        ...instance,
        id: crypto.randomUUID(),
        enemy_name: name,
        current_health: stats.maximum_health,
        temporary_health: 0,
        action_points: stats.action_points ?? 3,
        statuses: [],
        experience_points: 0,
    };
}

// What staging an encounter changes: the campaign's enemy_list, and the posts to
// add to the combat tracker (which lives on the party doc, see utils/party.js).
// `campaign` is the campaign's current enemy_list, `tracker` the party's current
// combat tracker, `zoneNames` those of the active map. An enemy goes in the zone
// its entry asks for, else the first zone; with no map there are no zones, so
// nothing is placed (the tracker adds them once there is).
export function stageEncounter(encounter, campaign, zoneNames = [], tracker = []) {
    const enemies = [];
    const posts = [];
    const nextIndex = {};
    zoneNames.forEach(zone => { nextIndex[zone] = tracker.filter(post => post.status === zone).length; });

    (encounter.roster || []).forEach(entry => {
        const zone = zoneNames.includes(entry.zone) ? entry.zone : zoneNames[0];
        instanceNames(entry).forEach(name => {
            const enemy = enemyInstance(entry.enemy, name);
            enemies.push(enemy);
            if (zone !== undefined) posts.push({ id: `npc:${enemy.id}`, title: name, content: '', status: zone, index: nextIndex[zone]++ });
        });
    });

    return {
        enemy_list: [...(campaign.enemy_list || []), ...enemies],
        trackerPosts: posts,
        stagedIds: enemies.map(enemy => enemy.id),
    };
}

// The campaign's enemies with these enemies taken out. (Taking them off the combat
// tracker, on the party doc, is removeFromTracker in utils/party.js.)
export function removeEnemies(campaign, ids) {
    const gone = new Set(ids);
    return { enemy_list: (campaign.enemy_list || []).filter(enemy => !gone.has(enemy.id)) };
}

// The size of a fight at a glance: how many of each tier, and totals. Counts
// each entry's count, and uses each stat block's own numbers.
export function rosterSummary(roster = []) {
    const counts = {};
    let total = 0;
    let totalHealth = 0;
    let highestLevel = 0;
    roster.forEach(entry => {
        const count = Math.max(1, Number(entry.count) || 1);
        const enemy = entry.enemy || {};
        total += count;
        totalHealth += count * (Number(enemy.maximum_health) || 0);
        highestLevel = Math.max(highestLevel, Number(enemy.level) || 0);
        counts[enemy.enemy_type] = (counts[enemy.enemy_type] || 0) + count;
    });
    const byTier = ENEMY_TIERS.filter(tier => counts[tier.key]).map(tier => ({ key: tier.key, plural: tier.plural, count: counts[tier.key] }));
    return { total, totalHealth, highestLevel, byTier, untiered: total - byTier.reduce((sum, tier) => sum + tier.count, 0) };
}

// "4 Goons, 1 Captain" for a list of encounters; an enemy with no known tier
// is counted too, as "untiered".
export function summaryText(summary) {
    if (summary.total === 0) return 'No enemies yet';
    const parts = summary.byTier.map(tier => `${tier.count} ${tier.count === 1 ? tier.key : tier.plural}`);
    if (summary.untiered > 0) parts.push(`${summary.untiered} untiered`);
    return parts.join(', ');
}

// A name for one more of an enemy that doesn't repeat one already in the fight:
// the name itself if it's free, else "Name 2", "Name 3"...
export function uniqueEnemyName(existingNames, name) {
    const taken = new Set(existingNames);
    const base = (name || 'Enemy').trim() || 'Enemy';
    if (!taken.has(base)) return base;
    let number = 2;
    while (taken.has(`${base} ${number}`)) number++;
    return `${base} ${number}`;
}

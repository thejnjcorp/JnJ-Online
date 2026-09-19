// The JnJ Level 1 Encounter Balance Guide, as data and as checks.
//
// The guide is a starting benchmark for a five-character Level 1 party: a bank of
// numbers to build from, then adjust for special abilities, action economy,
// positioning, reinforcements and objectives. This file holds those numbers (so the
// encounter builder can compare a roster to them) and the guide's text (so the
// builder can show it as a cheat sheet). Everything here is advice - nothing stops
// a director from going over or under it.

export const rangeText = ([min, max]) => (min === max ? `${min}` : `${min}-${max}`);

// --- Enemy roles ------------------------------------------------------------
// Keyed by the enemy tier the bestiary uses. The guide calls the top role "Boss";
// the app calls it Captain.
export const ROLE_BENCHMARKS = {
    Goon: { role: 'Goon', hp: [1, 5], ac: [13, 14], attack: '+4 to +5', abilities: '3, 2, 1, 1', damage: 'd4+1', actions: [1, 2], actionsNote: 'with only one meaningful offensive action' },
    Regular: { role: 'Regular', hp: [12, 18], ac: [14, 15], attack: '+5', abilities: '4, 3, 2, 2', damage: 'd6+1', actions: [2, 2] },
    Veteran: { role: 'Veteran', hp: [20, 28], ac: [15, 16], attack: '+6', abilities: '4, 4, 3, 2 or 5, 3, 2, 2', damage: 'd6+2 / d8+1', actions: [2, 3] },
    Elite: { role: 'Elite', hp: [30, 45], ac: [16, 16], attack: '+6 to +7', abilities: '5, 4, 3, 2', damage: 'd8+2', actions: [2, 3] },
    Captain: { role: 'Boss / Captain', hp: [45, 70], ac: [16, 17], attack: '+7', abilities: '5, 4, 3, 3', damage: 'd8+2 / d10+1', actions: [3, 3] },
};

export const benchmarkFor = tierKey => ROLE_BENCHMARKS[tierKey] || null;

const FIELD_CHECKS = [
    { key: 'hp', label: 'HP', read: enemy => enemy.maximum_health, range: benchmark => benchmark.hp },
    { key: 'ac', label: 'AC', read: enemy => enemy.base_armor_class, range: benchmark => benchmark.ac },
    { key: 'actions', label: 'Actions', read: enemy => enemy.action_points, range: benchmark => benchmark.actions },
];

// How an enemy's HP, AC and actions compare with its role's benchmark: the
// benchmark, and the numbers that fall outside it.
export function checkEnemy(enemy) {
    const benchmark = benchmarkFor(enemy?.enemy_type);
    if (!benchmark) return { benchmark: null, issues: [] };
    const issues = [];
    FIELD_CHECKS.forEach(check => {
        const value = Number(check.read(enemy));
        if (check.read(enemy) === undefined || check.read(enemy) === null || Number.isNaN(value)) return;
        const [min, max] = check.range(benchmark);
        if (value < min) issues.push({ field: check.key, label: check.label, value, range: [min, max], status: 'below' });
        else if (value > max) issues.push({ field: check.key, label: check.label, value, range: [min, max], status: 'above' });
    });
    return { benchmark, issues };
}

// --- Encounter tiers --------------------------------------------------------
// The total enemy EHP a fight of that difficulty should have, how long it should
// last, and the meaningful enemy actions it should start with.
export const ENCOUNTER_TIERS = [
    { key: 'easy', label: 'Easy', ehp: [40, 60], rounds: '3-4 rounds', actions: [4, 6], zones: [3, 4] },
    { key: 'standard', label: 'Standard', ehp: [65, 90], rounds: '4-5 rounds', actions: [6, 8], zones: [3, 4] },
    { key: 'hard', label: 'Hard', ehp: [90, 120], rounds: '5-6 rounds', actions: [8, 9], zones: [3, 4] },
    { key: 'setpiece', label: 'Set Piece', ehp: [120, 160], rounds: '6-8 rounds', actions: [8, 10], actionsNote: 'then change through waves', zones: [4, 5] },
];

export const tierByKey = key => ENCOUNTER_TIERS.find(tier => tier.key === key) || null;

// Where a total of enemy HP lands among the tiers (the ranges touch at 90 and 120,
// so those count for the easier tier; 61-64 falls in the gap between Easy and
// Standard).
export function landingFor(total) {
    if (!(total > 0)) return null;
    if (total < ENCOUNTER_TIERS[0].ehp[0]) return { position: 'below' };
    const inside = ENCOUNTER_TIERS.find(tier => total >= tier.ehp[0] && total <= tier.ehp[1]);
    if (inside) return { position: 'in', tier: inside };
    for (let i = 0; i < ENCOUNTER_TIERS.length - 1; i++) {
        if (total > ENCOUNTER_TIERS[i].ehp[1] && total < ENCOUNTER_TIERS[i + 1].ehp[0]) return { position: 'between', lower: ENCOUNTER_TIERS[i], upper: ENCOUNTER_TIERS[i + 1] };
    }
    return { position: 'above' };
}

export function landingText(landing) {
    if (!landing) return '';
    if (landing.position === 'in') return `${landing.tier.label} (${rangeText(landing.tier.ehp)} EHP, ${landing.tier.rounds})`;
    if (landing.position === 'below') return `Lighter than an Easy fight (under ${ENCOUNTER_TIERS[0].ehp[0]} EHP)`;
    if (landing.position === 'between') return `Between ${landing.lower.label} and ${landing.upper.label}`;
    return `Bigger than a Set Piece (over ${ENCOUNTER_TIERS[ENCOUNTER_TIERS.length - 1].ehp[1]} EHP)`;
}

// --- Secondary objectives ---------------------------------------------------
// A non-damage objective takes the party's actions, so the fight against them
// should shrink to match. `reduce` is the guide's share to cut from enemy EHP.
export const OBJECTIVE_LOADS = [
    { key: 'light', label: 'Light', partyActions: '1-2', adjustment: 'Usually none', reduce: [0, 0] },
    { key: 'moderate', label: 'Moderate', partyActions: '3-5', adjustment: 'Reduce enemy EHP by about 10-15%, or remove one minor enemy', reduce: [0.1, 0.15] },
    { key: 'heavy', label: 'Heavy', partyActions: '6-9', adjustment: 'Reduce enemy EHP by about 20-25%, or reduce enemy action economy', reduce: [0.2, 0.25] },
    { key: 'primary', label: 'Primary objective', partyActions: '10+', adjustment: 'Enemies should mostly provide pressure; killing everything is not the actual win condition', reduce: null },
];

export const objectiveByKey = key => OBJECTIVE_LOADS.find(load => load.key === key) || null;

// The tier's EHP range once the objective has taken its share: cut by the
// smaller share at the top, the larger at the bottom, so the range stays wide
// enough to be honest about "about 10-15%".
export function adjustedEhpRange(range, objective) {
    const load = objectiveByKey(objective);
    if (!load?.reduce || load.reduce[1] === 0) return range;
    return [Math.round(range[0] * (1 - load.reduce[1])), Math.round(range[1] * (1 - load.reduce[0]))];
}

// --- The comparison ---------------------------------------------------------
export function rangeStatus(value, [min, max]) {
    if (value < min) return { state: 'under', by: min - value };
    if (value > max) return { state: 'over', by: value - max };
    return { state: 'within', by: 0 };
}

// Enemy HP and actions at the start for a roster (each entry counts `count`
// times), how the totals sit against the chosen target, and which enemies fall
// outside their role's benchmark. Printed HP and action points stand in for the
// guide's EHP and meaningful actions - the director adds resistance, healing,
// summons and so on on top.
export function evaluateEncounter({ roster = [], target = '', objective = '', zoneCount = 0 } = {}) {
    let enemies = 0;
    let hp = 0;
    let actions = 0;
    const flagged = [];
    roster.forEach(entry => {
        const count = Math.max(1, Number(entry.count) || 1);
        const enemy = entry.enemy || {};
        enemies += count;
        hp += count * (Number(enemy.maximum_health) || 0);
        actions += count * (Number(enemy.action_points) || 0);
        const { issues } = checkEnemy(enemy);
        if (issues.length > 0) flagged.push({ id: entry.id, name: enemy.enemy_name || 'Enemy', tier: enemy.enemy_type, issues });
    });

    const tier = tierByKey(target);
    const load = objectiveByKey(objective);
    const hpRange = tier ? adjustedEhpRange(tier.ehp, objective) : null;
    const zoneRange = tier ? tier.zones : null;
    return {
        enemies,
        hp,
        actions,
        landing: landingFor(hp),
        tier,
        objective: load,
        // "primary" has no number: the enemies are pressure, not the win condition
        hpRange: load && !load.reduce ? null : hpRange,
        hpBaseRange: tier ? tier.ehp : null,
        hpStatus: tier && !(load && !load.reduce) ? rangeStatus(hp, hpRange) : null,
        actionRange: tier ? tier.actions : null,
        actionStatus: tier ? rangeStatus(actions, tier.actions) : null,
        zoneRange,
        zoneStatus: tier && zoneCount > 0 ? rangeStatus(zoneCount, zoneRange) : null,
        flagged,
    };
}

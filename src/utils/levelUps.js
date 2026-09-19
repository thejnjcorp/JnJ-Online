// Level-ups: what a class hands out as a character levels, and claiming it.
//
// A character's level comes from its experience (1000 per level - see
// CharacterLevelCalculator). Several stats scale with level automatically
// through CharacterStatCalculator's table; what this adds are the choices and
// extras a *class* defines for itself (`level_rewards` on the class doc):
//
//   stat_point  +N to one ability score, the player's choice
//   bonus       a fixed bonus: AC, hit or damage modifier, max health, hardness
//   note        text shown at level-up, for anything else (pick a subclass...)
//
// New actions need no reward of their own: an action's Level (actionLevel) is
// when it unlocks - resolveCharacter hides it until the character gets there.
//
// Nothing is applied until it is claimed. A claim writes `claimed_level` (the
// highest level whose rewards have been taken), ability score changes straight
// onto the character, and the rest into `level_bonuses` - kept apart from the
// class-derived base stats so a class update can't erase them.

import { CharacterLevelCalculator } from '../components/CharacterStatCalculator';

export const MIN_REWARD_LEVEL = 2;
export const MAX_LEVEL = 15;
export const MAX_STAT_POINTS = 4;
export const MAX_BONUS = 10;

export const ABILITY_STATS = [
    { key: 'strength_stat', label: 'Strength' },
    { key: 'dexterity_stat', label: 'Dexterity' },
    { key: 'intelligence_stat', label: 'Intelligence' },
    { key: 'charisma_stat', label: 'Charisma' },
];

// `field`: what the bonus changes. A 'bonus' target is folded into the sheet's
// base stat by resolveCharacter (never written into the base itself); a
// 'field' target is a plain number on the character that is raised once.
export const BONUS_STATS = [
    { key: 'armor_class', label: 'Armor Class', target: 'bonus', field: 'base_armor_class' },
    { key: 'hit_modifier', label: 'Hit Modifier', target: 'bonus', field: 'base_hit_modifier' },
    { key: 'damage_modifier', label: 'Damage Modifier', target: 'bonus', field: 'base_damage_modifier' },
    { key: 'maximum_health', label: 'Maximum Health', target: 'field', field: 'maximum_health' },
    { key: 'hardness', label: 'Hardness', target: 'field', field: 'hardness' },
];

export const REWARD_KINDS = [
    { key: 'stat_point', label: 'Stat point' },
    { key: 'bonus', label: 'Bonus' },
    { key: 'note', label: 'Note' },
];

const bonusStat = key => BONUS_STATS.find(stat => stat.key === key);
const abilityStat = key => ABILITY_STATS.find(stat => stat.key === key);
const signed = amount => (amount > 0 ? `+${amount}` : String(amount));

export function levelOf(experience) {
    return Math.max(1, CharacterLevelCalculator(Number(experience) || 0));
}

const cappedLevelOf = character => Math.min(MAX_LEVEL, levelOf(character?.experience_points));

// The level whose rewards have been taken. Characters that predate this have
// taken none, so they start at 1.
export function claimedLevel(character) {
    return Number.isInteger(character?.claimed_level) ? character.claimed_level : 1;
}

export function newReward(level, kind) {
    const base = { id: crypto.randomUUID(), level, kind };
    if (kind === 'stat_point') return { ...base, points: 1 };
    if (kind === 'bonus') return { ...base, stat: 'armor_class', amount: 1 };
    return { ...base, text: '' };
}

export function describeReward(reward) {
    if (reward.kind === 'stat_point') return `${signed(reward.points)} to an ability score of your choice`;
    if (reward.kind === 'bonus') return `${signed(reward.amount)} ${bonusStat(reward.stat)?.label || reward.stat}`;
    return reward.text || '';
}

export const rewardsAtLevel = (classData, level) => (classData?.level_rewards || []).filter(reward => reward.level === level);

export const actionsUnlockedAt = (classData, level) => (classData?.actions || []).filter(action => (Number(action.actionLevel) || 1) === level);

// The levels this character has reached but not claimed that have something to
// claim, oldest first. `classData` is anything with level_rewards/actions - the
// resolved character itself works, as it carries the class's live values.
export function pendingLevelUps(character, classData = character) {
    const reached = cappedLevelOf(character);
    const pending = [];
    for (let level = claimedLevel(character) + 1; level <= reached; level++) {
        const rewards = rewardsAtLevel(classData, level);
        if (rewards.length > 0) pending.push({ level, rewards, unlockedActions: actionsUnlockedAt(classData, level) });
    }
    return pending;
}

// A stat-point reward is only claimable once an ability has been picked for it.
export function unchosenRewards(pending, choices) {
    return pending.flatMap(entry => entry.rewards)
        .filter(reward => reward.kind === 'stat_point' && !abilityStat(choices[reward.id]));
}

// The character-doc changes for claiming `pending` with `choices` (reward id ->
// ability key), computed from the character as it is now. Claims everything up
// to the character's level, including levels that had nothing to claim.
export function claimLevelUps(character, pending, choices, now = Date.now()) {
    const changes = {};
    const bonuses = { ...(character.level_bonuses || {}) };
    const history = [];

    pending.forEach(({ level, rewards }) => {
        const applied = [];
        rewards.forEach(reward => {
            if (reward.kind === 'stat_point') {
                const key = choices[reward.id];
                changes[key] = (Number(changes[key] ?? character[key]) || 0) + reward.points;
                applied.push(`${abilityStat(key).label} ${signed(reward.points)}`);
            } else if (reward.kind === 'bonus') {
                const stat = bonusStat(reward.stat);
                if (!stat) return;
                if (stat.target === 'bonus') {
                    bonuses[stat.key] = (Number(bonuses[stat.key]) || 0) + reward.amount;
                } else {
                    changes[stat.field] = (Number(changes[stat.field] ?? character[stat.field]) || 0) + reward.amount;
                }
                applied.push(describeReward(reward));
            } else if (reward.text) {
                applied.push(reward.text);
            }
        });
        history.push({ level, at: now, applied });
    });

    if (Object.keys(bonuses).length > 0) changes.level_bonuses = bonuses;
    changes.claimed_level = Math.max(claimedLevel(character), cappedLevelOf(character));
    changes.level_history = [...(character.level_history || []), ...history];
    return changes;
}

// Problems with a class's rewards for the editor: `errors` by reward id and
// field for inline messages, `problems` for the page's summary (same shape as
// classValidation's).
export function validateRewards(rewards) {
    const errors = {};
    const problems = [];
    (rewards || []).forEach(reward => {
        const found = {};
        const add = (field, label, message) => {
            found[field] = message;
            problems.push({ id: `reward-${reward.id}-${field}`, label: `Level ${reward.level} reward - ${label}`, message });
        };
        if (!Number.isInteger(reward.level) || reward.level < MIN_REWARD_LEVEL || reward.level > MAX_LEVEL) {
            add('level', 'level', `Level must be from ${MIN_REWARD_LEVEL} to ${MAX_LEVEL}.`);
        }
        if (reward.kind === 'stat_point') {
            if (!Number.isInteger(reward.points) || reward.points < 1 || reward.points > MAX_STAT_POINTS) {
                add('points', 'points', `Points must be a whole number from 1 to ${MAX_STAT_POINTS}.`);
            }
        } else if (reward.kind === 'bonus') {
            if (!bonusStat(reward.stat)) add('stat', 'stat', 'Pick what it changes.');
            if (!Number.isInteger(reward.amount) || reward.amount === 0 || Math.abs(reward.amount) > MAX_BONUS) {
                add('amount', 'amount', `Amount must be a whole number from -${MAX_BONUS} to ${MAX_BONUS}, and not 0.`);
            }
        } else if (reward.kind === 'note') {
            if (typeof reward.text !== 'string' || reward.text.trim() === '') add('text', 'note', 'Write the note.');
        } else {
            add('kind', 'type', 'Pick a reward type.');
        }
        if (Object.keys(found).length > 0) errors[reward.id] = found;
    });
    return { errors, problems };
}

// Single source of truth for "what kind of action is this" - prefers the
// explicit `category` field (added alongside Feat/Passive/Reaction/Action
// grouping in the class editor), but falls back to the pre-existing
// tags[].tagInfo string convention for any action authored before that
// field existed, so every class/character created before this change keeps
// classifying identically with zero data migration.
export function getActionCategory(action) {
    if (action.category) return action.category;
    if (action.tags?.some(tag => tag.tagInfo === 'Feat')) return 'feat';
    if (action.tags?.some(tag => tag.tagInfo === 'Passive')) return 'passive';
    if (action.tags?.some(tag => tag.tagInfo === 'Reaction')) return 'reaction';
    return 'action';
}

// Where an action is used: in a fight (the Combat tab, costing action points), in
// a scene (the Roleplay tab), or both. `usage` is optional - every action
// authored before it existed is a combat action, exactly as it was.
export const ACTION_USAGES = [
    { key: 'combat', label: 'Combat' },
    { key: 'roleplay', label: 'Roleplay' },
    { key: 'both', label: 'Both' },
];

export function getActionUsage(action) {
    return ACTION_USAGES.some(usage => usage.key === action?.usage) ? action.usage : 'combat';
}

export const isCombatAction = action => getActionUsage(action) !== 'roleplay';

export const isRoleplayAction = action => getActionUsage(action) !== 'combat';

export const usageBadge = action => ({ roleplay: 'Roleplay', both: 'Combat + Roleplay' })[getActionUsage(action)] || null;

// Everyone gets one reaction per turn (`reaction_used` on a character or enemy says
// whether it has been spent); using an action of this category spends it.
export const isReactionAction = action => getActionCategory(action) === 'reaction';

// A feat's tier (1-3), shown as filled circles on the sheet - see FeatEntry in
// SkillsAndFlaws.js. Authored on the feat itself in the class/race editor, so
// every character with it sees the same tier. One saved before tiers existed
// defaults to 1 rather than showing no circles at all.
export const FEAT_TIER_RANGE = { min: 1, max: 3 };

export function featTierOf(action) {
    const tier = Number(action?.tier);
    return Number.isInteger(tier) && tier >= FEAT_TIER_RANGE.min && tier <= FEAT_TIER_RANGE.max ? tier : FEAT_TIER_RANGE.min;
}

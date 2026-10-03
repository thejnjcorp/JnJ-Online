// Single source of truth for "what kind of action is this": the `category` the
// class editor sets (Feat, Passive, Reaction or Action); an action with none is
// an ordinary action.
export function getActionCategory(action) {
    return action.category || 'action';
}

// Where an action is used: in a fight (the Combat tab, costing action points), in
// a scene (the Roleplay tab), or both. `usage` is optional: an action with none is a
// combat action.
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
// every character with it sees the same tier. One with no tier
// defaults to 1 rather than showing no circles at all.
export const FEAT_TIER_RANGE = { min: 1, max: 3 };

export function featTierOf(action) {
    const tier = Number(action?.tier);
    return Number.isInteger(tier) && tier >= FEAT_TIER_RANGE.min && tier <= FEAT_TIER_RANGE.max ? tier : FEAT_TIER_RANGE.min;
}

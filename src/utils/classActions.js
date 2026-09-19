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

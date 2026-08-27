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

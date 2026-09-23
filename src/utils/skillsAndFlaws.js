// A skill or flaw's "level" (see the ruleset's Skills/Flaws section) - a named
// tier that gives a fixed roleplay modifier, added to the roll when it applies.
// Skills and flaws share the same 2/3/4/5 modifier scale but have their own
// names for it, so which list applies depends on isSkill.
export const SKILL_LEVELS = [
    { key: 'general', label: 'General', modifier: 2 },
    { key: 'trained', label: 'Trained', modifier: 3 },
    { key: 'specialized', label: 'Specialized', modifier: 4 },
    { key: 'ultimate', label: 'Ultimate', modifier: 5 },
];

export const FLAW_LEVELS = [
    { key: 'minor', label: 'Minor Flaw', modifier: 2 },
    { key: 'flaw', label: 'Flaw', modifier: 3 },
    { key: 'major', label: 'Major Flaw', modifier: 4 },
    { key: 'ptsd', label: 'PTSD', modifier: 5 },
];

export const levelsFor = isSkill => (isSkill ? SKILL_LEVELS : FLAW_LEVELS);

// An entry's level - or, for one saved before levels existed (it only has the
// old 1-3 degree), the level that degree maps onto: 1 and 2 keep their place,
// 3 becomes the third level (Specialized/Major). Nothing saved back then ever
// reaches the fourth (Ultimate/PTSD) - that has to be chosen deliberately.
export function levelOf(entry) {
    const levels = levelsFor(entry.isSkill);
    const byKey = levels.find(level => level.key === entry.level);
    if (byKey) return byKey;
    if (Number.isInteger(entry.degree)) return levels[Math.min(Math.max(entry.degree, 1), levels.length) - 1];
    return levels[0];
}

export const modifierOf = entry => levelOf(entry).modifier;

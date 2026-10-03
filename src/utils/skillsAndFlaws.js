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

// An entry's level: the one it names, or the first (General / Minor Flaw) for one that names none.
export function levelOf(entry) {
    const levels = levelsFor(entry.isSkill);
    return levels.find(level => level.key === entry.level) || levels[0];
}

export const modifierOf = entry => levelOf(entry).modifier;

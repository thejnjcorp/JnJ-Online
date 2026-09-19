// Pure helpers for resolving a character's class and race data from the
// class/race versions it's pinned to (see useClassVersion.js), instead of
// from the copies made at creation. The copies on the character doc stay
// around as a fallback for anything that can't be read (someone else's
// Private class, a deleted race).

function isRealId(value) {
    // CharacterPageLayout.json's placeholder class_id is the literal "id",
    // which shows up on legacy characters that never had one.
    return typeof value === 'string' && value !== '' && value !== 'id';
}

// A character is "linked" once it has a real id and a pinned version.
export function isLinkedToClass(character) {
    return Number.isInteger(character?.class_version) && isRealId(character?.class_id);
}

export function isLinkedToRace(character) {
    return Number.isInteger(character?.race_version) && isRealId(character?.race_id);
}

// A race grants a list of actions/feats. Older race docs stored a single
// `feat` instead, which keeps working until the race is re-saved.
export function raceActionsOf(race) {
    return race?.actions ?? (race?.feat ? [race.feat] : []);
}

// The race's actions as saved on the character. Legacy characters have them
// merged into `actions` already (and older ones a single race_feat).
export function savedRaceActions(character) {
    return character?.race_actions ?? (character?.race_feat ? [character.race_feat] : []);
}

function mergeByName(actions, extras) {
    const missing = extras.filter(extra => !actions.some(action => action.actionName === extra.actionName));
    return missing.length > 0 ? [...actions, ...missing] : actions;
}

export function savedActions(character) {
    return mergeByName(character?.actions || [], savedRaceActions(character));
}

// Only overwrites a field when the class actually defines it, so a class doc
// missing (say) base_healing_dice_type leaves the character's value alone.
const CLASS_DERIVED_FIELDS = [
    'class_name',
    'class_type',
    'base_armor_class',
    'base_hit_modifier',
    'base_healing_dice_type',
];

function applyClassFields(character, classData) {
    const resolved = { ...character };
    CLASS_DERIVED_FIELDS.forEach(field => {
        if (classData[field] !== undefined) resolved[field] = classData[field];
    });
    // The class doc calls it `description`; sheets read `class_description`.
    if (classData.description !== undefined) resolved.class_description = classData.description;
    return resolved;
}

export function applyClassToCharacter(character, classData) {
    if (!classData) return character;
    const resolved = applyClassFields(character, classData);
    resolved.actions = [...(classData.actions || []), ...savedRaceActions(character)];
    return resolved;
}

// What every consumer should render: live class/race data where a character
// is linked and the data has loaded, otherwise the saved copies.
export function resolveCharacter(character, classData, raceData) {
    const classLive = isLinkedToClass(character) && classData;
    const raceLive = isLinkedToRace(character) && raceData;
    const hasSavedRace = Boolean(character?.race_feat) || (character?.race_actions?.length > 0);
    if (!classLive && !raceLive && !hasSavedRace) return character;

    const resolved = classLive ? applyClassFields(character, classData) : { ...character };
    const classActions = classLive ? (classData.actions || []) : (character.actions || []);
    const raceActions = raceLive ? raceActionsOf(raceData) : savedRaceActions(character);
    resolved.actions = mergeByName(classActions, raceActions);
    if (raceLive && raceData.name !== undefined) resolved.race_name = raceData.name;
    return resolved;
}

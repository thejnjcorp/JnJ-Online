// Pure helpers for resolving a character's class data from the class it's
// pinned to (see useClassVersion.js), instead of from the copy made at
// creation. The copy on the character doc stays around as a fallback for
// classes that can't be read (someone else's Private class, a deleted class).

// A character is "linked" once it has a real class id and a pinned version.
// CharacterPageLayout.json's placeholder class_id is the literal "id", which
// shows up on legacy characters that never had one.
export function isLinkedToClass(character) {
    return Number.isInteger(character?.class_version)
        && typeof character?.class_id === 'string'
        && character.class_id !== ''
        && character.class_id !== 'id';
}

// The race feat lives in its own field on linked characters (it can't be
// told apart from a class feat once merged into `actions`). Legacy characters
// have it merged into `actions` already and no race_feat field.
export function savedActions(character) {
    const actions = character?.actions || [];
    const raceFeat = character?.race_feat;
    if (raceFeat && !actions.some(action => action.actionName === raceFeat.actionName)) {
        return [...actions, raceFeat];
    }
    return actions;
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

export function applyClassToCharacter(character, classData) {
    if (!classData) return character;
    const resolved = { ...character };
    CLASS_DERIVED_FIELDS.forEach(field => {
        if (classData[field] !== undefined) resolved[field] = classData[field];
    });
    // The class doc calls it `description`; sheets read `class_description`.
    if (classData.description !== undefined) resolved.class_description = classData.description;
    resolved.actions = [...(classData.actions || []), ...(character.race_feat ? [character.race_feat] : [])];
    return resolved;
}

// What every consumer should render: live class data when linked and loaded,
// otherwise the saved copy.
export function resolveCharacter(character, classData) {
    if (isLinkedToClass(character) && classData) return applyClassToCharacter(character, classData);
    if (!character?.race_feat) return character;
    return { ...character, actions: savedActions(character) };
}

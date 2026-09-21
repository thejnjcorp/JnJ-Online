// Pure helpers for resolving a character's class and race data from the
// class/race versions it's pinned to (see useClassVersion.js), instead of
// from the copies made at creation. The copies on the character doc stay
// around as a fallback for anything that can't be read (someone else's
// Private class, a deleted race).

import { BONUS_STATS, levelOf } from './levelUps';

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

// The class a character's card names. A character made since classes were reworked
// keeps its class's name as `class_name` (with its `class_id`); one from before that
// has the older `class` text instead.
export const characterClassName = character => character?.class_name || character?.class || '';

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
    'level_rewards',
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

// The parts of the sheet that depend on the character's level: the bonuses it
// has claimed from level-ups are added to the base stats they change (never
// written back into them), and an action stays hidden until the character has
// reached its Level.
function applyLevelState(character) {
    if (!character) return character;
    const level = levelOf(character.experience_points);
    const bonuses = character.level_bonuses;
    const bonusStats = bonuses ? BONUS_STATS.filter(stat => stat.target === 'bonus' && Number(bonuses[stat.key])) : [];
    const unlocked = character.actions?.filter(action => (Number(action.actionLevel) || 1) <= level);
    const hidesActions = unlocked && unlocked.length !== character.actions.length;
    if (bonusStats.length === 0 && !hidesActions) return character;

    const resolved = { ...character };
    if (hidesActions) resolved.actions = unlocked;
    bonusStats.forEach(stat => { resolved[stat.field] = (Number(resolved[stat.field]) || 0) + Number(bonuses[stat.key]); });
    return resolved;
}

// What every consumer should render: live class/race data where a character
// is linked and the data has loaded, otherwise the saved copies.
export function resolveCharacter(character, classData, raceData) {
    return applyLevelState(resolveLinkedData(character, classData, raceData));
}

function resolveLinkedData(character, classData, raceData) {
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

// A class doc's own bookkeeping (who can edit it, its visibility, its version
// history) doesn't belong on a character. Permissions in particular must never
// be copied over: they are the character's own.
const CLASS_ONLY_FIELDS = ['id', 'canWrite', 'canRead', 'admins', 'author', 'public', 'isDefault', 'visibility', 'version', 'versionNotes', 'publishedAt', 'description'];

// The character-doc fields for giving a character this class - the saved copy
// it falls back to, pinned to the class's current version.
export function classToCharacterFields(classDoc) {
    const fields = {};
    Object.entries(classDoc).forEach(([key, value]) => {
        if (!CLASS_ONLY_FIELDS.includes(key) && value !== undefined) fields[key] = value;
    });
    return {
        ...fields,
        class_id: classDoc.id,
        class_description: classDoc.description ?? '',
        class_version: classDoc.version ?? 1,
        actions: classDoc.actions || [],
    };
}

// The same for a race.
export function raceToCharacterFields(raceDoc) {
    return {
        race_id: raceDoc.id,
        race_name: raceDoc.name ?? '',
        race_version: raceDoc.version ?? 1,
        race_actions: raceActionsOf(raceDoc),
    };
}

// Who may change what a character is (its class, race and stats) rather than
// just play it: the character's own admins and player, and the directors of its
// campaign.
export function canAdministerCharacter(character, campaign, userId) {
    if (!userId) return false;
    const isCharacterAdmin = character?.admins?.includes(userId) || character?.playerId === userId || character?.userId === userId;
    const isDirector = campaign?.director_uid === userId || Boolean(campaign?.canWrite?.includes(userId)) || Boolean(campaign?.admins?.includes(userId));
    return Boolean(isCharacterAdmin) || isDirector;
}

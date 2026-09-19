// What a class or race has to look like before it can be saved. These are the
// constraints the rest of the app actually depends on, not just "field isn't
// blank": CombatActionList splits an action's difficultyClass on a comma and
// adds a numeric modifier to the class DC (so "Dex" alone renders "DCNaN
// check"), does arithmetic on toHit, and CharacterDiceConverter only knows
// dice codes 1-6. A blank Range is fine - the sheet simply omits it.
//
// Every validator returns messages keyed by field name, and validateClass /
// validateRace also flatten them into `problems` (in the order they appear on
// the page) for the summary list. `id` matches the data-problem attribute on
// the offending input, which is how the summary scrolls to it.

import { CharacterDiceConverter } from '../components/CharacterStatCalculator';
import { validateRewards } from './levelUps';

export const CLASS_TYPES = ['Attrionist', 'Crit Hunter', 'Manipulator', 'Snowballer'];
export const ACTION_TYPES = ['standard', 'perDay', 'perShortRest', 'perCombat'];
export const ACTION_CATEGORIES = ['feat', 'passive', 'reaction', 'action'];
export const ACTION_COST_RANGE = { min: 0, max: 3 };
export const ACTION_LEVEL_RANGE = { min: 1, max: 15 };

const isNumber = value => typeof value === 'number' && Number.isFinite(value);
const isBlank = value => typeof value !== 'string' || value.trim() === '';
const isWholeNumberIn = (value, { min, max }) => Number.isInteger(value) && value >= min && (max === undefined || value <= max);
const isDie = value => CharacterDiceConverter(value) !== 'N/A';
// "Stat,Modifier" - only the modifier is used in the math, but it has to be a number.
const DIFFICULTY_CLASS_PATTERN = /^[^,]+,\s*[+-]?\d+\s*$/;

export function validateAction(action) {
    const errors = {};
    if (isBlank(action.actionName)) errors.actionName = 'Give this action a name.';
    if (!isWholeNumberIn(action.actionCost, ACTION_COST_RANGE)) errors.actionCost = `Cost must be a whole number from ${ACTION_COST_RANGE.min} to ${ACTION_COST_RANGE.max}.`;
    if (!isWholeNumberIn(action.actionLevel, ACTION_LEVEL_RANGE)) errors.actionLevel = `Level must be a whole number from ${ACTION_LEVEL_RANGE.min} to ${ACTION_LEVEL_RANGE.max}.`;
    if (!ACTION_TYPES.includes(action.actionType)) errors.actionType = 'Pick how often this can be used.';
    else if (action.actionType !== 'standard' && !isWholeNumberIn(action.actionTypeCount, { min: 1 })) errors.actionTypeCount = 'Enter how many times (1 or more).';
    if (action.category !== undefined && !ACTION_CATEGORIES.includes(action.category)) errors.category = 'Pick a category.';
    if (action.toHitBool) {
        if (!isNumber(action.toHit)) errors.toHit = 'Enter a to-hit modifier (0 is fine).';
    } else if (typeof action.difficultyClass !== 'string' || !DIFFICULTY_CLASS_PATTERN.test(action.difficultyClass)) {
        errors.difficultyClass = 'Use "Stat,Modifier", for example Dex,0.';
    }
    return errors;
}

function actionLabel(action, index) {
    return isBlank(action.actionName) ? `Action #${index + 1} (unnamed)` : `Action "${action.actionName}"`;
}

const ACTION_FIELD_LABELS = {
    actionName: 'name', actionCost: 'cost', actionLevel: 'level', actionType: 'frequency',
    actionTypeCount: 'times', category: 'category', toHit: 'to-hit', difficultyClass: 'DC',
};

export function actionProblems(actions) {
    const byIndex = {};
    const problems = [];
    (actions || []).forEach((action, index) => {
        const errors = validateAction(action);
        if (Object.keys(errors).length === 0) return;
        byIndex[index] = errors;
        Object.entries(errors).forEach(([field, message]) => {
            problems.push({
                id: `action-${index}-${field}`,
                label: `${actionLabel(action, index)} - ${ACTION_FIELD_LABELS[field]}`,
                message,
            });
        });
    });
    return { byIndex, problems };
}

const CLASS_NUMBER_FIELDS = [
    ['base_armor_class', 'Armor Class'],
    ['base_hit_modifier', 'Hit Modifier'],
    ['base_class_damage_class', 'Class DC'],
    ['base_hardness', 'Hardness'],
];

const DAMAGE_KINDS = [['melee', 'Melee'], ['ranged', 'Ranged']];

function finish(fields, actions, orderedProblems, rewards = { errors: {} }) {
    return {
        fields,
        actions: actions.byIndex,
        rewards: rewards.errors,
        problems: orderedProblems,
        valid: orderedProblems.length === 0,
    };
}

export function validateClass(formData) {
    const fields = {};
    const problems = [];
    const add = (field, label, message) => {
        fields[field] = message;
        problems.push({ id: `field-${field}`, label, message });
    };

    if (isBlank(formData.class_name)) add('class_name', 'Class name', 'Give the class a name.');
    if (isBlank(formData.author)) add('author', 'Author', 'Add an author.');
    if (!CLASS_TYPES.includes(formData.class_type)) add('class_type', 'Class type', 'Pick a class type.');
    CLASS_NUMBER_FIELDS.forEach(([field, label]) => {
        if (!isNumber(formData[field])) add(field, label, 'Enter a number.');
    });
    const dieMessage = 'Use d4, d6, d8, d10, d12 or d20.';
    if (!isDie(formData.base_health_dice)) add('base_health_dice', 'Base Health Dice', dieMessage);
    DAMAGE_KINDS.forEach(([kind, label]) => {
        if (!isNumber(formData[`base_${kind}_damage_dice`])) add(`base_${kind}_damage_dice`, `${label} damage dice`, 'Enter how many dice.');
        if (!isDie(formData[`base_${kind}_damage_dice_type`])) add(`base_${kind}_damage_dice_type`, `${label} damage die`, 'Pick a die.');
        if (!isNumber(formData[`base_${kind}_damage_modifier`])) add(`base_${kind}_damage_modifier`, `${label} damage modifier`, 'Enter a number (0 is fine).');
    });
    if (!isDie(formData.base_healing_dice_type)) add('base_healing_dice_type', 'Base Healing Dice Type', dieMessage);

    const actions = actionProblems(formData.actions);
    const rewards = validateRewards(formData.level_rewards);
    return finish(fields, actions, [...problems, ...actions.problems, ...rewards.problems], rewards);
}

export function validateRace(formData) {
    const fields = {};
    const problems = [];
    if (isBlank(formData.name)) {
        fields.name = 'Give the race a name.';
        problems.push({ id: 'field-name', label: 'Race name', message: fields.name });
    }
    if (isBlank(formData.author)) {
        fields.author = 'Add an author.';
        problems.push({ id: 'field-author', label: 'Author', message: fields.author });
    }
    const actions = actionProblems(formData.actions);
    return finish(fields, actions, [...problems, ...actions.problems]);
}

export const NO_ERRORS = Object.freeze({ fields: {}, actions: {}, rewards: {}, problems: [], valid: true });

// A new action starts out valid apart from its name, so the only thing left to
// do is name it. Feats and passives are free; reactions and actions cost 1.
export function newActionDefaults(category) {
    return {
        id: crypto.randomUUID(),
        category,
        actionCost: category === 'feat' || category === 'passive' ? 0 : 1,
        actionLevel: 1,
        actionType: 'standard',
        toHitBool: false,
        difficultyClass: 'Dex,0',
    };
}

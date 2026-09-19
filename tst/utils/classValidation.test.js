import { validateAction, validateClass, validateRace, newActionDefaults, NO_ERRORS } from '../../src/utils/classValidation';
import { validAction } from '../testUtils/actions';
// The class write-ups published to production - the same content the Gunslinger
// edit tripped over. Every action in them has to pass the page's own validation.
const classUpdates = require('../../firebase/data/class-updates');

const validClass = (overrides = {}) => ({
    class_name: 'Fighter', author: 'Sam', class_type: 'Attrionist',
    base_armor_class: 12, base_health_dice: 3, base_hit_modifier: 2, base_healing_dice_type: 2,
    base_class_damage_class: 14, base_hardness: 0,
    base_melee_damage_dice: 1, base_melee_damage_dice_type: 2, base_melee_damage_modifier: 0,
    base_ranged_damage_dice: 1, base_ranged_damage_dice_type: 2, base_ranged_damage_modifier: 0,
    actions: [validAction()],
    ...overrides,
});

describe('validateAction', () => {
    test('a complete action has no errors', () => {
        expect(validateAction(validAction())).toEqual({});
    });

    test('an empty Range is fine - it is the most common thing in a real class', () => {
        expect(validateAction(validAction({ range: '' }))).toEqual({});
        expect(validateAction(validAction({ range: undefined }))).toEqual({});
    });

    test.each([
        [{ actionName: '' }, 'actionName'],
        [{ actionName: '   ' }, 'actionName'],
        [{ actionName: undefined }, 'actionName'],
    ])('a blank name (%j) is caught', (overrides, field) => {
        expect(Object.keys(validateAction(validAction(overrides)))).toEqual([field]);
    });

    test.each([
        [-1, false], [0, true], [3, true], [4, false], [1.5, false], [NaN, false], [undefined, false], ['2', false],
    ])('cost %p valid=%p', (cost, ok) => {
        const errors = validateAction(validAction({ actionCost: cost }));
        expect('actionCost' in errors).toBe(!ok);
    });

    test.each([[0, false], [1, true], [15, true], [16, false], [undefined, false]])('level %p valid=%p', (level, ok) => {
        expect('actionLevel' in validateAction(validAction({ actionLevel: level }))).toBe(!ok);
    });

    test('an unknown frequency is caught, and a limited-use one needs a count of at least 1', () => {
        expect(validateAction(validAction({ actionType: 'sometimes' }))).toHaveProperty('actionType');
        expect(validateAction(validAction({ actionType: 'perDay' }))).toHaveProperty('actionTypeCount');
        expect(validateAction(validAction({ actionType: 'perDay', actionTypeCount: 0 }))).toHaveProperty('actionTypeCount');
        expect(validateAction(validAction({ actionType: 'perDay', actionTypeCount: 2 }))).toEqual({});
        expect(validateAction(validAction({ actionType: 'standard' }))).toEqual({});
    });

    test('a to-hit action needs a numeric modifier (zero and negatives are fine); a DC action needs "Stat,Modifier"', () => {
        const toHit = overrides => validAction({ toHitBool: true, difficultyClass: undefined, ...overrides });
        expect(validateAction(toHit({ toHit: 0 }))).toEqual({});
        expect(validateAction(toHit({ toHit: -1 }))).toEqual({});
        expect(validateAction(toHit({ toHit: undefined }))).toHaveProperty('toHit');
        expect(validateAction(toHit({ toHit: NaN }))).toHaveProperty('toHit');

        ['Dex,0', 'Str, -1', 'Int,+2', 'Cha , 3'].forEach(dc => expect(validateAction(validAction({ difficultyClass: dc }))).toEqual({}));
        ['', 'Dex', 'Dex,', ',0', 'Dex,x', undefined].forEach(dc => expect(validateAction(validAction({ difficultyClass: dc }))).toHaveProperty('difficultyClass'));
    });

    test('a to-hit action is not asked for a DC, and a DC action is not asked for a to-hit', () => {
        expect(validateAction(validAction({ toHitBool: true, toHit: 1, difficultyClass: undefined }))).toEqual({});
        expect(validateAction(validAction({ toHitBool: false, toHit: undefined }))).toEqual({});
    });

    test('a category is optional (older actions have none) but must be a real one when present', () => {
        expect(validateAction(validAction({ category: undefined }))).toEqual({});
        expect(validateAction(validAction({ category: 'bonus' }))).toHaveProperty('category');
    });

    test('reports every problem at once, not just the first', () => {
        const errors = validateAction({ toHitBool: false });
        expect(Object.keys(errors).sort()).toEqual(['actionCost', 'actionLevel', 'actionName', 'actionType', 'difficultyClass']);
    });
});

describe('validateClass', () => {
    test('a complete class is valid', () => {
        const result = validateClass(validClass());
        expect(result.valid).toBe(true);
        expect(result.problems).toEqual([]);
    });

    test('an untouched form reports every required field, in page order', () => {
        const result = validateClass({});
        expect(result.valid).toBe(false);
        expect(result.problems.map(p => p.id)).toEqual([
            'field-class_name', 'field-author', 'field-class_type',
            'field-base_armor_class', 'field-base_hit_modifier', 'field-base_class_damage_class', 'field-base_hardness',
            'field-base_health_dice',
            'field-base_melee_damage_dice', 'field-base_melee_damage_dice_type', 'field-base_melee_damage_modifier',
            'field-base_ranged_damage_dice', 'field-base_ranged_damage_dice_type', 'field-base_ranged_damage_modifier',
            'field-base_healing_dice_type',
        ]);
    });

    test('dice must be real dice codes (a typed "d7" becomes 0, and 7 is out of range)', () => {
        expect(validateClass(validClass({ base_health_dice: 0 })).fields).toHaveProperty('base_health_dice');
        expect(validateClass(validClass({ base_healing_dice_type: 7 })).fields).toHaveProperty('base_healing_dice_type');
        expect(validateClass(validClass({ base_melee_damage_dice_type: 6 })).valid).toBe(true);
    });

    test('numbers must be numbers, but zero is fine', () => {
        expect(validateClass(validClass({ base_hardness: 0, base_melee_damage_modifier: 0 })).valid).toBe(true);
        expect(validateClass(validClass({ base_armor_class: undefined })).fields).toHaveProperty('base_armor_class');
        expect(validateClass(validClass({ base_armor_class: NaN })).fields).toHaveProperty('base_armor_class');
        expect(validateClass(validClass({ base_armor_class: '12' })).fields).toHaveProperty('base_armor_class');
    });

    test('an unknown class type is rejected', () => {
        expect(validateClass(validClass({ class_type: 'Wizard' })).fields).toHaveProperty('class_type');
    });

    test('action problems are labelled with the action and indexed by position, after the class fields', () => {
        const result = validateClass(validClass({
            class_name: '',
            actions: [validAction(), validAction({ actionName: 'Hot Shot', difficultyClass: 'Dex' }), validAction({ actionName: '', actionCost: 9 })],
        }));

        expect(Object.keys(result.actions)).toEqual(['1', '2']);
        expect(result.problems.map(p => p.id)).toEqual(['field-class_name', 'action-1-difficultyClass', 'action-2-actionName', 'action-2-actionCost']);
        expect(result.problems[1].label).toBe('Action "Hot Shot" - DC');
        expect(result.problems[2].label).toBe('Action #3 (unnamed) - name');
    });

    test('a class with no actions at all is valid', () => {
        expect(validateClass(validClass({ actions: undefined })).valid).toBe(true);
        expect(validateClass(validClass({ actions: [] })).valid).toBe(true);
    });
});

describe('validateRace', () => {
    test('needs a name and an author, and validates its actions the same way', () => {
        expect(validateRace({ name: 'Kobold', author: 'Sam', actions: [validAction()] }).valid).toBe(true);
        expect(validateRace({}).problems.map(p => p.id)).toEqual(['field-name', 'field-author']);
        expect(validateRace({ name: 'x', author: 'y', actions: [validAction({ actionCost: 5 })] }).problems.map(p => p.id)).toEqual(['action-0-actionCost']);
    });
});

describe('newActionDefaults', () => {
    test.each([['feat', 0], ['passive', 0], ['reaction', 1], ['action', 1]])('a new %s costs %i and is valid once named', (category, cost) => {
        const action = newActionDefaults(category);
        expect(action.actionCost).toBe(cost);
        expect(action.category).toBe(category);
        expect(action.id).toBeTruthy();
        expect(Object.keys(validateAction(action))).toEqual(['actionName']);
        expect(validateAction({ ...action, actionName: 'Named' })).toEqual({});
    });
});

describe('the class write-ups published to production', () => {
    test.each(classUpdates.map(entry => [entry.class_name, entry]))('every action in %s passes the same validation the class page applies', (_name, entry) => {
        entry.content.actions.forEach(action => {
            expect({ action: action.actionName, errors: validateAction(action) }).toEqual({ action: action.actionName, errors: {} });
        });
    });

    test('the whole class is valid once the fields the write-up leaves to the existing class are supplied', () => {
        classUpdates.forEach(entry => {
            const existing = { author: 'Jonah', class_type: 'Attrionist', base_healing_dice_type: 2, base_hardness: 0, ...entry.create };
            const result = validateClass({ ...existing, ...entry.content });
            expect({ class: entry.class_name, problems: result.problems }).toEqual({ class: entry.class_name, problems: [] });
        });
    });

    test('the Gunslinger has actions with an empty Range, which the old check wrongly rejected', () => {
        const gunslinger = classUpdates.find(entry => entry.class_name === 'Gunslinger');
        expect(gunslinger.content.actions.filter(action => action.range === '').length).toBeGreaterThan(0);
    });
});

describe('NO_ERRORS', () => {
    test('is a frozen, empty result the pages use while errors are hidden', () => {
        expect(NO_ERRORS).toEqual({ fields: {}, actions: {}, rewards: {}, problems: [], valid: true });
        expect(Object.isFrozen(NO_ERRORS)).toBe(true);
    });
});

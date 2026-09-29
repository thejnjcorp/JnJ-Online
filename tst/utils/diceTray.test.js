import {
    DIE_SIDES, breakdownText, diceColorContext, diceTotal, emptyPool, formatModifier, grandTotal, individualValues, poolCount, poolSummary,
} from '../../src/utils/diceTray';

describe('emptyPool', () => {
    test('is zero for every die side, and a fresh object each time', () => {
        const pool = emptyPool();
        DIE_SIDES.forEach(sides => expect(pool[sides]).toBe(0));
        pool[6] = 3;
        expect(emptyPool()[6]).toBe(0);
    });
});

describe('poolCount', () => {
    test('sums however many dice are in the pool', () => {
        expect(poolCount(emptyPool())).toBe(0);
        expect(poolCount({ ...emptyPool(), 6: 2, 20: 1 })).toBe(3);
    });
});

describe('poolSummary', () => {
    test('lists only the die sides that have any, in DIE_SIDES order', () => {
        expect(poolSummary({ ...emptyPool(), 20: 1, 6: 2 })).toBe('2d6, 1d20');
    });

    test('is empty when the tray has nothing in it', () => {
        expect(poolSummary(emptyPool())).toBe('');
    });
});

describe('reading dice-box\'s results, either shape it might return', () => {
    const flat = [{ sides: 6, value: 4 }, { sides: 6, value: 2 }, { sides: 20, value: 15 }];
    const grouped = [{ sides: 6, qty: 2, value: 6, rolls: [{ value: 4 }, { value: 2 }] }, { sides: 20, qty: 1, value: 15, rolls: [{ value: 15 }] }];

    test('individualValues flattens either shape to the same die values', () => {
        expect(individualValues(flat)).toEqual([4, 2, 15]);
        expect(individualValues(grouped)).toEqual([4, 2, 15]);
    });

    test('diceTotal sums either shape the same way', () => {
        expect(diceTotal(flat)).toBe(21);
        expect(diceTotal(grouped)).toBe(21);
    });

    test('is 0 for no results at all, not NaN or a crash', () => {
        expect(diceTotal([])).toBe(0);
        expect(diceTotal(undefined)).toBe(0);
        expect(individualValues(undefined)).toEqual([]);
    });

    test('a garbled value (not a number) counts as 0 rather than poisoning the total', () => {
        expect(diceTotal([{ value: 'oops' }, { value: 5 }])).toBe(5);
    });
});

describe('grandTotal', () => {
    test('is the dice total plus the modifier', () => {
        expect(grandTotal([{ value: 4 }, { value: 6 }], 3)).toBe(13);
        expect(grandTotal([{ value: 4 }], -2)).toBe(2);
    });

    test('a missing or non-numeric modifier counts as 0', () => {
        expect(grandTotal([{ value: 4 }], undefined)).toBe(4);
        expect(grandTotal([{ value: 4 }], NaN)).toBe(4);
    });
});

describe('formatModifier', () => {
    test('a positive modifier is shown with a leading +', () => {
        expect(formatModifier(3)).toBe('+3');
    });

    test('a negative modifier already has its own sign', () => {
        expect(formatModifier(-2)).toBe('-2');
    });

    test('zero is nothing at all', () => {
        expect(formatModifier(0)).toBe('');
    });
});

describe('diceColorContext', () => {
    test('a character sheet ties the colour to that character', () => {
        expect(diceColorContext('/characters/char-1')).toEqual({ collection: 'characters', id: 'char-1' });
    });

    test('a director view ties the colour to the campaign', () => {
        expect(diceColorContext('/directors/camp-1')).toEqual({ collection: 'campaigns', id: 'camp-1' });
        expect(diceColorContext('/directors/camp-1/encounters')).toEqual({ collection: 'campaigns', id: 'camp-1' });
    });

    test('is null anywhere the tray itself is not offered', () => {
        expect(diceColorContext('/characters')).toBeNull();
        expect(diceColorContext('/directors')).toBeNull();
        expect(diceColorContext('/home')).toBeNull();
        expect(diceColorContext('/campaigns/camp-1')).toBeNull();
    });
});

describe('breakdownText', () => {
    test('joins the individual dice with the modifier after', () => {
        expect(breakdownText([{ value: 4 }, { value: 6 }], 3)).toBe('4 + 6 +3');
    });

    test('omits the modifier entirely when it is zero', () => {
        expect(breakdownText([{ value: 4 }, { value: 6 }], 0)).toBe('4 + 6');
    });

    test('is empty when nothing has been rolled yet, even with a modifier set', () => {
        expect(breakdownText([], 3)).toBe('');
    });
});

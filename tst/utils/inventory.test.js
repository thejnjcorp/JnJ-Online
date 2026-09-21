import {
    BACKPACK_SLOTS, MAX_QUANTITY, POCKET_SLOT, RELIC_SLOTS,
    addToEntries, countHeld, countOf, firstFreeSlot, giveToCharacter, holdingsOf, isItemEntry, quantityOf,
    removeEntry, removeFromEntries, setEntryQuantity, takeFromCharacter,
} from '../../src/utils/inventory';

const torch = { id: 'torch', item_name: 'Torch' };
const rope = { id: 'rope', item_name: 'Rope' };
const entry = (item_id, quantity, status, extra = {}) => ({ id: `e-${item_id}-${status}`, item_id, title: item_id, quantity, status, index: 0, ...extra });

describe('entries', () => {
    test('one that refers to an item is an item entry; a hand-typed one from before items is not', () => {
        expect(isItemEntry({ item_id: 'torch' })).toBe(true);
        expect(isItemEntry({ id: 'x', title: 'Old sword', content: '...' })).toBe(false);
        expect(isItemEntry({ item_id: '' })).toBe(false);
        expect(isItemEntry(undefined)).toBe(false);
    });

    test('an item entry has the quantity it says; a hand-typed one, or a broken one, counts as one', () => {
        expect(quantityOf({ item_id: 'torch', quantity: 5 })).toBe(5);
        expect(quantityOf({ title: 'Old sword' })).toBe(1);
        expect(quantityOf({ item_id: 'torch', quantity: 0 })).toBe(1);
        expect(quantityOf({ item_id: 'torch', quantity: 2.5 })).toBe(1);
        expect(quantityOf({ item_id: 'torch' })).toBe(1);
        expect(quantityOf({ item_id: 'torch', quantity: MAX_QUANTITY + 50 })).toBe(MAX_QUANTITY);
    });

    test('countOf adds up every entry holding an item', () => {
        expect(countOf([entry('torch', 2, '1'), entry('rope', 1, '2'), entry('torch', 3, '3')], 'torch')).toBe(5);
        expect(countOf([], 'torch')).toBe(0);
        expect(countOf(undefined, 'torch')).toBe(0);
    });

    test('the slot lists match the character sheet', () => {
        expect(RELIC_SLOTS).toEqual(['Relic 1', 'Relic 2', 'Relic 3', 'Relic 4']);
        expect(BACKPACK_SLOTS).toHaveLength(8);
        expect(POCKET_SLOT).toBe('Pocket');
    });

    test('firstFreeSlot is the first slot nothing is in', () => {
        expect(firstFreeSlot([entry('torch', 1, '1'), entry('rope', 1, '3')], BACKPACK_SLOTS)).toBe('2');
        expect(firstFreeSlot([], BACKPACK_SLOTS)).toBe('1');
        expect(firstFreeSlot(BACKPACK_SLOTS.map(slot => entry('x', 1, slot)), BACKPACK_SLOTS)).toBeNull();
    });
});

describe('addToEntries', () => {
    test('puts a new item in the first free slot, with its name and quantity', () => {
        const { entries } = addToEntries([entry('rope', 1, '1')], torch, 3, { slots: BACKPACK_SLOTS });
        expect(entries).toHaveLength(2);
        expect(entries[1]).toMatchObject({ item_id: 'torch', title: 'Torch', quantity: 3, status: '2', index: 0 });
        expect(entries[1].id).toEqual(expect.any(String));
    });

    test('adds to the stack it already has, wherever that is, rather than taking another slot', () => {
        const { entries } = addToEntries([entry('torch', 2, '5')], torch, 3, { slots: BACKPACK_SLOTS });
        expect(entries).toHaveLength(1);
        expect(entries[0]).toMatchObject({ quantity: 5, status: '5' });
    });

    test('is full when there is no free slot for a new item - but a stack can still grow', () => {
        const full = BACKPACK_SLOTS.map(slot => entry(`item-${slot}`, 1, slot));
        expect(addToEntries(full, torch, 1, { slots: BACKPACK_SLOTS }).reason).toBe('full');
        const withTorch = [...full.slice(1), entry('torch', 1, '1')];
        expect(addToEntries(withTorch, torch, 1, { slots: BACKPACK_SLOTS }).reason).toBeUndefined();
    });

    test('a list with no slots - the party\'s - takes a new entry at the end, with what the caller adds', () => {
        const { entries } = addToEntries([], torch, 2, { extra: { added_by: 'user-1' } });
        expect(entries[0]).toMatchObject({ item_id: 'torch', quantity: 2, added_by: 'user-1' });
        expect(entries[0]).not.toHaveProperty('status');
    });

    test('will not go over a stack\'s limit', () => {
        expect(addToEntries([entry('torch', MAX_QUANTITY, '1')], torch, 1, { slots: BACKPACK_SLOTS }).reason).toBe('too-many');
        expect(addToEntries([], torch, MAX_QUANTITY + 1, { slots: BACKPACK_SLOTS }).reason).toBe('too-many');
    });

    test('refuses nonsense: no item, no quantity, a fraction, zero, less', () => {
        [undefined, {}].forEach(item => expect(addToEntries([], item, 1).reason).toBe('invalid'));
        [0, -1, 1.5, '2', undefined].forEach(quantity => expect(addToEntries([], torch, quantity).reason).toBe('invalid'));
    });

    test('changes nothing it was given, and hands the same list back when it cannot', () => {
        const list = [entry('torch', 1, '1')];
        addToEntries(list, torch, 2);
        expect(list[0].quantity).toBe(1);
        expect(addToEntries(list, rope, 0).entries).toBe(list);
    });

    test('copes with an inventory that is not a list', () => {
        expect(addToEntries(undefined, torch, 1, { slots: BACKPACK_SLOTS }).entries).toHaveLength(1);
    });
});

describe('removeFromEntries', () => {
    test('takes some from a stack, leaving the rest', () => {
        const result = removeFromEntries([entry('torch', 5, '1')], 'torch', 2);
        expect(result.ok).toBe(true);
        expect(result.entries[0].quantity).toBe(3);
    });

    test('takes the whole stack away when that is all there is', () => {
        expect(removeFromEntries([entry('torch', 2, '1'), entry('rope', 1, '2')], 'torch', 2).entries.map(e => e.item_id)).toEqual(['rope']);
    });

    test('takes from the first entries first when the item is in several', () => {
        const { entries } = removeFromEntries([entry('torch', 2, '1'), entry('torch', 3, '2')], 'torch', 3);
        expect(entries).toHaveLength(1);
        expect(entries[0]).toMatchObject({ status: '2', quantity: 2 });
    });

    test('refuses, changing nothing, when there are not that many', () => {
        const list = [entry('torch', 2, '1')];
        const result = removeFromEntries(list, 'torch', 3);
        expect(result).toEqual({ entries: list, ok: false });
        expect(removeFromEntries(list, 'rope', 1).ok).toBe(false);
        [0, -1, 1.5].forEach(quantity => expect(removeFromEntries(list, 'torch', quantity).ok).toBe(false));
    });
});

describe('editing one entry', () => {
    const list = [entry('torch', 2, '1'), { id: 'legacy', title: 'Old sword', status: '2', index: 0 }];

    test('setEntryQuantity sets it, and caps it', () => {
        expect(setEntryQuantity(list, 'e-torch-1', 7)[0].quantity).toBe(7);
        expect(setEntryQuantity(list, 'e-torch-1', MAX_QUANTITY + 10)[0].quantity).toBe(MAX_QUANTITY);
    });

    test('zero or less takes the entry out', () => {
        expect(setEntryQuantity(list, 'e-torch-1', 0).map(e => e.id)).toEqual(['legacy']);
        expect(setEntryQuantity(list, 'e-torch-1', -3).map(e => e.id)).toEqual(['legacy']);
    });

    test('a hand-typed entry has no quantity to set, and something that is not a whole number changes nothing', () => {
        expect(setEntryQuantity(list, 'legacy', 5)[1]).toBe(list[1]);
        expect(setEntryQuantity(list, 'e-torch-1', 2.5)).toBe(list);
        expect(setEntryQuantity(list, 'e-torch-1', NaN)).toBe(list);
    });

    test('removeEntry takes just that one', () => {
        expect(removeEntry(list, 'legacy').map(e => e.id)).toEqual(['e-torch-1']);
    });
});

describe('a character\'s two lists', () => {
    const character = {
        inventory: [entry('torch', 2, '1'), entry('rope', 1, 'Relic 1')],
        inventory_pocket: [entry('torch', 1, POCKET_SLOT)],
    };

    test('holdingsOf adds up each item across both lists', () => {
        expect(holdingsOf(character)).toEqual([
            { item_id: 'torch', title: 'torch', quantity: 3 },
            { item_id: 'rope', title: 'rope', quantity: 1 },
        ]);
    });

    test('holdings ignore hand-typed entries, and cope with a character with no inventory', () => {
        expect(holdingsOf({ inventory: [{ id: 'x', title: 'Old' }] })).toEqual([]);
        expect(holdingsOf({})).toEqual([]);
        expect(holdingsOf(undefined)).toEqual([]);
        expect(countHeld(character, 'torch')).toBe(3);
        expect(countHeld(character, 'nothing')).toBe(0);
    });

    describe('takeFromCharacter', () => {
        test('takes from the backpack and relics first, then the pocket', () => {
            const { lists } = takeFromCharacter(character, 'torch', 3);
            expect(lists.inventory.map(e => e.item_id)).toEqual(['rope']);
            expect(lists.inventory_pocket).toEqual([]);
        });

        test('takes only from the backpack when that has enough', () => {
            const { lists } = takeFromCharacter(character, 'torch', 1);
            expect(lists.inventory[0].quantity).toBe(1);
            expect(lists.inventory_pocket).toHaveLength(1);
        });

        test('says so, changing nothing, when they do not have that many', () => {
            expect(takeFromCharacter(character, 'torch', 4)).toEqual({ reason: 'missing' });
            expect(takeFromCharacter(character, 'nothing', 1)).toEqual({ reason: 'missing' });
            expect(takeFromCharacter(character, 'torch', 0)).toEqual({ reason: 'missing' });
        });
    });

    describe('giveToCharacter', () => {
        test('adds to a stack they already have', () => {
            const { lists } = giveToCharacter(character, torch, 2);
            expect(lists.inventory[0].quantity).toBe(4);
            expect(lists.inventory_pocket).toHaveLength(1);
        });

        test('finds a stack in the pocket too', () => {
            const { lists } = giveToCharacter({ inventory: [], inventory_pocket: [entry('torch', 1, POCKET_SLOT)] }, torch, 1);
            expect(lists.inventory_pocket[0].quantity).toBe(2);
            expect(lists.inventory).toEqual([]);
        });

        test('puts something new in a free backpack slot', () => {
            const { lists } = giveToCharacter({ inventory: [], inventory_pocket: [] }, rope, 1);
            expect(lists.inventory[0]).toMatchObject({ item_id: 'rope', status: '1' });
        });

        test('and in the pocket when the backpack is full', () => {
            const full = { inventory: BACKPACK_SLOTS.map(slot => entry(`i${slot}`, 1, slot)), inventory_pocket: [] };
            const { lists } = giveToCharacter(full, rope, 1);
            expect(lists.inventory).toHaveLength(8);
            expect(lists.inventory_pocket[0]).toMatchObject({ item_id: 'rope', status: POCKET_SLOT });
        });

        test('and says there is no room when the pocket is full too', () => {
            const full = { inventory: BACKPACK_SLOTS.map(slot => entry(`i${slot}`, 1, slot)), inventory_pocket: [entry('pocketed', 1, POCKET_SLOT)] };
            expect(giveToCharacter(full, rope, 1)).toEqual({ reason: 'full' });
        });

        test('will not push a stack past its limit', () => {
            expect(giveToCharacter({ inventory: [entry('torch', MAX_QUANTITY, '1')] }, torch, 1)).toEqual({ reason: 'too-many' });
        });

        test('works for a character with no inventory yet', () => {
            expect(giveToCharacter({}, torch, 1).lists.inventory).toHaveLength(1);
        });

        test('does not change what it was given', () => {
            const before = JSON.stringify(character);
            giveToCharacter(character, torch, 1);
            takeFromCharacter(character, 'torch', 1);
            expect(JSON.stringify(character)).toBe(before);
        });
    });
});

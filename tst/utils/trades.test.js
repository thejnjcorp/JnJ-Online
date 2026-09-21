import {
    MAX_TRADE_ITEMS, confirmSide, isAgreed, isEmptyTrade, newTrade, otherSide, problemText, setOffer, settleTrade, shortfalls, sideOf, tidyItems,
} from '../../src/utils/trades';
import { BACKPACK_SLOTS, MAX_QUANTITY, POCKET_SLOT, countHeld } from '../../src/utils/inventory';

const aria = { character_id: 'aria', character_name: 'Aria', playerId: 'alice' };
const bram = { character_id: 'bram', character_name: 'Bram', playerId: 'bob' };
const entry = (item_id, quantity, status) => ({ id: `e-${item_id}-${status}`, item_id, title: item_id, quantity, status, index: 0 });
const line = (item_id, quantity) => ({ item_id, title: item_id, quantity });

describe('starting a trade', () => {
    test('is an open trade between two characters, each side empty and unconfirmed', () => {
        const trade = newTrade(aria, bram, 1000);
        expect(trade).toMatchObject({ status: 'open', created_at: 1000 });
        expect(trade.id).toEqual(expect.any(String));
        expect(trade.a).toEqual({ character_id: 'aria', character_name: 'Aria', uid: 'alice', items: [], confirmed: false });
        expect(trade.b).toMatchObject({ character_id: 'bram', uid: 'bob' });
    });

    test('each trade has an id of its own', () => {
        expect(newTrade(aria, bram).id).not.toBe(newTrade(aria, bram).id);
    });

    test('says which half a character is, or that they are not in it', () => {
        const trade = newTrade(aria, bram);
        expect(sideOf(trade, 'aria')).toBe('a');
        expect(sideOf(trade, 'bram')).toBe('b');
        expect(sideOf(trade, 'cleo')).toBeNull();
        expect(sideOf(undefined, 'aria')).toBeNull();
        expect(otherSide('a')).toBe('b');
        expect(otherSide('b')).toBe('a');
    });
});

describe('tidyItems', () => {
    test('adds up the same item offered twice', () => {
        expect(tidyItems([line('torch', 2), line('torch', 3)])).toEqual([line('torch', 5)]);
    });

    test('drops lines with no item, or no sensible quantity', () => {
        expect(tidyItems([line('', 1), line('torch', 0), line('torch', -2), line('torch', 1.5), null, { item_id: 'x', quantity: '2' }, line('rope', 1)])).toEqual([line('rope', 1)]);
    });

    test('caps a line at a stack, and the number of lines', () => {
        expect(tidyItems([line('torch', MAX_QUANTITY), line('torch', 5)])[0].quantity).toBe(MAX_QUANTITY);
        const many = Array.from({ length: MAX_TRADE_ITEMS + 4 }, (_, i) => line(`item-${i}`, 1));
        expect(tidyItems(many)).toHaveLength(MAX_TRADE_ITEMS);
    });

    test('is empty for anything that is not a list', () => {
        expect(tidyItems(undefined)).toEqual([]);
    });
});

describe('agreeing to a trade', () => {
    const open = () => newTrade(aria, bram);

    test('a side\'s offer is set for that side alone', () => {
        const trade = setOffer(open(), 'aria', [line('torch', 2)]);
        expect(trade.a.items).toEqual([line('torch', 2)]);
        expect(trade.b.items).toEqual([]);
    });

    test('a character who is not in the trade changes nothing', () => {
        const trade = open();
        expect(setOffer(trade, 'cleo', [line('torch', 1)])).toBe(trade);
        expect(confirmSide(trade, 'cleo')).toBe(trade);
    });

    test('each side confirms for itself, and it is agreed only when both have', () => {
        let trade = setOffer(open(), 'aria', [line('torch', 1)]);
        expect(isAgreed(trade)).toBe(false);
        trade = confirmSide(trade, 'aria');
        expect(trade.a.confirmed).toBe(true);
        expect(isAgreed(trade)).toBe(false);
        trade = confirmSide(trade, 'bram');
        expect(isAgreed(trade)).toBe(true);
    });

    test('a side can take its confirmation back', () => {
        const trade = confirmSide(confirmSide(open(), 'aria'), 'aria', false);
        expect(trade.a.confirmed).toBe(false);
    });

    test('changing either offer takes back both confirmations, so nobody agrees to something that changed', () => {
        let trade = confirmSide(confirmSide(setOffer(open(), 'aria', [line('torch', 1)]), 'aria'), 'bram');
        expect(isAgreed(trade)).toBe(true);
        trade = setOffer(trade, 'bram', [line('rope', 1)]);
        expect(trade.a.confirmed).toBe(false);
        expect(trade.b.confirmed).toBe(false);
    });

    test('an empty trade is one with nothing on either side', () => {
        expect(isEmptyTrade(open())).toBe(true);
        expect(isEmptyTrade(setOffer(open(), 'bram', [line('rope', 1)]))).toBe(false);
    });

    test('does not change what it was given', () => {
        const trade = open();
        setOffer(trade, 'aria', [line('torch', 1)]);
        confirmSide(trade, 'aria');
        expect(trade.a.items).toEqual([]);
        expect(trade.a.confirmed).toBe(false);
    });
});

describe('shortfalls', () => {
    const character = { inventory: [entry('torch', 2, '1')], inventory_pocket: [entry('rope', 1, POCKET_SLOT)] };

    test('is nothing when they have all of it', () => {
        expect(shortfalls([line('torch', 2), line('rope', 1)], character)).toEqual([]);
    });

    test('lists what they do not have enough of, with how many they do have', () => {
        expect(shortfalls([line('torch', 3), line('lamp', 1), line('rope', 1)], character)).toEqual([
            { item_id: 'torch', title: 'torch', wanted: 3, has: 2 },
            { item_id: 'lamp', title: 'lamp', wanted: 1, has: 0 },
        ]);
    });
});

describe('settleTrade', () => {
    const ariaChar = () => ({ ...aria, inventory: [entry('torch', 3, '1'), entry('sword', 1, 'Relic 1')], inventory_pocket: [] });
    const bramChar = () => ({ ...bram, inventory: [entry('rope', 2, '1')], inventory_pocket: [] });
    const agreed = (aItems, bItems) => ({ ...newTrade(aria, bram), a: { ...newTrade(aria, bram).a, items: aItems }, b: { ...newTrade(aria, bram).b, items: bItems } });

    test('moves each side\'s items to the other\'s character', () => {
        const result = settleTrade(agreed([line('torch', 2)], [line('rope', 1)]), { a: ariaChar(), b: bramChar() });
        expect(result.ok).toBe(true);
        expect(countHeld(result.a, 'torch')).toBe(1);
        expect(countHeld(result.a, 'rope')).toBe(1);
        expect(countHeld(result.b, 'torch')).toBe(2);
        expect(countHeld(result.b, 'rope')).toBe(1);
    });

    test('stacks with what the other already has', () => {
        const result = settleTrade(agreed([line('torch', 3)], []), { a: ariaChar(), b: { ...bramChar(), inventory: [entry('torch', 1, '1')] } });
        expect(countHeld(result.b, 'torch')).toBe(4);
        expect(result.b.inventory).toHaveLength(1);
    });

    test('a gift - one side offering and the other nothing - is a trade too', () => {
        const result = settleTrade(agreed([line('sword', 1)], []), { a: ariaChar(), b: bramChar() });
        expect(result.ok).toBe(true);
        expect(countHeld(result.a, 'sword')).toBe(0);
        expect(countHeld(result.b, 'sword')).toBe(1);
    });

    test('everything leaves before anything arrives, so a full backpack can swap one item for another', () => {
        const fullBackpack = slotItem => ({ ...bram, inventory: BACKPACK_SLOTS.map(slot => entry(slot === '1' ? slotItem : `filler-${slot}`, 1, slot)), inventory_pocket: [entry('pocketed', 1, POCKET_SLOT)] });
        const result = settleTrade(agreed([line('torch', 1)], [line('gem', 1)]), { a: { ...aria, inventory: [entry('torch', 1, '1')], inventory_pocket: [] }, b: fullBackpack('gem') });
        expect(result.ok).toBe(true);
        expect(countHeld(result.b, 'torch')).toBe(1);
        expect(countHeld(result.b, 'gem')).toBe(0);
    });

    test('fails, and says who no longer has what, when a character has since lost some of it', () => {
        const result = settleTrade(agreed([line('torch', 5)], []), { a: ariaChar(), b: bramChar() });
        expect(result.ok).toBe(false);
        expect(result.problems).toEqual([{ character_id: 'aria', kind: 'missing', item_id: 'torch', title: 'torch' }]);
    });

    test('fails when the one receiving has no room', () => {
        const full = { ...bram, inventory: BACKPACK_SLOTS.map(slot => entry(`f${slot}`, 1, slot)), inventory_pocket: [entry('p', 1, POCKET_SLOT)] };
        const result = settleTrade(agreed([line('torch', 1)], []), { a: ariaChar(), b: full });
        expect(result.ok).toBe(false);
        expect(result.problems).toEqual([{ character_id: 'bram', kind: 'full', item_id: 'torch', title: 'torch' }]);
    });

    test('fails when a stack would go over its limit', () => {
        const result = settleTrade(agreed([line('torch', 1)], []), { a: ariaChar(), b: { ...bram, inventory: [entry('torch', MAX_QUANTITY, '1')] } });
        expect(result.problems[0]).toMatchObject({ character_id: 'bram', kind: 'too-many' });
    });

    test('changes nothing on either character when it fails, or when it works', () => {
        const a = ariaChar();
        const b = bramChar();
        const before = JSON.stringify([a, b]);
        settleTrade(agreed([line('torch', 5)], []), { a, b });
        settleTrade(agreed([line('torch', 1)], [line('rope', 1)]), { a, b });
        expect(JSON.stringify([a, b])).toBe(before);
    });

    test('characters with no inventory yet are fine to give to', () => {
        const result = settleTrade(agreed([line('torch', 1)], []), { a: ariaChar(), b: { ...bram } });
        expect(result.ok).toBe(true);
        expect(countHeld(result.b, 'torch')).toBe(1);
    });
});

describe('problemText', () => {
    const trade = newTrade(aria, bram);

    test('says who is short of what', () => {
        expect(problemText({ character_id: 'aria', kind: 'missing', title: 'Torch' }, trade)).toBe('Aria no longer has enough Torch.');
    });

    test('says who has no room', () => {
        expect(problemText({ character_id: 'bram', kind: 'full', title: 'Torch' }, trade)).toBe('Bram has no room to carry Torch.');
    });

    test('says who would be carrying too many', () => {
        expect(problemText({ character_id: 'bram', kind: 'too-many', title: 'Torch' }, trade)).toBe('Bram would be carrying too many Torch.');
    });

    test('copes with a missing name or title', () => {
        expect(problemText({ character_id: 'zzz', kind: 'missing' }, trade)).toBe('A character no longer has enough of an item.');
    });
});

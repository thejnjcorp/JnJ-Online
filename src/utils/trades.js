// Trades between two characters in a campaign.
//
// A trade is a shared window, kept on the party doc (`trades`) so both players - and
// the rest of the party - see it. Each side puts items in its own half and confirms;
// changing either half takes back both confirmations, so nobody agrees to something
// that changed under them. When both have confirmed the trade is settled in one step
// (see partyTrades.js): each side's items leave its character and arrive in the
// other's.
//
//   { id, status: 'open', created_at, a: side, b: side }
//   side: { character_id, character_name, uid, items: [{ item_id, title, quantity }],
//           confirmed }

import { MAX_QUANTITY, countHeld, giveToCharacter, takeFromCharacter } from './inventory';

export const MAX_TRADE_ITEMS = 12;

export const SIDES = ['a', 'b'];

const newSide = character => ({
    character_id: character.character_id,
    character_name: character.character_name || '',
    uid: character.playerId || character.userId || '',
    items: [],
    confirmed: false,
});

export const newTrade = (a, b, now = Date.now()) => ({ id: crypto.randomUUID(), status: 'open', created_at: now, a: newSide(a), b: newSide(b) });

// Which half of a trade a character is: 'a', 'b', or null if they aren't in it.
export const sideOf = (trade, characterId) => SIDES.find(side => trade?.[side]?.character_id === characterId) ?? null;

export const otherSide = side => (side === 'a' ? 'b' : 'a');

// An offer as it is kept: one line per item (the same item twice is added up), none
// of zero or fewer, none over a stack's worth, and no more lines than a trade holds.
export function tidyItems(items) {
    const byItem = new Map();
    (Array.isArray(items) ? items : []).forEach(line => {
        if (!line || typeof line.item_id !== 'string' || line.item_id === '' || !Number.isInteger(line.quantity) || line.quantity < 1) return;
        const so_far = byItem.get(line.item_id);
        byItem.set(line.item_id, { item_id: line.item_id, title: so_far?.title || line.title || '', quantity: Math.min((so_far?.quantity || 0) + line.quantity, MAX_QUANTITY) });
    });
    return [...byItem.values()].slice(0, MAX_TRADE_ITEMS);
}

// The trade with one character's half changed to `items`. Both sides' confirmations
// are taken back.
export function setOffer(trade, characterId, items) {
    const side = sideOf(trade, characterId);
    if (!side) return trade;
    return {
        ...trade,
        a: { ...trade.a, confirmed: false },
        b: { ...trade.b, confirmed: false },
        [side]: { ...trade[side], items: tidyItems(items), confirmed: false },
    };
}

export function confirmSide(trade, characterId, confirmed = true) {
    const side = sideOf(trade, characterId);
    if (!side) return trade;
    return { ...trade, [side]: { ...trade[side], confirmed } };
}

export const isAgreed = trade => Boolean(trade?.a?.confirmed && trade?.b?.confirmed);

export const isEmptyTrade = trade => (trade?.a?.items?.length ?? 0) === 0 && (trade?.b?.items?.length ?? 0) === 0;

// What stops an offer being made good from `character`'s inventory: [{ item_id,
// title, wanted, has }] for each item they don't have enough of.
export function shortfalls(items, character) {
    return tidyItems(items)
        .map(line => ({ item_id: line.item_id, title: line.title, wanted: line.quantity, has: countHeld(character, line.item_id) }))
        .filter(line => line.has < line.wanted);
}

// Settle a trade: A's items go to B's character and B's to A's. `characters` is
// { a, b } - the two character docs as they are now. Everything leaves before
// anything arrives, so a slot freed by what goes out can take what comes in.
//   { ok: true, a: { inventory, inventory_pocket }, b: { ... } }
//   { ok: false, problems: [{ character_id, kind: 'missing' | 'full' | 'too-many', item_id, title }] }
export function settleTrade(trade, characters) {
    const problems = [];
    const problem = (side, kind, line) => problems.push({ character_id: trade[side].character_id, kind, item_id: line.item_id, title: line.title });
    const owned = { a: characters.a, b: characters.b };
    const after = { a: { ...characters.a }, b: { ...characters.b } };

    SIDES.forEach(side => {
        trade[side].items.forEach(line => {
            const taken = takeFromCharacter(after[side], line.item_id, line.quantity);
            if (taken.reason) { problem(side, 'missing', line); return; }
            after[side] = { ...after[side], ...taken.lists };
        });
    });
    if (problems.length > 0) return { ok: false, problems };

    SIDES.forEach(side => {
        const receiver = otherSide(side);
        trade[side].items.forEach(line => {
            const given = giveToCharacter(after[receiver], { id: line.item_id, item_name: line.title }, line.quantity);
            if (given.reason) { problem(receiver, given.reason, line); return; }
            after[receiver] = { ...after[receiver], ...given.lists };
        });
    });
    if (problems.length > 0) return { ok: false, problems };

    return {
        ok: true,
        a: { inventory: after.a.inventory ?? owned.a.inventory ?? [], inventory_pocket: after.a.inventory_pocket ?? owned.a.inventory_pocket ?? [] },
        b: { inventory: after.b.inventory ?? owned.b.inventory ?? [], inventory_pocket: after.b.inventory_pocket ?? owned.b.inventory_pocket ?? [] },
    };
}

// A plain sentence for why a trade can't be settled.
export function problemText(problem, trade) {
    const who = SIDES.map(side => trade[side]).find(half => half.character_id === problem.character_id)?.character_name;
    if (problem.kind === 'missing') return `${who || 'A character'} no longer has enough ${problem.title || 'of an item'}.`;
    if (problem.kind === 'full') return `${who || 'A character'} has no room to carry ${problem.title || 'what they are getting'}.`;
    return `${who || 'A character'} would be carrying too many ${problem.title || 'of an item'}.`;
}

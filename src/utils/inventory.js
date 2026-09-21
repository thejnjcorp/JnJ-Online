// What a character (or the party) is carrying.
//
// An inventory is a list of entries, and an entry refers to an item in the item
// database (items.js) rather than being the item: { id, item_id, title, quantity,
// status, index }. `id` is the entry's own, `item_id` the item's document id, `title`
// a copy of the item's name so a list can still say something when the item itself
// can't be read, and `quantity` how many - five torches are one entry with a
// quantity of 5. `status` and `index` are the slot the entry sits in and its place
// there, which is how the character sheet's slot grid (and its drag and drop) place
// it.
//
// A character has two lists: `inventory` (four relic slots and eight backpack slots)
// and `inventory_pocket` (one pocket slot). The party's inventory (on the party doc)
// is one flat list with no slots, and each entry also says who put it there.
//
// Entries from before items existed have no `item_id` - just a title and a
// description typed in by hand. They still list and drag, and count as one of
// themselves, until the migration turns them into items.

export const RELIC_SLOTS = ['Relic 1', 'Relic 2', 'Relic 3', 'Relic 4'];
export const BACKPACK_SLOTS = ['1', '2', '3', '4', '5', '6', '7', '8'];
export const POCKET_SLOT = 'Pocket';

export const MAX_QUANTITY = 999;
export const MAX_PARTY_ENTRIES = 200;

export const isItemEntry = entry => typeof entry?.item_id === 'string' && entry.item_id !== '';

export const quantityOf = entry => (isItemEntry(entry) && Number.isInteger(entry.quantity) && entry.quantity > 0 ? Math.min(entry.quantity, MAX_QUANTITY) : 1);

const newId = () => crypto.randomUUID();

export function countOf(entries, itemId) {
    return (Array.isArray(entries) ? entries : []).filter(entry => entry.item_id === itemId).reduce((total, entry) => total + quantityOf(entry), 0);
}

export const firstFreeSlot = (entries, slots) => slots.find(slot => !entries.some(entry => entry.status === slot)) ?? null;

// The entries with `quantity` more of `item` ({ id, item_name }): added to the entry
// already holding that item if there is one, else put in the first free slot of
// `slots` (a list with no slots, like the party's, takes it as a new entry at the
// end). Returns { entries } - or { entries: <as given>, reason } when it can't be
// done: 'full' (no free slot), 'too-many' (more than one entry may hold), 'invalid'.
// `extra` is added to a new entry (the party notes who put it there).
export function addToEntries(entries, item, quantity, { slots = null, extra = {} } = {}) {
    const list = Array.isArray(entries) ? entries : [];
    if (!item?.id || !Number.isInteger(quantity) || quantity < 1) return { entries: list, reason: 'invalid' };

    const held = list.findIndex(entry => entry.item_id === item.id);
    if (held >= 0) {
        const total = quantityOf(list[held]) + quantity;
        if (total > MAX_QUANTITY) return { entries: list, reason: 'too-many' };
        return { entries: list.map((entry, i) => (i === held ? { ...entry, quantity: total } : entry)) };
    }
    if (quantity > MAX_QUANTITY) return { entries: list, reason: 'too-many' };

    const entry = { id: newId(), item_id: item.id, title: item.item_name || '', quantity, ...extra };
    if (slots) {
        const slot = firstFreeSlot(list, slots);
        if (slot === null) return { entries: list, reason: 'full' };
        entry.status = slot;
        entry.index = 0;
    }
    return { entries: [...list, entry] };
}

// The entries with `quantity` of an item taken out - from the first entries that
// hold it, dropping any left empty. { entries, ok: true }, or - if there isn't that
// many - { entries: <as given>, ok: false }.
export function removeFromEntries(entries, itemId, quantity) {
    const list = Array.isArray(entries) ? entries : [];
    if (!Number.isInteger(quantity) || quantity < 1 || countOf(list, itemId) < quantity) return { entries: list, ok: false };
    let left = quantity;
    const next = [];
    list.forEach(entry => {
        if (entry.item_id !== itemId || left === 0) { next.push(entry); return; }
        const have = quantityOf(entry);
        const take = Math.min(have, left);
        left -= take;
        if (have - take > 0) next.push({ ...entry, quantity: have - take });
    });
    return { entries: next, ok: true };
}

// Set one entry's quantity (an entry with no item - a hand-typed one - can't have
// one); zero or less takes it out.
export function setEntryQuantity(entries, entryId, quantity) {
    if (!Number.isInteger(quantity)) return entries;
    if (quantity < 1) return entries.filter(entry => entry.id !== entryId);
    const capped = Math.min(quantity, MAX_QUANTITY);
    return entries.map(entry => (entry.id === entryId && isItemEntry(entry) ? { ...entry, quantity: capped } : entry));
}

export const removeEntry = (entries, entryId) => entries.filter(entry => entry.id !== entryId);

// --- A character's two lists ------------------------------------------------------

const listsOf = character => ({
    inventory: Array.isArray(character?.inventory) ? character.inventory : [],
    inventory_pocket: Array.isArray(character?.inventory_pocket) ? character.inventory_pocket : [],
});

// How many of an item a character has in all, and the items they hold: [{ item_id,
// title, quantity }] in the order first met.
export function holdingsOf(character) {
    const { inventory, inventory_pocket: pocket } = listsOf(character);
    const held = new Map();
    [...inventory, ...pocket].filter(isItemEntry).forEach(entry => {
        const so_far = held.get(entry.item_id);
        held.set(entry.item_id, { item_id: entry.item_id, title: so_far?.title || entry.title || '', quantity: (so_far?.quantity || 0) + quantityOf(entry) });
    });
    return [...held.values()];
}

export const countHeld = (character, itemId) => holdingsOf(character).find(held => held.item_id === itemId)?.quantity ?? 0;

// The character's lists with `quantity` of an item taken out (from the backpack and
// relics first, then the pocket): { lists: { inventory, inventory_pocket } }, or
// { reason: 'missing' } if they don't have that many.
export function takeFromCharacter(character, itemId, quantity) {
    const current = listsOf(character);
    if (!Number.isInteger(quantity) || quantity < 1 || countHeld(character, itemId) < quantity) return { reason: 'missing' };
    const fromMain = Math.min(quantity, countOf(current.inventory, itemId));
    let inventory = current.inventory;
    let pocket = current.inventory_pocket;
    if (fromMain > 0) inventory = removeFromEntries(inventory, itemId, fromMain).entries;
    if (quantity - fromMain > 0) pocket = removeFromEntries(pocket, itemId, quantity - fromMain).entries;
    return { lists: { inventory, inventory_pocket: pocket } };
}

// The character's lists with `quantity` of an item ({ id, item_name }) put in: onto
// a stack of it they already have, else a free backpack slot, else the pocket.
// { lists }, or { reason } - 'full' when there is nowhere for it, 'too-many' when it
// would be more than one entry may hold, 'invalid'.
export function giveToCharacter(character, item, quantity) {
    const current = listsOf(character);
    const stacked = ['inventory', 'inventory_pocket'].find(name => current[name].some(entry => entry.item_id === item?.id));
    if (stacked) {
        const result = addToEntries(current[stacked], item, quantity);
        return result.reason ? { reason: result.reason } : { lists: { ...current, [stacked]: result.entries } };
    }
    const inBackpack = addToEntries(current.inventory, item, quantity, { slots: BACKPACK_SLOTS });
    if (!inBackpack.reason) return { lists: { ...current, inventory: inBackpack.entries } };
    if (inBackpack.reason !== 'full') return { reason: inBackpack.reason };
    const inPocket = addToEntries(current.inventory_pocket, item, quantity, { slots: [POCKET_SLOT] });
    if (!inPocket.reason) return { lists: { ...current, inventory_pocket: inPocket.entries } };
    return { reason: inPocket.reason };
}

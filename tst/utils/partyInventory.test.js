jest.mock('../../src/utils/firebase', () => ({ db: {} }));

const { fakeFirestore } = require('../testUtils/fakeFirestore');
let mockStore;
jest.mock('firebase/firestore', () => ({
    doc: (...args) => mockStore.docRef(...args),
    runTransaction: (...args) => mockStore.runTransaction(...args),
    onSnapshot: jest.fn(),
}));

// eslint-disable-next-line import/first
import {
    addItemToCharacter, addToParty, putInParty, reasonText, removeCharacterEntry, removePartyEntry, setCharacterQuantity, setPartyQuantity, takeFromParty,
} from '../../src/utils/partyInventory';
// eslint-disable-next-line import/first
import { BACKPACK_SLOTS, MAX_PARTY_ENTRIES, POCKET_SLOT, countHeld, countOf } from '../../src/utils/inventory';

const torch = { id: 'torch', item_name: 'Torch' };
const rope = { id: 'rope', item_name: 'Rope' };
const entry = (item_id, quantity, status, extra = {}) => ({ id: `e-${item_id}`, item_id, title: item_id, quantity, status, index: 0, ...extra });
const party = () => mockStore.get('campaigns/camp1/party/main');
const aria = () => mockStore.get('characters/aria');

beforeEach(() => {
    mockStore = fakeFirestore({
        'campaigns/camp1/party/main': { combat_tracker: [{ id: 'keep-me' }], inventory: [] },
        'characters/aria': { character_name: 'Aria', current_health: 9, inventory: [entry('torch', 3, '1')], inventory_pocket: [] },
    });
});

describe('reasonText', () => {
    test('has a sentence for each reason, and one for anything else', () => {
        ['full', 'too-many', 'missing', 'invalid', 'party-full'].forEach(reason => expect(reasonText(reason)).toMatch(/\.$/));
        expect(reasonText('nonsense')).toBe('That could not be done.');
    });
});

describe('the party inventory', () => {
    test('putting an item in adds an entry, says who put it there, and leaves the rest of the party doc alone', async () => {
        await addToParty('camp1', torch, 2, 'user-1');
        expect(party().inventory).toHaveLength(1);
        expect(party().inventory[0]).toMatchObject({ item_id: 'torch', title: 'Torch', quantity: 2, added_by: 'user-1' });
        expect(party().combat_tracker).toEqual([{ id: 'keep-me' }]);
    });

    test('putting in more of the same item adds to its stack', async () => {
        await addToParty('camp1', torch, 2, 'user-1');
        await addToParty('camp1', torch, 3, 'user-2');
        expect(party().inventory).toHaveLength(1);
        expect(party().inventory[0].quantity).toBe(5);
    });

    test('works for a party doc that does not exist yet', async () => {
        mockStore.docs.delete('campaigns/camp1/party/main');
        await addToParty('camp1', rope, 1, 'user-1');
        expect(party().inventory).toHaveLength(1);
    });

    test('says why it cannot: a nonsense quantity, too many, a full party inventory', async () => {
        await expect(addToParty('camp1', torch, 0, 'u')).rejects.toThrow(reasonText('invalid'));
        await addToParty('camp1', torch, 999, 'u');
        await expect(addToParty('camp1', torch, 1, 'u')).rejects.toThrow(reasonText('too-many'));
        mockStore.set('campaigns/camp1/party/main', { inventory: Array.from({ length: MAX_PARTY_ENTRIES }, (_, i) => ({ id: `e${i}`, item_id: `i${i}`, title: 'x', quantity: 1 })) });
        await expect(addToParty('camp1', torch, 1, 'u')).rejects.toThrow(reasonText('party-full'));
    });

    test('changing a quantity, and taking an entry out', async () => {
        await addToParty('camp1', torch, 2, 'u');
        const id = party().inventory[0].id;
        await setPartyQuantity('camp1', id, 6);
        expect(party().inventory[0].quantity).toBe(6);
        await setPartyQuantity('camp1', id, 0);
        expect(party().inventory).toEqual([]);
        await addToParty('camp1', torch, 1, 'u');
        await removePartyEntry('camp1', party().inventory[0].id);
        expect(party().inventory).toEqual([]);
    });
});

describe('a character putting an item in the party inventory', () => {
    const put = (quantity, extra = {}) => putInParty({ campaignId: 'camp1', characterId: 'aria', itemId: 'torch', title: 'Torch', quantity, userId: 'alice', ...extra });

    test('takes it from the character and adds it to the party, together', async () => {
        await put(2);
        expect(countHeld(aria(), 'torch')).toBe(1);
        expect(countOf(party().inventory, 'torch')).toBe(2);
        expect(party().inventory[0].added_by).toBe('alice');
    });

    test('touches only the two inventory lists of the character', async () => {
        await put(1);
        expect(mockStore.writes.find(write => write.path === 'characters/aria').data).toEqual({ inventory: expect.any(Array), inventory_pocket: expect.any(Array) });
        expect(aria().current_health).toBe(9);
    });

    test('can put in all of it', async () => {
        await put(3);
        expect(countHeld(aria(), 'torch')).toBe(0);
    });

    test('changes nothing when the character does not have that many', async () => {
        await expect(put(4)).rejects.toThrow(reasonText('missing'));
        expect(countHeld(aria(), 'torch')).toBe(3);
        expect(party().inventory).toEqual([]);
    });

    test('changes nothing when the party inventory cannot take it', async () => {
        mockStore.set('campaigns/camp1/party/main', { inventory: [{ id: 'p', item_id: 'torch', title: 'Torch', quantity: 999 }] });
        await expect(put(1)).rejects.toThrow(reasonText('too-many'));
        expect(countHeld(aria(), 'torch')).toBe(3);
    });

    test('says so when the character is not there', async () => {
        await expect(put(1, { characterId: 'ghost' })).rejects.toThrow("That character can't be found.");
    });
});

describe('a character taking an item out of the party inventory', () => {
    beforeEach(async () => { await addToParty('camp1', rope, 4, 'bob'); });
    const take = (quantity, extra = {}) => takeFromParty({ campaignId: 'camp1', characterId: 'aria', itemId: 'rope', title: 'Rope', quantity, ...extra });

    test('takes it from the party and gives it to the character, together', async () => {
        await take(3);
        expect(countOf(party().inventory, 'rope')).toBe(1);
        expect(countHeld(aria(), 'rope')).toBe(3);
    });

    test('empties the entry when all of it is taken', async () => {
        await take(4);
        expect(party().inventory).toEqual([]);
    });

    test('changes nothing when the party does not have that many', async () => {
        await expect(take(5)).rejects.toThrow(reasonText('missing'));
        expect(countHeld(aria(), 'rope')).toBe(0);
        expect(countOf(party().inventory, 'rope')).toBe(4);
    });

    test('changes nothing when the character has no room', async () => {
        mockStore.set('characters/aria', { inventory: BACKPACK_SLOTS.map(slot => entry(`f${slot}`, 1, slot)), inventory_pocket: [entry('p', 1, POCKET_SLOT)] });
        await expect(take(1)).rejects.toThrow(reasonText('full'));
        expect(countOf(party().inventory, 'rope')).toBe(4);
    });
});

describe('a character\'s own inventory', () => {
    test('giving an item stacks it, or puts it in a free slot', async () => {
        await addItemToCharacter('aria', torch, 2);
        expect(aria().inventory).toHaveLength(1);
        expect(aria().inventory[0].quantity).toBe(5);
        await addItemToCharacter('aria', rope, 1);
        expect(aria().inventory).toHaveLength(2);
        expect(aria().inventory[1]).toMatchObject({ item_id: 'rope', status: '2' });
    });

    test('says why when it cannot', async () => {
        await expect(addItemToCharacter('aria', torch, 0)).rejects.toThrow(reasonText('invalid'));
        await expect(addItemToCharacter('ghost', torch, 1)).rejects.toThrow("That character can't be found.");
    });

    test('a character with no inventory fields yet can be given an item', async () => {
        mockStore.set('characters/aria', { character_name: 'Aria' });
        await addItemToCharacter('aria', torch, 1);
        expect(aria().inventory).toHaveLength(1);
    });

    test('changing an entry\'s quantity, wherever it is', async () => {
        mockStore.set('characters/aria', { inventory: [entry('torch', 3, '1')], inventory_pocket: [entry('rope', 1, POCKET_SLOT)] });
        await setCharacterQuantity('aria', 'e-torch', 9);
        await setCharacterQuantity('aria', 'e-rope', 4);
        expect(aria().inventory[0].quantity).toBe(9);
        expect(aria().inventory_pocket[0].quantity).toBe(4);
    });

    test('a quantity of zero takes the entry out; so does removing it', async () => {
        mockStore.set('characters/aria', { inventory: [entry('torch', 3, '1'), entry('rope', 1, '2')], inventory_pocket: [] });
        await setCharacterQuantity('aria', 'e-torch', 0);
        expect(aria().inventory.map(e => e.id)).toEqual(['e-rope']);
        await removeCharacterEntry('aria', 'e-rope');
        expect(aria().inventory).toEqual([]);
    });

    test('an entry that is not there changes nothing', async () => {
        await setCharacterQuantity('aria', 'nope', 5);
        await removeCharacterEntry('aria', 'nope');
        expect(aria().inventory).toHaveLength(1);
    });
});

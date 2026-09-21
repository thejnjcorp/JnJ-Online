jest.mock('../../src/utils/firebase', () => ({ db: {} }));

const { fakeFirestore } = require('../testUtils/fakeFirestore');
let mockStore;
jest.mock('firebase/firestore', () => ({
    doc: (...args) => mockStore.docRef(...args),
    runTransaction: (...args) => mockStore.runTransaction(...args),
    onSnapshot: jest.fn(),
}));

// eslint-disable-next-line import/first
import { MAX_OPEN_TRADES, MAX_TRADE_LOG, cancelTrade, offerItems, setConfirmed, startTrade } from '../../src/utils/partyTrades';
// eslint-disable-next-line import/first
import { BACKPACK_SLOTS, POCKET_SLOT, countHeld } from '../../src/utils/inventory';

const entry = (item_id, quantity, status) => ({ id: `e-${item_id}-${status}`, item_id, title: item_id, quantity, status, index: 0 });
const aria = { character_id: 'aria', character_name: 'Aria', playerId: 'alice' };
const bram = { character_id: 'bram', character_name: 'Bram', playerId: 'bob' };
const cleo = { character_id: 'cleo', character_name: 'Cleo', playerId: 'cara' };
const party = () => mockStore.get('campaigns/camp1/party/main');
const character = id => mockStore.get(`characters/${id}`);
const line = (item_id, quantity) => ({ item_id, title: item_id, quantity });

beforeEach(() => {
    mockStore = fakeFirestore({
        'campaigns/camp1/party/main': { combat_tracker: [{ id: 'keep-me' }] },
        'characters/aria': { character_name: 'Aria', current_health: 9, inventory: [entry('torch', 3, '1')], inventory_pocket: [] },
        'characters/bram': { character_name: 'Bram', inventory: [entry('rope', 2, '1')], inventory_pocket: [] },
        'characters/cleo': { character_name: 'Cleo', inventory: [], inventory_pocket: [] },
    });
});

const open = async () => { await startTrade('camp1', aria, bram); return party().trades[0]; };

describe('starting a trade', () => {
    test('opens a trade on the party doc, between the two, and leaves the rest of it alone', async () => {
        const trade = await open();
        expect(party().trades).toHaveLength(1);
        expect(trade.a.character_id).toBe('aria');
        expect(trade.b.character_id).toBe('bram');
        expect(party().combat_tracker).toEqual([{ id: 'keep-me' }]);
    });

    test('a character can be in only one trade at a time, whichever side they are on', async () => {
        await open();
        await expect(startTrade('camp1', aria, cleo)).rejects.toThrow('Aria is already in a trade.');
        await expect(startTrade('camp1', cleo, bram)).rejects.toThrow('Bram is already in a trade.');
        expect(party().trades).toHaveLength(1);
    });

    test('but two other characters can start their own', async () => {
        await open();
        mockStore.set('characters/dee', { inventory: [] });
        await startTrade('camp1', cleo, { character_id: 'dee', character_name: 'Dee' });
        expect(party().trades).toHaveLength(2);
    });

    test('nobody trades with themselves', async () => {
        await expect(startTrade('camp1', aria, aria)).rejects.toThrow("can't trade with themselves");
    });

    test('there is a limit to open trades', async () => {
        mockStore.set('campaigns/camp1/party/main', { trades: Array.from({ length: MAX_OPEN_TRADES }, (_, i) => ({ id: `t${i}`, a: { character_id: `a${i}` }, b: { character_id: `b${i}` } })) });
        await expect(startTrade('camp1', aria, bram)).rejects.toThrow(/too many open trades/);
    });
});

describe('offering', () => {
    test('a side sets what it puts in, and it is kept tidy', async () => {
        const trade = await open();
        await offerItems('camp1', trade.id, 'aria', [line('torch', 1), line('torch', 1), line('rope', 0)]);
        expect(party().trades[0].a.items).toEqual([line('torch', 2)]);
        expect(party().trades[0].b.items).toEqual([]);
    });

    test('changing an offer takes back both confirmations', async () => {
        const trade = await open();
        await offerItems('camp1', trade.id, 'aria', [line('torch', 1)]);
        await setConfirmed('camp1', trade.id, 'aria');
        expect(party().trades[0].a.confirmed).toBe(true);
        await offerItems('camp1', trade.id, 'bram', [line('rope', 1)]);
        expect(party().trades[0].a.confirmed).toBe(false);
    });

    test('a character outside the trade cannot change it, and a trade that is gone says so', async () => {
        const trade = await open();
        await expect(offerItems('camp1', trade.id, 'cleo', [line('torch', 1)])).rejects.toThrow("isn't in this trade");
        await expect(offerItems('camp1', 'nope', 'aria', [])).rejects.toThrow("isn't open any more");
    });
});

describe('confirming', () => {
    test('one side confirming waits for the other, and moves nothing', async () => {
        const trade = await open();
        await offerItems('camp1', trade.id, 'aria', [line('torch', 2)]);
        await setConfirmed('camp1', trade.id, 'aria');
        expect(party().trades[0].a.confirmed).toBe(true);
        expect(countHeld(character('aria'), 'torch')).toBe(3);
    });

    test('a side can take its confirmation back', async () => {
        const trade = await open();
        await setConfirmed('camp1', trade.id, 'aria');
        await setConfirmed('camp1', trade.id, 'aria', false);
        expect(party().trades[0].a.confirmed).toBe(false);
    });

    test('when both have confirmed the trade is carried out, in one step', async () => {
        const trade = await open();
        await offerItems('camp1', trade.id, 'aria', [line('torch', 2)]);
        await offerItems('camp1', trade.id, 'bram', [line('rope', 1)]);
        await setConfirmed('camp1', trade.id, 'aria');
        await setConfirmed('camp1', trade.id, 'bram');

        expect(countHeld(character('aria'), 'torch')).toBe(1);
        expect(countHeld(character('aria'), 'rope')).toBe(1);
        expect(countHeld(character('bram'), 'torch')).toBe(2);
        expect(countHeld(character('bram'), 'rope')).toBe(1);
        expect(party().trades).toEqual([]);
    });

    test('touches only the inventories of the two characters', async () => {
        const trade = await open();
        await offerItems('camp1', trade.id, 'aria', [line('torch', 1)]);
        await setConfirmed('camp1', trade.id, 'aria');
        await setConfirmed('camp1', trade.id, 'bram');
        mockStore.writes.filter(write => write.path.startsWith('characters/')).forEach(write => {
            expect(Object.keys(write.data).sort()).toEqual(['inventory', 'inventory_pocket']);
        });
        expect(character('aria').current_health).toBe(9);
    });

    test('is written in the party\'s trade log, for the bookkeeping', async () => {
        const trade = await open();
        await offerItems('camp1', trade.id, 'aria', [line('torch', 2)]);
        await setConfirmed('camp1', trade.id, 'aria');
        await setConfirmed('camp1', trade.id, 'bram');
        expect(party().trade_log).toHaveLength(1);
        expect(party().trade_log[0]).toMatchObject({ a: { character_name: 'Aria', gave: '2 torch' }, b: { character_name: 'Bram', gave: 'nothing' } });
    });

    test('the log keeps only the latest few', async () => {
        mockStore.set('campaigns/camp1/party/main', { trade_log: Array.from({ length: MAX_TRADE_LOG }, (_, i) => ({ id: `old${i}` })) });
        const trade = await open();
        await offerItems('camp1', trade.id, 'aria', [line('torch', 1)]);
        await setConfirmed('camp1', trade.id, 'aria');
        await setConfirmed('camp1', trade.id, 'bram');
        expect(party().trade_log).toHaveLength(MAX_TRADE_LOG);
        expect(party().trade_log.at(-1).a.character_name).toBe('Aria');
        expect(party().trade_log[0].id).toBe('old1');
    });

    test('is refused, with the reason, and changes nothing, when someone no longer has what they offered', async () => {
        const trade = await open();
        await offerItems('camp1', trade.id, 'aria', [line('torch', 3)]);
        await setConfirmed('camp1', trade.id, 'aria');
        mockStore.set('characters/aria', { inventory: [entry('torch', 1, '1')], inventory_pocket: [] }); // spent some meanwhile

        await expect(setConfirmed('camp1', trade.id, 'bram')).rejects.toThrow('Aria no longer has enough torch.');
        expect(party().trades).toHaveLength(1);
        expect(party().trades[0].b.confirmed).toBe(false);
        expect(countHeld(character('bram'), 'torch')).toBe(0);
    });

    test('is refused when the other has no room to carry what they are getting', async () => {
        mockStore.set('characters/bram', { inventory: BACKPACK_SLOTS.map(slot => entry(`f${slot}`, 1, slot)), inventory_pocket: [entry('p', 1, POCKET_SLOT)] });
        const trade = await open();
        await offerItems('camp1', trade.id, 'aria', [line('torch', 1)]);
        await setConfirmed('camp1', trade.id, 'aria');
        await expect(setConfirmed('camp1', trade.id, 'bram')).rejects.toThrow('Bram has no room to carry torch.');
        expect(countHeld(character('aria'), 'torch')).toBe(3);
    });

    test('is refused when a character cannot be found', async () => {
        const trade = await open();
        await offerItems('camp1', trade.id, 'aria', [line('torch', 1)]);
        await setConfirmed('camp1', trade.id, 'aria');
        mockStore.docs.delete('characters/bram');
        await expect(setConfirmed('camp1', trade.id, 'bram')).rejects.toThrow("can't be found");
    });

    test('a character outside the trade cannot confirm it', async () => {
        const trade = await open();
        await expect(setConfirmed('camp1', trade.id, 'cleo')).rejects.toThrow("isn't in this trade");
    });
});

describe('cancelling', () => {
    test('takes the trade away, moving nothing', async () => {
        const trade = await open();
        await offerItems('camp1', trade.id, 'aria', [line('torch', 3)]);
        await cancelTrade('camp1', trade.id);
        expect(party().trades).toEqual([]);
        expect(countHeld(character('aria'), 'torch')).toBe(3);
    });

    test('a trade that is already gone says so', async () => {
        await expect(cancelTrade('camp1', 'nope')).rejects.toThrow("isn't open any more");
    });

    test('after it, both characters are free to trade again', async () => {
        const trade = await open();
        await cancelTrade('camp1', trade.id);
        await expect(startTrade('camp1', aria, cleo)).resolves.toBeUndefined();
    });
});

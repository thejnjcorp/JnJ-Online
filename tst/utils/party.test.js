jest.mock('../../src/utils/firebase', () => ({ db: { name: 'db' } }));

const mockDoc = jest.fn();
const mockRunTransaction = jest.fn();
const mockOnSnapshot = jest.fn();
jest.mock('firebase/firestore', () => ({
    doc: (...args) => mockDoc(...args),
    onSnapshot: (...args) => mockOnSnapshot(...args),
    runTransaction: (...args) => mockRunTransaction(...args),
}));

// eslint-disable-next-line import/first
import { PARTY_DOC_ID, ensureParty, partyDoc, removeFromTracker, subscribeParty, updateCombatTracker, updateParty } from '../../src/utils/party';

// A transaction over one document that holds `stored` (undefined: no document yet).
function transactionOver(stored) {
    const set = jest.fn();
    const get = jest.fn(async () => ({ exists: () => stored !== undefined, data: () => stored }));
    mockRunTransaction.mockImplementation(async (_db, run) => run({ get, set }));
    return { get, set };
}

beforeEach(() => {
    mockDoc.mockImplementation((_db, ...path) => ({ __doc: path.join('/') }));
});

describe('the party doc', () => {
    test('is campaigns/{id}/party/main', () => {
        expect(PARTY_DOC_ID).toBe('main');
        expect(partyDoc('camp-1')).toEqual({ __doc: 'campaigns/camp-1/party/main' });
        expect(mockDoc).toHaveBeenCalledWith({ name: 'db' }, 'campaigns', 'camp-1', 'party', 'main');
    });
});

describe('ensureParty', () => {
    test('creates the party doc, empty, when the campaign has none', async () => {
        const { set } = transactionOver(undefined);
        await ensureParty('camp-1');
        expect(set).toHaveBeenCalledTimes(1);
        expect(set).toHaveBeenCalledWith({ __doc: 'campaigns/camp-1/party/main' }, { combat_tracker: [] });
    });

    test('leaves an existing party doc exactly as it is', async () => {
        const { set } = transactionOver({ combat_tracker: [{ id: 'a' }], inventory: ['rope'] });
        await ensureParty('camp-1');
        expect(set).not.toHaveBeenCalled();
    });

    test('does not use merge, so it can only ever create (never overwrite a doc someone else just made)', async () => {
        const { set } = transactionOver(undefined);
        await ensureParty('camp-1');
        expect(set.mock.calls[0]).toHaveLength(2); // no { merge: true }
    });

    test('a failure is passed on as a rejection, for the caller to decide about', async () => {
        mockRunTransaction.mockRejectedValue(new Error('permission-denied'));
        await expect(ensureParty('camp-1')).rejects.toThrow('permission-denied');
    });
});

describe('updateParty', () => {
    test('runs the change on the party as it is now, inside a transaction, and merges what it returns', async () => {
        const { set } = transactionOver({ combat_tracker: [1], notes: 'keep me' });
        await updateParty('camp-1', party => ({ combat_tracker: [...party.combat_tracker, 2] }));
        expect(set).toHaveBeenCalledWith({ __doc: 'campaigns/camp-1/party/main' }, { combat_tracker: [1, 2] }, { merge: true });
    });

    test('a change that returns null writes nothing', async () => {
        const { set } = transactionOver({ combat_tracker: [] });
        await updateParty('camp-1', () => null);
        expect(set).not.toHaveBeenCalled();
    });

    test('with no party doc yet, the change is given an empty party, and the write creates it', async () => {
        const { set } = transactionOver(undefined);
        const change = jest.fn(() => ({ combat_tracker: [] }));
        await updateParty('camp-1', change);
        expect(change).toHaveBeenCalledWith({});
        expect(set).toHaveBeenCalledTimes(1);
    });

    test('a failed transaction is passed on', async () => {
        mockRunTransaction.mockRejectedValue(new Error('permission-denied'));
        await expect(updateParty('camp-1', () => ({}))).rejects.toThrow('permission-denied');
    });
});

describe('updateCombatTracker', () => {
    test('gives the change the tracker\'s posts, and saves the list it returns', async () => {
        const { set } = transactionOver({ combat_tracker: [{ id: 'a' }] });
        await updateCombatTracker('camp-1', posts => [...posts, { id: 'b' }]);
        expect(set).toHaveBeenCalledWith(expect.anything(), { combat_tracker: [{ id: 'a' }, { id: 'b' }] }, { merge: true });
    });

    test('leaves the rest of the party doc alone (only combat_tracker is set)', async () => {
        const { set } = transactionOver({ combat_tracker: [], inventory: ['x'] });
        await updateCombatTracker('camp-1', () => [{ id: 'a' }]);
        expect(Object.keys(set.mock.calls[0][1])).toEqual(['combat_tracker']);
    });

    test('null - no change - writes nothing', async () => {
        const { set } = transactionOver({ combat_tracker: [] });
        await updateCombatTracker('camp-1', () => null);
        expect(set).not.toHaveBeenCalled();
    });

    test.each([['no tracker yet', {}], ['an old tracker that is not a list', { combat_tracker: { zones: [] } }], ['no party doc', undefined]])('%s is an empty list to the change', async (_name, stored) => {
        transactionOver(stored);
        const change = jest.fn(() => null);
        await updateCombatTracker('camp-1', change);
        expect(change).toHaveBeenCalledWith([]);
    });
});

describe('removeFromTracker', () => {
    const posts = [{ id: 'npc:a' }, { id: 'npc:b' }, { id: 'character:c' }];

    test('takes the enemies (by enemy id) off the tracker, leaving everyone else', () => {
        expect(removeFromTracker(['a'])(posts)).toEqual([{ id: 'npc:b' }, { id: 'character:c' }]);
        expect(removeFromTracker(['a', 'b'])(posts)).toEqual([{ id: 'character:c' }]);
    });

    test('is no change (null) when none of them is there, so nothing is written', () => {
        expect(removeFromTracker(['zzz'])(posts)).toBeNull();
        expect(removeFromTracker([])(posts)).toBeNull();
        expect(removeFromTracker(['a'])([])).toBeNull();
    });

    test('a player character is never taken off by an enemy id', () => {
        expect(removeFromTracker(['c'])(posts)).toBeNull();
    });
});

describe('subscribeParty', () => {
    // Each test uses its own campaign, and the teardown timers are the fake ones.
    let listener;
    const stopFirestore = jest.fn();
    let campaign = 0;
    const nextCampaign = () => `sub-camp-${++campaign}`;

    beforeEach(() => {
        jest.useFakeTimers();
        listener = null;
        stopFirestore.mockClear();
        mockOnSnapshot.mockReset();
        mockOnSnapshot.mockImplementation((ref, next, error) => {
            listener = { ref, next, error };
            return stopFirestore;
        });
    });

    afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
    });

    const snapshot = data => ({ data: () => data });

    test('listens to the campaign\'s party doc, and says nothing until it hears back', () => {
        const id = nextCampaign();
        const heard = jest.fn();
        subscribeParty(id, heard);
        expect(mockOnSnapshot).toHaveBeenCalledTimes(1);
        expect(listener.ref).toEqual({ __doc: `campaigns/${id}/party/main` });
        expect(heard).not.toHaveBeenCalled();
    });

    test('passes on the party, and every change to it', () => {
        const heard = jest.fn();
        subscribeParty(nextCampaign(), heard);

        listener.next(snapshot({ combat_tracker: [{ id: 'a' }] }));
        listener.next(snapshot({ combat_tracker: [{ id: 'a' }, { id: 'b' }] }));

        expect(heard).toHaveBeenNthCalledWith(1, { party: { combat_tracker: [{ id: 'a' }] }, loaded: true, error: null });
        expect(heard).toHaveBeenNthCalledWith(2, { party: { combat_tracker: [{ id: 'a' }, { id: 'b' }] }, loaded: true, error: null });
    });

    test('a campaign with no party doc yet is an empty party, loaded', () => {
        const heard = jest.fn();
        subscribeParty(nextCampaign(), heard);
        listener.next(snapshot(undefined));
        expect(heard).toHaveBeenCalledWith({ party: {}, loaded: true, error: null });
    });

    test('a refused listener is logged once, and passed on as an error with an empty party', () => {
        const log = jest.spyOn(console, 'log').mockImplementation(() => {});
        const first = jest.fn();
        const second = jest.fn();
        const id = nextCampaign();
        subscribeParty(id, first);
        subscribeParty(id, second);

        const error = new Error('permission-denied');
        listener.error(error);

        expect(first).toHaveBeenCalledWith({ party: {}, loaded: true, error });
        expect(second).toHaveBeenCalledWith({ party: {}, loaded: true, error });
        expect(log).toHaveBeenCalledTimes(1);
        expect(log).toHaveBeenCalledWith("Couldn't load the party: Error: permission-denied");
        log.mockRestore();
    });

    describe('sharing one listener', () => {
        test('everything listening to the same campaign shares a single Firestore listener', () => {
            const id = nextCampaign();
            const map = jest.fn();
            const lineView = jest.fn();
            const overlay = jest.fn();
            subscribeParty(id, map);
            subscribeParty(id, lineView);
            subscribeParty(id, overlay);

            expect(mockOnSnapshot).toHaveBeenCalledTimes(1);
            listener.next(snapshot({ combat_tracker: [] }));
            [map, lineView, overlay].forEach(heard => expect(heard).toHaveBeenCalledTimes(1));
        });

        test('someone who starts listening later is told what is already known straight away', () => {
            const id = nextCampaign();
            subscribeParty(id, jest.fn());
            listener.next(snapshot({ combat_tracker: [{ id: 'a' }] }));

            const late = jest.fn();
            subscribeParty(id, late);

            expect(late).toHaveBeenCalledWith({ party: { combat_tracker: [{ id: 'a' }] }, loaded: true, error: null });
            expect(mockOnSnapshot).toHaveBeenCalledTimes(1);
        });

        test('and someone who starts listening after it was refused is told so, not left waiting', () => {
            const log = jest.spyOn(console, 'log').mockImplementation(() => {});
            const id = nextCampaign();
            subscribeParty(id, jest.fn());
            listener.error(new Error('permission-denied'));

            const late = jest.fn();
            subscribeParty(id, late);

            expect(late).toHaveBeenCalledWith(expect.objectContaining({ loaded: true, error: expect.any(Error) }));
            log.mockRestore();
        });

        test('different campaigns have their own listeners', () => {
            subscribeParty(nextCampaign(), jest.fn());
            subscribeParty(nextCampaign(), jest.fn());
            expect(mockOnSnapshot).toHaveBeenCalledTimes(2);
        });

        test('someone who has stopped listening hears no more', () => {
            const id = nextCampaign();
            const staying = jest.fn();
            const leaving = jest.fn();
            subscribeParty(id, staying);
            const stopLeaving = subscribeParty(id, leaving);

            stopLeaving();
            listener.next(snapshot({ combat_tracker: [] }));

            expect(staying).toHaveBeenCalledTimes(1);
            expect(leaving).not.toHaveBeenCalled();
        });
    });

    describe('stopping', () => {
        test('the Firestore listener is only stopped a moment after the last one has gone', () => {
            const stop = subscribeParty(nextCampaign(), jest.fn());
            stop();
            expect(stopFirestore).not.toHaveBeenCalled();

            jest.advanceTimersByTime(2900);
            expect(stopFirestore).not.toHaveBeenCalled();
            jest.advanceTimersByTime(200);
            expect(stopFirestore).toHaveBeenCalledTimes(1);
        });

        test('it is not stopped while anyone is still listening', () => {
            const id = nextCampaign();
            const stopFirst = subscribeParty(id, jest.fn());
            subscribeParty(id, jest.fn());
            stopFirst();
            jest.advanceTimersByTime(10000);
            expect(stopFirestore).not.toHaveBeenCalled();
        });

        test('a component that unmounts and remounts straight away (React does this on purpose in development) reuses the listener instead of stopping and restarting it', () => {
            const id = nextCampaign();
            const heard = jest.fn();
            const stopFirst = subscribeParty(id, heard);   // mount
            stopFirst();                                    // unmount
            subscribeParty(id, heard);                      // mount again
            jest.advanceTimersByTime(10000);

            expect(mockOnSnapshot).toHaveBeenCalledTimes(1);
            expect(stopFirestore).not.toHaveBeenCalled();
        });

        test('after it has really been stopped, listening again starts a fresh one', () => {
            const id = nextCampaign();
            subscribeParty(id, jest.fn())();
            jest.advanceTimersByTime(3500);
            expect(stopFirestore).toHaveBeenCalledTimes(1);

            const fresh = jest.fn();
            subscribeParty(id, fresh);
            expect(mockOnSnapshot).toHaveBeenCalledTimes(2);
            expect(fresh).not.toHaveBeenCalled(); // nothing known yet: a fresh listener
        });

        test('stopping twice is harmless', () => {
            const id = nextCampaign();
            const stop = subscribeParty(id, jest.fn());
            stop();
            stop();
            jest.advanceTimersByTime(4000);
            expect(stopFirestore).toHaveBeenCalledTimes(1);
        });
    });
});

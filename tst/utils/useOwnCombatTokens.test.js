jest.mock('../../src/utils/firebase', () => ({ db: {} }));

let mockTracker = [];
const mockSaveTracker = jest.fn();
const mockSubscribeParty = jest.fn();
jest.mock('../../src/utils/party', () => ({
    subscribeParty: (...args) => mockSubscribeParty(...args),
    updateCombatTracker: async (campaignId, change) => {
        const next = change(mockTracker);
        if (next) await mockSaveTracker(campaignId, next);
    },
}));

// eslint-disable-next-line import/first
import { renderHook } from '@testing-library/react';
// eslint-disable-next-line import/first
import { useOwnCombatTokens } from '../../src/utils/useOwnCombatTokens';
// eslint-disable-next-line import/first
import { zoneRects } from '../../src/utils/mapTokens';
// eslint-disable-next-line import/first
import { zoneAt } from '../../src/utils/mapTokens';

const zone = (name, x) => ({ id: name, name, x, y: 10, width: 100, height: 80 });
const activeMap = { map_id: 'map-1', zones: [zone('Zone 1', 10), zone('Zone 2', 200)] };
const kira = { id: 'character:kira', title: 'Kira', kind: 'player', ownerIds: ['player-1'] };
const sergio = { id: 'character:sergio', title: 'Sergio', kind: 'player', ownerIds: ['player-2'] };
const goblin = { id: 'npc:goblin', title: 'Goblin', kind: 'enemy' };
const stop = jest.fn();

// the party doc as the listener delivers it
function listen(tracker, extra = {}) {
    mockTracker = tracker;
    mockSubscribeParty.mockImplementation((_campaignId, listener) => {
        listener({ party: { combat_tracker: tracker }, loaded: true, error: null, ...extra });
        return stop;
    });
}
const run = (props = {}) => renderHook(p => useOwnCombatTokens(p), { initialProps: { campaignId: 'camp-1', activeMap, entities: [kira, sergio, goblin], userId: 'player-1', ...props } });

beforeEach(() => {
    mockSaveTracker.mockReset();
    mockSaveTracker.mockResolvedValue(undefined);
    mockSubscribeParty.mockReset();
    stop.mockReset();
    listen([]);
});

describe('useOwnCombatTokens', () => {
    test('puts the player\'s own character on the tracker, in the map\'s first zone, on a spot', () => {
        run();
        expect(mockSaveTracker).toHaveBeenCalledTimes(1);
        const [campaignId, saved] = mockSaveTracker.mock.calls[0];
        expect(campaignId).toBe('camp-1');
        expect(saved.map(p => p.id)).toEqual(['character:kira']);
        expect(saved[0]).toMatchObject({ title: 'Kira', status: 'Zone 1' });
        expect(zoneAt(saved[0], zoneRects(activeMap.zones))).toBe('Zone 1');
    });

    test('and only theirs: nobody else\'s character, and no enemies', () => {
        run();
        expect(mockSaveTracker.mock.calls[0][1].map(p => p.id)).toEqual(['character:kira']);
    });

    test('a player with two characters gets both, and one who is co-owner of another\'s gets that too', () => {
        const second = { id: 'character:second', title: 'Second', kind: 'player', ownerIds: ['player-1', 'player-9'] };
        run({ entities: [kira, second, sergio] });
        expect(mockSaveTracker.mock.calls[0][1].map(p => p.id)).toEqual(['character:kira', 'character:second']);
    });

    test('leaves everyone already on the tracker exactly as they are', () => {
        const stored = [{ id: 'npc:staged', title: 'Staged', content: '', status: 'Zone 2', index: 0, x: 0.5, y: 0.1 }];
        listen(stored);
        run();
        const saved = mockSaveTracker.mock.calls[0][1];
        expect(saved[0]).toBe(stored[0]);
        expect(saved).toHaveLength(2);
    });

    test('does nothing when the character is already on the tracker with a spot', () => {
        listen([{ id: 'character:kira', title: 'Kira', content: '', status: 'Zone 1', index: 0, x: 0.1, y: 0.1 }]);
        run();
        expect(mockSaveTracker).not.toHaveBeenCalled();
    });

    test('gives a spot to a character that is on the tracker without one', () => {
        listen([{ id: 'character:kira', title: 'Kira', content: '', status: 'Zone 2', index: 0 }]);
        run();
        expect(Number.isFinite(mockSaveTracker.mock.calls[0][1][0].x)).toBe(true);
    });

    test('does nothing while no map is active: without zones there is nowhere to put them', () => {
        run({ activeMap: undefined });
        expect(mockSubscribeParty).not.toHaveBeenCalled();
        expect(mockSaveTracker).not.toHaveBeenCalled();
    });

    test('does nothing for someone with no character of their own here, or who is not signed in', () => {
        run({ userId: 'stranger' });
        run({ userId: undefined });
        run({ entities: [goblin] });
        expect(mockSaveTracker).not.toHaveBeenCalled();
    });

    test('does nothing for a character that is not a player character, even one they could be listed as owner of', () => {
        run({ entities: [{ ...goblin, ownerIds: ['player-1'] }] });
        expect(mockSaveTracker).not.toHaveBeenCalled();
    });

    test('waits for the party doc to arrive, and gives up quietly if it cannot be read', () => {
        listen([], { loaded: false });
        run();
        listen([], { error: new Error('permission-denied') });
        run();
        expect(mockSaveTracker).not.toHaveBeenCalled();
    });

    test('with no campaign there is nothing to listen to', () => {
        run({ campaignId: '' });
        expect(mockSubscribeParty).not.toHaveBeenCalled();
    });

    test('a failed write is logged, not thrown', async () => {
        const log = jest.spyOn(console, 'log').mockImplementation(() => {});
        mockSaveTracker.mockRejectedValue(new Error('offline'));
        run();
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(log).toHaveBeenCalledWith("Couldn't put your character on the combat tracker: Error: offline");
        log.mockRestore();
    });

    test('stops listening when the page goes', () => {
        const { unmount } = run();
        unmount();
        expect(stop).toHaveBeenCalled();
    });

    test('a write to the map doc that changes no zone does not listen again', () => {
        const entities = [kira, sergio, goblin]; // the page keeps this list until the fight changes
        const { rerender } = run({ entities });
        const calls = mockSubscribeParty.mock.calls.length;
        rerender({ campaignId: 'camp-1', activeMap: { ...activeMap, zones: activeMap.zones.map(z => ({ ...z })), strokes: [{ id: 's' }] }, entities, userId: 'player-1' });
        expect(mockSubscribeParty.mock.calls.length).toBe(calls);
    });
});

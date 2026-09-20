import { NO_MAP_ZONE, addToTracker, combatantMover, syncCombatTracker } from '../../src/utils/combatTracker';
import { slotPosition, zoneAt, zoneRects } from '../../src/utils/mapTokens';

const post = (id, status, index) => ({ id, title: id, content: '', status, index });
const entity = id => ({ id, title: id });

describe('syncCombatTracker', () => {
    const zones = ['Zone 1', 'Zone 2'];

    test('has nothing to do with no zones to place anyone in', () => {
        expect(syncCombatTracker([], [entity('a')], [])).toBeNull();
    });

    test('is already right when everyone in the fight is placed in a zone', () => {
        expect(syncCombatTracker([post('a', 'Zone 1', 0), post('b', 'Zone 2', 0)], [entity('a'), entity('b')], zones)).toBeNull();
    });

    test('puts someone new in the first zone, after those already there', () => {
        const next = syncCombatTracker([post('a', 'Zone 2', 0)], [entity('a'), entity('b')], zones);
        expect(next).toEqual([post('a', 'Zone 2', 0), { id: 'b', title: 'b', content: '', status: 'Zone 1', index: 1 }]);
    });

    test('takes out anyone no longer in the fight, and leaves the rest where they are', () => {
        const next = syncCombatTracker([post('a', 'Zone 2', 0), post('gone', 'Zone 1', 0), post('c', 'Zone 1', 1)], [entity('a'), entity('c')], zones);
        expect(next).toEqual([post('a', 'Zone 2', 0), post('c', 'Zone 1', 1)]);
    });

    test('moves someone whose zone is not among the zones any more to the first zone, after those already there', () => {
        const next = syncCombatTracker([post('a', 'Zone 1', 0), post('lost', 'Old zone', 0), post('lost2', 'Old zone', 1)], [entity('a'), entity('lost'), entity('lost2')], zones);
        expect(next).toEqual([post('a', 'Zone 1', 0), post('lost', 'Zone 1', 1), post('lost2', 'Zone 1', 2)]);
    });

    test('leaves those whose zone is still there alone, when others have to move', () => {
        const next = syncCombatTracker([post('a', 'Zone 2', 5), post('lost', 'Old', 0)], [entity('a'), entity('lost')], zones);
        expect(next[0]).toBe(next.find(p => p.id === 'a'));
        expect(next.find(p => p.id === 'a')).toEqual(post('a', 'Zone 2', 5));
        expect(next.find(p => p.id === 'lost').status).toBe('Zone 1');
    });

    test('does not change the tracker it was given', () => {
        const posts = [post('lost', 'Old', 0)];
        syncCombatTracker(posts, [entity('lost'), entity('new')], zones);
        expect(posts).toEqual([post('lost', 'Old', 0)]);
    });

    test('a combatant with no name is given an empty one, since Firestore refuses undefined', () => {
        const next = syncCombatTracker([], [{ id: 'nameless' }, { id: 'nulled', title: null }], zones);
        expect(next.map(p => p.title)).toEqual(['', '']);
        expect(JSON.stringify(next)).not.toMatch(/undefined/);
    });

    describe('with no map (one shared column)', () => {
        test('everyone is in the Combatants column', () => {
            expect(NO_MAP_ZONE).toBe('Combatants');
            const next = syncCombatTracker([], [entity('a'), entity('b')], [NO_MAP_ZONE]);
            expect(next.map(p => [p.id, p.status])).toEqual([['a', 'Combatants'], ['b', 'Combatants']]);
        });

        test('someone who was in a map\'s zone moves into it when the map is unselected', () => {
            const next = syncCombatTracker([post('a', 'Zone 2', 0), post('b', 'Zone 1', 0)], [entity('a'), entity('b')], [NO_MAP_ZONE]);
            expect(next.map(p => [p.id, p.status, p.index])).toEqual([['a', 'Combatants', 0], ['b', 'Combatants', 1]]);
        });

        test('and moves back to a map\'s first zone when one is chosen', () => {
            const next = syncCombatTracker([post('a', 'Combatants', 0), post('b', 'Combatants', 1)], [entity('a'), entity('b')], zones);
            expect(next.map(p => [p.id, p.status, p.index])).toEqual([['a', 'Zone 1', 0], ['b', 'Zone 1', 1]]);
        });

        test('is already right once everyone is there', () => {
            expect(syncCombatTracker([post('a', 'Combatants', 0)], [entity('a')], [NO_MAP_ZONE])).toBeNull();
        });
    });

    describe('placing tokens on a map (given the zones\' rectangles)', () => {
        const rects = zoneRects([{ name: 'Zone 1', x: 50, y: 50, width: 100, height: 100 }, { name: 'Zone 2', x: 250, y: 100, width: 200, height: 100 }]);

        test('a new combatant gets a position in the first zone', () => {
            const next = syncCombatTracker([], [entity('a')], zones, rects);
            expect(next[0]).toMatchObject({ id: 'a', status: 'Zone 1', ...slotPosition(rects[0], 0) });
        });

        test('someone already in a zone but with no position (a tracker from before tokens) is given one', () => {
            const next = syncCombatTracker([post('a', 'Zone 2', 0)], [entity('a')], zones, rects);
            expect(zoneAt(next[0], rects)).toBe('Zone 2');
        });

        test('someone moved to another zone from the line view has their token brought along', () => {
            const next = syncCombatTracker([{ ...post('a', 'Zone 2', 0), x: 0.2, y: 0.2 }], [entity('a')], zones, rects);
            expect(zoneAt(next[0], rects)).toBe('Zone 2');
        });

        test('a token already in its zone stays exactly where it is: nothing to write', () => {
            expect(syncCombatTracker([{ ...post('a', 'Zone 1', 0), x: 0.25, y: 0.25 }], [entity('a')], zones, rects)).toBeNull();
        });

        test('once placed, syncing again changes nothing', () => {
            const first = syncCombatTracker([], [entity('a'), entity('b')], zones, rects);
            expect(syncCombatTracker(first, [entity('a'), entity('b')], zones, rects)).toBeNull();
        });

        test('without rectangles (no map geometry) no positions are added', () => {
            const next = syncCombatTracker([], [entity('a')], zones);
            expect(next[0]).not.toHaveProperty('x');
        });
    });

    describe('an old campaign whose tracker is not a list', () => {
        test('counts as nobody placed yet, and is replaced by a proper list', () => {
            const next = syncCombatTracker({ zones: [] }, [entity('a')], zones);
            expect(next).toEqual([{ id: 'a', title: 'a', content: '', status: 'Zone 1', index: 0 }]);
        });

        test('is replaced even when there is nobody to place', () => {
            expect(syncCombatTracker({ zones: [] }, [], zones)).toEqual([]);
            expect(syncCombatTracker(undefined, [], zones)).toEqual([]);
        });
    });
});

describe('addToTracker', () => {
    const zones = ['Zone 1', 'Zone 2'];
    const rects = zoneRects([{ name: 'Zone 1', x: 10, y: 10, width: 100, height: 80 }, { name: 'Zone 2', x: 200, y: 10, width: 100, height: 80 }]);
    const placed = (id, status, x, y, index = 0) => ({ ...post(id, status, index), x, y });

    test('has nothing to do with no zones, or no one to add', () => {
        expect(addToTracker([], [entity('a')], [])).toBeNull();
        expect(addToTracker([post('a', 'Zone 1', 0)], [], zones)).toBeNull();
    });

    test('is already right when they are all there', () => {
        expect(addToTracker([post('a', 'Zone 2', 0), post('b', 'Zone 1', 0)], [entity('a')], zones)).toBeNull();
    });

    test('puts someone who is missing in the first zone, after those already there', () => {
        const next = addToTracker([post('a', 'Zone 2', 0)], [entity('b')], zones);
        expect(next).toEqual([post('a', 'Zone 2', 0), { id: 'b', title: 'b', content: '', status: 'Zone 1', index: 1 }]);
    });

    test('never takes anyone out - someone it does not know about is not "gone"', () => {
        const stored = [post('goblin', 'Zone 2', 0), post('a', 'Zone 1', 0)];
        const next = addToTracker(stored, [entity('b')], zones);
        expect(next.map(p => p.id)).toEqual(['goblin', 'a', 'b']);
    });

    test('leaves everyone else exactly as stored, even where they would be moved by a full sync', () => {
        const stored = [post('lost', 'Old zone', 0), placed('outside', 'Zone 1', 0.9, 0.9)];
        const next = addToTracker(stored, [entity('b')], zones, rects);
        expect(next[0]).toBe(stored[0]);
        expect(next[1]).toBe(stored[1]);
    });

    test('given the map, the newcomer gets a spot inside its zone, clear of those already there', () => {
        const [first] = zoneRects([{ name: 'Zone 1', x: 10, y: 10, width: 100, height: 80 }]);
        const next = addToTracker([placed('a', 'Zone 1', slotPosition(first, 0).x, slotPosition(first, 0).y)], [entity('b')], zones, rects);
        const b = next.find(p => p.id === 'b');
        expect(zoneAt(b, rects)).toBe('Zone 1');
        expect(b).toMatchObject(slotPosition(first, 1));
    });

    test('someone of theirs who is on the tracker but has no spot on the map is given one', () => {
        const next = addToTracker([post('a', 'Zone 2', 0)], [entity('a')], zones, rects);
        expect(zoneAt(next[0], rects)).toBe('Zone 2');
        expect(Number.isFinite(next[0].x)).toBe(true);
    });

    test('is not confused by a tracker that is not a list', () => {
        expect(addToTracker(undefined, [entity('a')], zones)).toEqual([{ id: 'a', title: 'a', content: '', status: 'Zone 1', index: 0 }]);
        expect(addToTracker('junk', [entity('a')], zones)).toHaveLength(1);
    });

    test('a combatant with no name is given an empty title, since Firestore refuses undefined', () => {
        expect(addToTracker([], [{ id: 'a' }], zones)[0].title).toBe('');
    });

    test('does not change what it was given', () => {
        const stored = [post('a', 'Zone 2', 0)];
        addToTracker(stored, [entity('b')], zones, rects);
        expect(stored).toEqual([post('a', 'Zone 2', 0)]);
    });
});

describe('combatantMover', () => {
    const entities = [
        { id: 'character:a', kind: 'player', ownerIds: ['alice'] },
        { id: 'character:b', kind: 'player', ownerIds: ['bob', 'alice'] },
        { id: 'character:c', kind: 'player', ownerIds: ['carol'] },
        { id: 'npc:goblin', kind: 'enemy', ownerIds: ['alice'] },
    ];

    test('a director can move anyone, players and enemies alike', () => {
        const canMove = combatantMover(entities, 'dm', true);
        entities.forEach(entity => expect(canMove({ id: entity.id })).toBe(true));
    });

    test('a player can move their own characters, and ones they share, and no one else\'s', () => {
        const canMove = combatantMover(entities, 'alice', false);
        expect(canMove({ id: 'character:a' })).toBe(true);
        expect(canMove({ id: 'character:b' })).toBe(true);
        expect(canMove({ id: 'character:c' })).toBe(false);
    });

    test('and never an enemy, whatever its owner list says', () => {
        expect(combatantMover(entities, 'alice', false)({ id: 'npc:goblin' })).toBe(false);
    });

    test('someone who is signed out can move no one, even as a director', () => {
        expect(combatantMover(entities, undefined, true)({ id: 'character:a' })).toBe(false);
        expect(combatantMover(entities, '', false)({ id: 'character:a' })).toBe(false);
    });

    test('a post that is not in the fight cannot be moved by a player', () => {
        expect(combatantMover(entities, 'alice', false)({ id: 'character:nobody' })).toBe(false);
    });
});

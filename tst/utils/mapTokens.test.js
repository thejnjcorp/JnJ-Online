import { REFERENCE_WIDTH, TOKEN_SIZE, applyLineMove, moveToken, openSpot, placeTokens, round, settlePending, slotPosition, tokenInitials, withPending, zoneAt, zoneRects } from '../../src/utils/mapTokens';

// two zones authored on the 500px-wide reference map: 100 x 100 at (50, 50), and 200 x 100 at (250, 100)
const zones = [{ name: 'Zone 1', x: 50, y: 50, width: 100, height: 100 }, { name: 'Zone 2', x: 250, y: 100, width: 200, height: 100 }];
const rects = zoneRects(zones);
const post = (id, status, extra = {}) => ({ id, title: id, content: '', status, index: 0, ...extra });

describe('zoneRects', () => {
    test('are the zones in map widths, dividing both directions by the map\'s 500px reference width', () => {
        expect(REFERENCE_WIDTH).toBe(500);
        expect(rects).toEqual([{ name: 'Zone 1', x: 0.1, y: 0.1, w: 0.2, h: 0.2 }, { name: 'Zone 2', x: 0.5, y: 0.2, w: 0.4, h: 0.2 }]);
    });

    test('no zones is no rectangles', () => {
        expect(zoneRects()).toEqual([]);
        expect(zoneRects([])).toEqual([]);
    });
});

describe('zoneAt', () => {
    test('is the zone a point is inside, edges included', () => {
        expect(zoneAt({ x: 0.2, y: 0.2 }, rects)).toBe('Zone 1');
        expect(zoneAt({ x: 0.7, y: 0.3 }, rects)).toBe('Zone 2');
        expect(zoneAt({ x: 0.1, y: 0.1 }, rects)).toBe('Zone 1');
        expect(zoneAt({ x: 0.3, y: 0.3 }, rects)).toBe('Zone 1');
    });

    test('is nothing outside every zone', () => {
        expect(zoneAt({ x: 0.4, y: 0.4 }, rects)).toBeNull();
        expect(zoneAt({ x: 0.05, y: 0.05 }, rects)).toBeNull();
        expect(zoneAt({ x: 0.2, y: 0.2 }, [])).toBeNull();
    });

    test('where zones overlap, is the one drawn on top: the later one', () => {
        const overlapping = zoneRects([{ name: 'Big', x: 0, y: 0, width: 250, height: 250 }, { name: 'Small', x: 50, y: 50, width: 50, height: 50 }]);
        expect(zoneAt({ x: 0.15, y: 0.15 }, overlapping)).toBe('Small');
        expect(zoneAt({ x: 0.4, y: 0.4 }, overlapping)).toBe('Big');
    });
});

describe('slotPosition', () => {
    test('puts the first token near the top left of the zone, below its name, inside it', () => {
        const { x, y } = slotPosition(rects[1], 0);
        expect(x).toBeGreaterThan(rects[1].x);
        expect(y).toBeGreaterThan(rects[1].y);
        expect(zoneAt({ x, y }, rects)).toBe('Zone 2');
    });

    test('the next tokens fill along the row, then the next row', () => {
        const first = slotPosition(rects[1], 0);
        const second = slotPosition(rects[1], 1);
        expect(second.x).toBeGreaterThan(first.x);
        expect(second.y).toBe(first.y);
        const columns = Math.floor((rects[1].w - 0.024) / (TOKEN_SIZE * 1.2));
        const nextRow = slotPosition(rects[1], columns);
        expect(nextRow.x).toBe(first.x);
        expect(nextRow.y).toBeGreaterThan(first.y);
    });

    test('every spot is inside the zone, however crowded', () => {
        for (let n = 0; n < 60; n++) {
            [rects[0], rects[1]].forEach(rect => {
                const spot = slotPosition(rect, n);
                expect(spot.x).toBeGreaterThanOrEqual(rect.x);
                expect(spot.x).toBeLessThanOrEqual(rect.x + rect.w);
                expect(spot.y).toBeGreaterThanOrEqual(rect.y);
                expect(spot.y).toBeLessThanOrEqual(rect.y + rect.h);
            });
        }
    });

    test('a full zone wraps back to its first spot', () => {
        // Zone 1 is 0.2 x 0.2: room for 2 across and 2 down
        expect(slotPosition(rects[0], 3)).not.toEqual(slotPosition(rects[0], 0));
        expect(slotPosition(rects[0], 4)).toEqual(slotPosition(rects[0], 0));
        expect(slotPosition(rects[0], 5)).toEqual(slotPosition(rects[0], 1));
    });

    test('a zone too small for a token still gives a spot inside it', () => {
        const tiny = zoneRects([{ name: 'Tiny', x: 100, y: 100, width: 10, height: 10 }])[0];
        const spot = slotPosition(tiny, 3);
        expect(Number.isFinite(spot.x) && Number.isFinite(spot.y)).toBe(true);
    });
});

describe('placeTokens', () => {
    test('gives a token with no position the first spot in its zone', () => {
        const { posts, changed } = placeTokens([post('a', 'Zone 1')], rects);
        expect(changed).toBe(true);
        expect(posts[0]).toMatchObject({ id: 'a', status: 'Zone 1', ...slotPosition(rects[0], 0) });
    });

    test('the next token in a zone gets the next spot', () => {
        const { posts } = placeTokens([post('a', 'Zone 2'), post('b', 'Zone 2'), post('c', 'Zone 1')], rects);
        expect([posts[0].x, posts[0].y]).toEqual([slotPosition(rects[1], 0).x, slotPosition(rects[1], 0).y]);
        expect([posts[1].x, posts[1].y]).toEqual([slotPosition(rects[1], 1).x, slotPosition(rects[1], 1).y]);
        expect([posts[2].x, posts[2].y]).toEqual([slotPosition(rects[0], 0).x, slotPosition(rects[0], 0).y]);
    });

    test('a token already inside its zone keeps its position, and is not counted as changed', () => {
        const placed = post('a', 'Zone 1', { x: 0.25, y: 0.25 });
        const result = placeTokens([placed], rects);
        expect(result.changed).toBe(false);
        expect(result.posts[0]).toBe(placed);
    });

    test('a newcomer takes the next spot after those already placed there', () => {
        const { posts } = placeTokens([post('old', 'Zone 1', { x: 0.25, y: 0.25 }), post('new', 'Zone 1')], rects);
        expect([posts[1].x, posts[1].y]).toEqual([slotPosition(rects[0], 1).x, slotPosition(rects[0], 1).y]);
    });

    test('a token left outside its zone (moved to another zone from the line view) is put in it', () => {
        const stray = post('a', 'Zone 2', { x: 0.2, y: 0.2 }); // its position is in Zone 1
        const { posts, changed } = placeTokens([stray], rects);
        expect(changed).toBe(true);
        expect(zoneAt(posts[0], rects)).toBe('Zone 2');
    });

    test('a token with a broken position is placed', () => {
        const { posts } = placeTokens([post('a', 'Zone 1', { x: 'left', y: NaN })], rects);
        expect(posts[0].x).toEqual(slotPosition(rects[0], 0).x);
    });

    test('a token in a zone the map does not have is left alone', () => {
        const orphan = post('a', 'Old zone');
        const result = placeTokens([orphan], rects);
        expect(result.changed).toBe(false);
        expect(result.posts[0]).toBe(orphan);
    });

    test('is settled: placing what it placed changes nothing (so a sync never loops)', () => {
        const first = placeTokens([post('a', 'Zone 1'), post('b', 'Zone 1'), post('c', 'Zone 2')], rects);
        expect(placeTokens(first.posts, rects).changed).toBe(false);
    });

    test('a token in an overlapping zone stays put even where a zone above it covers it', () => {
        const overlapping = zoneRects([{ name: 'Big', x: 0, y: 0, width: 250, height: 250 }, { name: 'Small', x: 50, y: 50, width: 50, height: 50 }]);
        const { posts } = placeTokens([post('a', 'Big')], overlapping);
        expect(placeTokens(posts, overlapping).changed).toBe(false);
    });

    test('does not change the posts it was given', () => {
        const original = [post('a', 'Zone 1')];
        placeTokens(original, rects);
        expect(original[0]).not.toHaveProperty('x');
    });
});

describe('moveToken', () => {
    const posts = [post('a', 'Zone 1', { index: 0, x: 0.2, y: 0.2 }), post('b', 'Zone 1', { index: 1, x: 0.25, y: 0.25 }), post('c', 'Zone 2', { index: 0, x: 0.6, y: 0.3 })];

    test('puts the token at the point, in its zone', () => {
        const next = moveToken(posts, 'a', { x: 0.22, y: 0.28 }, 'Zone 1');
        expect(next[0]).toMatchObject({ id: 'a', status: 'Zone 1', x: 0.22, y: 0.28 });
        expect(next[0].index).toBe(0); // same zone: same place in line
    });

    test('moving to another zone sets its zone and puts it last in that zone\'s line', () => {
        const next = moveToken(posts, 'a', { x: 0.7, y: 0.3 }, 'Zone 2');
        expect(next[0]).toMatchObject({ status: 'Zone 2', index: 1, x: 0.7, y: 0.3 });
    });

    test('leaves every other token alone', () => {
        const next = moveToken(posts, 'a', { x: 0.7, y: 0.3 }, 'Zone 2');
        expect(next[1]).toBe(posts[1]);
        expect(next[2]).toBe(posts[2]);
    });

    test('rounds the position', () => {
        expect(moveToken(posts, 'a', { x: 0.123456, y: 0.2 }, 'Zone 1')[0].x).toBe(0.1235);
    });

    test('a token that is not there changes nothing', () => {
        expect(moveToken(posts, 'nobody', { x: 0.2, y: 0.2 }, 'Zone 1')).toBe(posts);
    });

    test('does not change the posts it was given', () => {
        moveToken(posts, 'a', { x: 0.7, y: 0.3 }, 'Zone 2');
        expect(posts[0]).toMatchObject({ status: 'Zone 1', x: 0.2 });
    });
});

describe('tokenInitials', () => {
    test.each([
        ['Aria Nightshade', 'AN'], ['Aria', 'AR'], ['Rust Bandit 2', 'R2'], ['  spaced   out  ', 'SO'], ['a', 'A'], ['', '?'], [undefined, '?'], [null, '?'],
    ])('%p is %p', (title, initials) => {
        expect(tokenInitials(title)).toBe(initials);
    });
});

describe('round', () => {
    test('keeps four decimal places, like the positions that are saved', () => {
        expect(round(0.123456)).toBe(0.1235);
        expect(round(0.5)).toBe(0.5);
    });
});

describe('dropped tokens waiting for the tracker to catch up', () => {
    const drop = { to: { x: 0.6, y: 0.2 }, from: { x: 0.1, y: 0.1 } };
    const at = (id, x, y) => ({ id, status: 'Zone 1', index: 0, x, y });

    describe('withPending', () => {
        test('draws a token at the spot it was dropped', () => {
            expect(withPending(at('a', 0.1, 0.1), { a: drop })).toMatchObject({ id: 'a', x: 0.6, y: 0.2, status: 'Zone 1' });
        });

        test('leaves every other token, and every token with nothing pending, as it is', () => {
            const post = at('b', 0.3, 0.3);
            expect(withPending(post, { a: drop })).toBe(post);
            expect(withPending(post, {})).toBe(post);
        });
    });

    describe('settlePending', () => {
        test('keeps waiting while the tracker still has the token where it was', () => {
            const pending = { a: drop };
            expect(settlePending(pending, [at('a', 0.1, 0.1)])).toBe(pending);
        });

        test('is finished once the tracker shows the token at the spot it was dropped', () => {
            expect(settlePending({ a: drop }, [at('a', 0.6, 0.2)])).toEqual({});
        });

        test('a spot that only differs by rounding still counts', () => {
            expect(settlePending({ a: drop }, [at('a', 0.600001, 0.199999)])).toEqual({});
        });

        test('is finished when the tracker has the token somewhere else again: someone else moved it, and that is the truth now', () => {
            expect(settlePending({ a: drop }, [at('a', 0.9, 0.3)])).toEqual({});
        });

        test('is finished when the token is no longer on the tracker', () => {
            expect(settlePending({ a: drop }, [at('b', 0.1, 0.1)])).toEqual({});
        });

        test('the spots of earlier drops still on their way are the tracker not having caught up, not someone else moving it', () => {
            const second = { to: { x: 0.58, y: 0.2 }, from: { x: 0.1, y: 0.1 }, skipped: [{ x: 0.55, y: 0.1 }] };
            expect(settlePending({ a: second }, [at('a', 0.55, 0.1)])).toEqual({ a: second });
            expect(settlePending({ a: second }, [at('a', 0.58, 0.2)])).toEqual({});
            expect(settlePending({ a: second }, [at('a', 0.9, 0.3)])).toEqual({});
        });

        test('with no earlier spot to compare with (it had none), only the drop arriving finishes it', () => {
            const fresh = { a: { to: { x: 0.6, y: 0.2 }, from: null } };
            expect(settlePending(fresh, [at('a', 0.9, 0.3)])).toBe(fresh);
            expect(settlePending(fresh, [at('a', 0.6, 0.2)])).toEqual({});
        });

        test('settles each token on its own', () => {
            const other = { to: { x: 0.4, y: 0.4 }, from: { x: 0.2, y: 0.2 } };
            const result = settlePending({ a: drop, b: other }, [at('a', 0.6, 0.2), at('b', 0.2, 0.2)]);
            expect(Object.keys(result)).toEqual(['b']);
        });

        test('with nothing pending it is the same object, so a state update with it does nothing', () => {
            const none = {};
            expect(settlePending(none, [at('a', 0.1, 0.1)])).toBe(none);
        });

        test('does not change what it was given', () => {
            const pending = { a: drop };
            settlePending(pending, [at('a', 0.6, 0.2)]);
            expect(pending).toEqual({ a: drop });
        });
    });
});

describe('openSpot', () => {
    // a zone 0.4 wide and 0.4 tall at (0.1, 0.1): its middle is (0.3, 0.3)
    const rect = { name: 'Zone', x: 0.1, y: 0.1, w: 0.4, h: 0.4 };
    const step = TOKEN_SIZE * 1.2;

    test('is the middle of the zone when nobody is there', () => {
        expect(openSpot(rect, [])).toEqual({ x: 0.3, y: 0.3 });
        expect(openSpot(rect)).toEqual({ x: 0.3, y: 0.3 });
    });

    test('is the next spot to the right when someone is in the middle', () => {
        const spot = openSpot(rect, [{ x: 0.3, y: 0.3 }]);
        expect(spot.y).toBe(0.3);
        expect(spot.x).toBeCloseTo(0.3 + step, 4);
    });

    test('keeps going right for each one already there', () => {
        const spot = openSpot(rect, [{ x: 0.3, y: 0.3 }, { x: 0.3 + step, y: 0.3 }]);
        expect(spot.y).toBe(0.3);
        expect(spot.x).toBeCloseTo(0.3 + 2 * step, 4);
    });

    test('goes down to the next row once the way right is used up, starting back in the middle column', () => {
        // fill the middle row from the middle to the right-hand edge
        const taken = [];
        for (let k = 0; ; k++) {
            const x = 0.3 + k * step;
            if (x > 0.5 - 0.012 - TOKEN_SIZE / 2) break;
            taken.push({ x, y: 0.3 });
        }
        const spot = openSpot(rect, taken);
        // the row's left-hand half is still free, so it fills that before going down
        expect(spot.y).toBe(0.3);
        expect(spot.x).toBeLessThan(0.3);
    });

    test('and down to the next row once the whole row is full', () => {
        const taken = [];
        for (let x = 0.1; x <= 0.5; x += step / 2) taken.push({ x, y: 0.3 }); // a wall of tokens right across the middle row
        const spot = openSpot(rect, taken);
        expect(spot.y).toBeGreaterThan(0.3);
    });

    test('a token that is close to a spot but not on it still takes it', () => {
        const spot = openSpot(rect, [{ x: 0.3 + TOKEN_SIZE * 0.4, y: 0.3 }]);
        expect(spot).not.toEqual({ x: 0.3, y: 0.3 });
    });

    test('a token that is far enough away leaves the middle free', () => {
        expect(openSpot(rect, [{ x: 0.3 + TOKEN_SIZE * 1.01, y: 0.3 }])).toEqual({ x: 0.3, y: 0.3 });
    });

    test('never puts a token outside the zone, however many are there', () => {
        const taken = [];
        for (let i = 0; i < 12; i++) {
            const spot = openSpot(rect, taken);
            expect(spot.x).toBeGreaterThanOrEqual(rect.x);
            expect(spot.x).toBeLessThanOrEqual(rect.x + rect.w);
            expect(spot.y).toBeGreaterThanOrEqual(rect.y);
            expect(spot.y).toBeLessThanOrEqual(rect.y + rect.h);
            taken.push(spot);
        }
    });

    test('each token added in turn gets a spot of its own, until the zone is full', () => {
        const taken = [];
        const seen = new Set();
        for (let i = 0; i < 12; i++) {
            const spot = openSpot(rect, taken);
            expect(seen.has(`${spot.x},${spot.y}`)).toBe(false);
            seen.add(`${spot.x},${spot.y}`);
            taken.push(spot);
        }
    });

    test('a full zone gives its middle again, rather than nothing', () => {
        const taken = [];
        for (let i = 0; i < 200; i++) taken.push(openSpot(rect, taken));
        expect(openSpot(rect, taken)).toEqual({ x: 0.3, y: 0.3 });
    });

    test('ignores those with no position yet', () => {
        expect(openSpot(rect, [{}, { x: undefined, y: 0.3 }, { x: NaN, y: NaN }])).toEqual({ x: 0.3, y: 0.3 });
    });

    test('a zone too small to keep tokens off its edges gives its middle', () => {
        const tiny = { name: 'Tiny', x: 0.1, y: 0.1, w: 0.03, h: 0.03 };
        expect(openSpot(tiny, [{ x: 0.115, y: 0.115 }])).toEqual({ x: 0.115, y: 0.115 });
    });

    test('a zone whose middle is under its name is moved down out of it', () => {
        const short = { name: 'Short', x: 0.1, y: 0.1, w: 0.4, h: 0.09 };
        const spot = openSpot(short, []);
        expect(spot.y).toBeGreaterThan(0.1 + 0.034); // clear of the header
    });
});

describe('applyLineMove', () => {
    const rects = zoneRects([{ name: 'Zone 1', x: 10, y: 10, width: 200, height: 200 }, { name: 'Zone 2', x: 250, y: 10, width: 200, height: 200 }]);
    const at = (id, status, index, x, y) => ({ id, title: id, content: '', status, index, x, y });

    test('puts someone dragged into another zone in the middle of it', () => {
        const current = [at('a', 'Zone 1', 0, 0.1, 0.1), at('b', 'Zone 2', 0, 0.6, 0.1)];
        const updated = [at('a', 'Zone 2', 1, 0.1, 0.1), at('b', 'Zone 2', 0, 0.6, 0.1)];
        const next = applyLineMove(current, updated, rects);
        const a = next.find(p => p.id === 'a');
        expect(a).toMatchObject({ status: 'Zone 2', index: 1 });
        // zone 2 is 0.5..0.9 across and 0.02..0.42 down: its middle is (0.7, 0.22)
        expect(a.x).toBeCloseTo(0.7, 3);
        expect(a.y).toBeCloseTo(0.22, 3);
    });

    test('shifts them right if someone is already in the middle', () => {
        const current = [at('a', 'Zone 1', 0, 0.1, 0.1), at('b', 'Zone 2', 0, 0.7, 0.22)];
        const updated = [at('a', 'Zone 2', 1), at('b', 'Zone 2', 0)];
        const a = applyLineMove(current, updated, rects).find(p => p.id === 'a');
        expect(a.x).toBeGreaterThan(0.7);
        expect(a.y).toBeCloseTo(0.22, 3);
    });

    test('leaves everyone else exactly as they are', () => {
        const current = [at('a', 'Zone 1', 0, 0.1, 0.1), at('b', 'Zone 2', 0, 0.6, 0.1), at('c', 'Zone 1', 1, 0.15, 0.15)];
        const updated = [at('a', 'Zone 2', 1), at('b', 'Zone 2', 0), at('c', 'Zone 1', 1)];
        const next = applyLineMove(current, updated, rects);
        expect(next[1]).toBe(current[1]);
        expect(next[2]).toBe(current[2]);
    });

    test('someone who only moved up or down within their zone keeps their place on the map', () => {
        const current = [at('a', 'Zone 1', 0, 0.1, 0.1), at('b', 'Zone 1', 1, 0.15, 0.15)];
        const updated = [at('b', 'Zone 1', 0), at('a', 'Zone 1', 1)];
        const next = applyLineMove(current, updated, rects);
        expect(next.map(p => [p.id, p.index, p.x, p.y])).toEqual([['a', 1, 0.1, 0.1], ['b', 0, 0.15, 0.15]]);
    });

    test('someone the line view does not have (added while it was open) is not lost', () => {
        const current = [at('a', 'Zone 1', 0, 0.1, 0.1), at('newcomer', 'Zone 1', 1, 0.15, 0.15)];
        const updated = [at('a', 'Zone 2', 0)];
        const next = applyLineMove(current, updated, rects);
        expect(next.map(p => p.id)).toEqual(['a', 'newcomer']);
        expect(next[1]).toBe(current[1]);
    });

    test('someone the tracker no longer has (taken out while it was open) does not come back', () => {
        const current = [at('a', 'Zone 1', 0, 0.1, 0.1)];
        const updated = [at('a', 'Zone 1', 0), at('gone', 'Zone 1', 1)];
        expect(applyLineMove(current, updated, rects).map(p => p.id)).toEqual(['a']);
    });

    test('two dragged into the same zone at once do not share a spot', () => {
        const current = [at('a', 'Zone 1', 0, 0.1, 0.1), at('b', 'Zone 1', 1, 0.15, 0.15)];
        const updated = [at('a', 'Zone 2', 0), at('b', 'Zone 2', 1)];
        const [a, b] = applyLineMove(current, updated, rects);
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(TOKEN_SIZE);
    });

    test('without a map the zone and place in line change, and no position is made up', () => {
        const current = [at('a', 'Combatants', 0, undefined, undefined)];
        const updated = [at('a', 'Combatants', 0)];
        expect(applyLineMove(current, updated, null)).toEqual(current);
        const moved = applyLineMove([at('a', 'X', 0)], [at('a', 'Y', 0)], null);
        expect(moved[0]).toMatchObject({ status: 'Y' });
        expect(moved[0].x).toBeUndefined();
    });

    test('moved into a zone the map does not have, it is left where it is', () => {
        const current = [at('a', 'Zone 1', 0, 0.1, 0.1)];
        const next = applyLineMove(current, [at('a', 'Old zone', 0)], rects);
        expect(next[0]).toMatchObject({ status: 'Old zone', x: 0.1, y: 0.1 });
    });

    test('a tracker that is not a list is treated as empty, and does not change what it is given', () => {
        expect(applyLineMove(undefined, [at('a', 'Zone 1', 0)], rects)).toEqual([]);
        const current = [at('a', 'Zone 1', 0, 0.1, 0.1)];
        applyLineMove(current, [at('a', 'Zone 2', 0)], rects);
        expect(current).toEqual([at('a', 'Zone 1', 0, 0.1, 0.1)]);
    });
});

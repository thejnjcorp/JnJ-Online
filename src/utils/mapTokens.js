// Tokens on the combat map: one icon per combatant, dragged around the map, with
// the zone each is in tracked from where it sits.
//
// A combatant's entry in the combat tracker (on the campaign's party doc, see
// party.js) keeps its zone name in
// `status` (which the line view and everything else already read) and now also
// where its token is: `x` and `y`, in "map widths" - x from 0 to 1 across the map,
// y down it in the same unit, so a position means the same at any size the map is
// shown (the same units as the drawing, see mapDrawing.js). Zones are rectangles
// authored against a 500px-wide map (MAP_REFERENCE_WIDTH in the map component).

export const REFERENCE_WIDTH = 500;

// A token's diameter, in map widths.
export const TOKEN_SIZE = 0.05;

const SPACING = TOKEN_SIZE * 1.2;
const SIDE_PADDING = 0.012;
// room for the zone's name across its top
const HEADER = 0.034;

export const round = value => Math.round(value * 10000) / 10000;

// The zones as rectangles in map widths.
export const zoneRects = (zones = []) => zones.map(zone => ({
    name: zone.name,
    x: zone.x / REFERENCE_WIDTH,
    y: zone.y / REFERENCE_WIDTH,
    w: zone.width / REFERENCE_WIDTH,
    h: zone.height / REFERENCE_WIDTH,
}));

const inside = (point, rect) => point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h;

// The zone a point is in. Where zones overlap it is the one drawn on top (the
// later one), so the zone you see under a token is the zone it counts as.
export function zoneAt(point, rects) {
    for (let i = rects.length - 1; i >= 0; i--) {
        if (inside(point, rects[i])) return rects[i].name;
    }
    return null;
}

// Where the nth token in a zone goes when nothing has put it anywhere: rows of
// tokens filling the zone from the top left, wrapping onto the first spot again
// when the zone is full.
export function slotPosition(rect, n) {
    const columns = Math.max(1, Math.floor((rect.w - 2 * SIDE_PADDING) / SPACING));
    const rows = Math.max(1, Math.floor((rect.h - HEADER - SIDE_PADDING) / SPACING));
    const slot = n % (columns * rows);
    const column = slot % columns;
    const row = Math.floor(slot / columns);
    return {
        x: round(Math.min(rect.x + SIDE_PADDING + SPACING * (column + 0.5), rect.x + rect.w - TOKEN_SIZE / 2)),
        y: round(Math.min(rect.y + HEADER + SPACING * (row + 0.5), rect.y + rect.h - TOKEN_SIZE / 2)),
    };
}

// The offsets 0, 1, 2 ... up to `after` steps, then -1, -2 ... down to `before` steps:
// the spots along a line in the order they are tried - the middle first, then
// onwards, then back the other way.
function outwards(after, before) {
    const steps = [];
    for (let k = 0; k <= after; k++) steps.push(k);
    for (let k = 1; k <= before; k++) steps.push(-k);
    return steps;
}

// Where a token put into a zone (moved there from another, say) goes: the middle of
// the zone, and if another token is already there, the next spot to the right, then
// on across the row and down to the next row until one is free. `taken` are the
// positions ({ x, y }) of the tokens already in the zone. A zone with no free spot
// left gives its middle.
export function openSpot(rect, taken = []) {
    const low = { x: rect.x + SIDE_PADDING + TOKEN_SIZE / 2, y: rect.y + HEADER + TOKEN_SIZE / 2 };
    const high = { x: rect.x + rect.w - SIDE_PADDING - TOKEN_SIZE / 2, y: rect.y + rect.h - SIDE_PADDING - TOKEN_SIZE / 2 };
    // a zone too small to keep its tokens clear of its edges: just its middle
    const centre = { x: round(rect.x + rect.w / 2), y: round(rect.y + rect.h / 2) };
    if (high.x < low.x || high.y < low.y) return centre;
    const middle = { x: Math.min(high.x, Math.max(low.x, centre.x)), y: Math.min(high.y, Math.max(low.y, centre.y)) };

    const across = outwards(Math.floor((high.x - middle.x) / SPACING), Math.floor((middle.x - low.x) / SPACING));
    const down = outwards(Math.floor((high.y - middle.y) / SPACING), Math.floor((middle.y - low.y) / SPACING));
    const occupied = spot => taken.some(other => Number.isFinite(other.x) && Number.isFinite(other.y) && Math.hypot(other.x - spot.x, other.y - spot.y) < TOKEN_SIZE);

    for (const row of down) {
        for (const column of across) {
            const spot = { x: round(middle.x + column * SPACING), y: round(middle.y + row * SPACING) };
            if (!occupied(spot)) return spot;
        }
    }
    return { x: round(middle.x), y: round(middle.y) };
}

const hasPosition = post => Number.isFinite(post.x) && Number.isFinite(post.y);

// Every token given a place in its own zone: one that already has a position
// inside its zone keeps it; one with none (a new combatant, an old tracker from
// before tokens) or one left outside its zone (moved to another zone from the line
// view) goes to the next free spot in it. A token whose zone isn't one of `rects`
// is left as it is. `changed` says whether anything was placed.
export function placeTokens(posts, rects) {
    const byName = Object.fromEntries(rects.map(rect => [rect.name, rect]));
    const taken = {};
    rects.forEach(rect => { taken[rect.name] = 0; });
    const keeps = post => byName[post.status] && hasPosition(post) && inside(post, byName[post.status]);
    posts.forEach(post => { if (keeps(post)) taken[post.status] += 1; });

    let changed = false;
    const placed = posts.map(post => {
        if (!byName[post.status] || keeps(post)) return post;
        changed = true;
        return { ...post, ...slotPosition(byName[post.status], taken[post.status]++) };
    });
    return { posts: placed, changed };
}

// The tracker after dragging a token: it is now at `point`, in `zone`. Moving to a
// different zone puts it last in that zone's line.
export function moveToken(posts, id, point, zone) {
    const moved = posts.find(post => post.id === id);
    if (!moved) return posts;
    const changedZone = moved.status !== zone;
    const index = changedZone ? posts.filter(post => post.status === zone).length : moved.index;
    return posts.map(post => (post.id === id ? { ...post, status: zone, index, x: round(point.x), y: round(point.y) } : post));
}

// A token dropped somewhere is saved to the party doc in a transaction, and a
// transaction - unlike an ordinary write - doesn't show up in the local data until
// the server has confirmed it and sent it back. Until then the tracker still has the
// token at its old spot, so left alone it would jump back there and then forward
// again. So a drop is kept as `pending` - { [id]: { to, from, skipped } }, where it
// was put, where the tracker had it, and where earlier drops of it that are still
// on their way were put - and the token is drawn at `to` until the tracker has
// caught up.
const SAME_SPOT = 0.00005;
const atSpot = (post, spot) => Number.isFinite(post.x) && Number.isFinite(post.y) && Math.abs(post.x - spot.x) < SAME_SPOT && Math.abs(post.y - spot.y) < SAME_SPOT;

// What is still pending once the tracker (`posts`) has changed: a drop is finished
// when the tracker shows the token at the spot it was dropped, or has moved it
// somewhere else again (someone else moved it, and that is the truth now), or no
// longer has it. Where it was before, and where earlier drops put it, don't count
// as somewhere else: those are the tracker not having caught up yet. Returns the very same object when nothing has finished, so a
// state update with it does nothing.
export function settlePending(pending, posts) {
    const remaining = {};
    let changed = false;
    Object.entries(pending).forEach(([id, drop]) => {
        const post = posts.find(candidate => candidate.id === id);
        const arrived = post && atSpot(post, drop.to);
        const behind = [drop.from, ...(drop.skipped || [])].filter(Boolean);
        const movedElsewhere = post && drop.from && Number.isFinite(post.x) && !arrived && !behind.some(spot => atSpot(post, spot));
        if (!post || arrived || movedElsewhere) changed = true;
        else remaining[id] = drop;
    });
    return changed ? remaining : pending;
}

// A post drawn where it was dropped, if a drop of it is pending.
export const withPending = (post, pending) => (pending[post.id] ? { ...post, x: pending[post.id].to.x, y: pending[post.id].to.y } : post);

// The letters shown in a token with no picture: up to two initials.
export function tokenInitials(title) {
    const words = String(title || '').trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return '?';
    if (words.length === 1) return Array.from(words[0]).slice(0, 2).join('').toUpperCase();
    return (Array.from(words[0])[0] + Array.from(words[words.length - 1])[0]).toUpperCase();
}

// The tracker after a change made from the line view, where combatants are dragged
// between zone lists (and reordered within them). `updated` is the whole list as the
// line view now has it; `current` is the tracker as it stands now. A combatant is
// taken from `updated` for its zone and place in the line; everyone else - including
// someone added or moved while the drag was going on - is left as it is now. A
// combatant that has changed zone is put in the middle of the new zone, or the next
// free spot in it (see openSpot), so it lands somewhere sensible on the map; one that
// only moved within its zone keeps its place there. `rects` are the map's zones (none
// without a map, which leaves positions alone).
export function applyLineMove(current, updated, rects = null) {
    const now = Array.isArray(current) ? current : [];
    const byId = new Map(updated.map(post => [post.id, post]));
    const next = now.map(post => {
        const change = byId.get(post.id);
        if (!change || (change.status === post.status && change.index === post.index)) return post;
        return { ...post, status: change.status, index: change.index };
    });

    const moved = now.filter((post, i) => next[i].status !== post.status).map(post => post.id);
    if (!rects || moved.length === 0) return next;

    const byName = Object.fromEntries(rects.map(rect => [rect.name, rect]));
    const settled = [...next];
    moved.forEach(id => {
        const i = settled.findIndex(post => post.id === id);
        const rect = byName[settled[i].status];
        if (!rect) return;
        const taken = settled.filter((post, j) => j !== i && post.status === settled[i].status);
        settled[i] = { ...settled[i], ...openSpot(rect, taken) };
    });
    return settled;
}

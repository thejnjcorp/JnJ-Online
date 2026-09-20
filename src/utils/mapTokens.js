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

// Engagement: who is in a scrap with whom. Dragging one combatant onto another in the
// zones view puts the two in an engagement - a tile of their own inside the zone - and
// anyone else dragged onto that tile (or between its members) joins them.
//
// It is kept on the combat tracker (see combatTracker.js, party.js): each member's entry
// has an `engagement` id, shared by everyone in the same engagement, and the members sit
// next to each other in their zone's line. An engagement is only ever of two or more in
// one zone: once it is down to one, or its members are no longer in the same zone, it is
// dismissed and whoever is left is back in the zone's own list.

const idOf = post => post?.engagement || '';

export function newEngagementId() {
    return `eng-${crypto.randomUUID()}`;
}

const withoutEngagement = post => {
    const { engagement, ...rest } = post;
    return rest;
};

const byIndex = (a, b) => (a.index ?? 0) - (b.index ?? 0);

// The tracker with its engagements put right, or the very same list when they already are:
//   - an engagement of fewer than two in a zone is dismissed,
//   - an engagement's members are brought together, where its first member stood (and a
//     zone that had to change is numbered again in its new order).
export function settleEngagements(posts) {
    const list = Array.isArray(posts) ? posts : [];
    const sizes = new Map();
    list.forEach(post => {
        if (idOf(post)) sizes.set(`${post.status}|${idOf(post)}`, (sizes.get(`${post.status}|${idOf(post)}`) || 0) + 1);
    });
    const alone = post => idOf(post) && sizes.get(`${post.status}|${idOf(post)}`) < 2;

    let changed = false;
    const cleaned = list.map(post => {
        if (!alone(post)) return post;
        changed = true;
        return withoutEngagement(post);
    });

    // a zone whose engagements had to be brought together is numbered again in its new order
    const settled = new Map();
    [...new Set(cleaned.map(post => post.status))].forEach(zone => {
        const column = cleaned.filter(post => post.status === zone).sort(byIndex);
        const ordered = [];
        column.forEach(post => {
            if (ordered.includes(post)) return;
            ordered.push(post);
            if (idOf(post)) column.filter(other => other !== post && idOf(other) === idOf(post)).forEach(other => ordered.push(other));
        });
        if (ordered.every((post, index) => post === column[index])) return;
        changed = true;
        ordered.forEach((post, index) => settled.set(post.id, post.index === index ? post : { ...post, index }));
    });
    return changed ? cleaned.map(post => settled.get(post.id) ?? post) : list;
}

// `sourceId` dragged onto `targetId`: they are engaged, in the target's zone - the target's
// engagement if it has one, else a new one - with the source last in it. Nothing happens
// when either is not there, or they are the same.
export function engage(posts, sourceId, targetId) {
    const source = posts.find(post => post.id === sourceId);
    const target = posts.find(post => post.id === targetId);
    if (!source || !target || source === target) return posts;
    const engagement = idOf(target) || newEngagementId();

    const others = posts.filter(post => post !== source && post.status === target.status).sort(byIndex);
    const lastOfGroup = others.reduce((last, post, index) => (post === target || idOf(post) === engagement ? index : last), -1);
    const moved = { ...source, status: target.status, engagement };
    const ordered = [...others.slice(0, lastOfGroup + 1), moved, ...others.slice(lastOfGroup + 1)];
    const placed = new Map(ordered.map((post, index) => [post.id, { ...post, index }]));
    const withMoved = posts.map(post => placed.get(post.id) ?? post)
        .map(post => (post.id === target.id && !idOf(post) ? { ...post, engagement } : post));
    return settleEngagements(withMoved);
}

// After someone is dropped somewhere in a zone's list (not onto anyone): they are in an
// engagement only if dropped in the middle of one - between two of its members - and
// otherwise they have left whichever one they were in.
export function settleDrop(posts, movedId) {
    const moved = posts.find(post => post.id === movedId);
    if (!moved) return settleEngagements(posts);
    const column = posts.filter(post => post.status === moved.status).sort(byIndex);
    const at = column.indexOf(moved);
    const before = idOf(column[at - 1]);
    const after = idOf(column[at + 1]);
    const engagement = before && before === after ? before : '';
    if (engagement === idOf(moved)) return settleEngagements(posts);
    return settleEngagements(posts.map(post => {
        if (post !== moved) return post;
        return engagement ? { ...post, engagement } : withoutEngagement(post);
    }));
}

// Who a combatant is engaged with, by name (nobody, when it is not engaged).
export function engagedWith(posts, id) {
    const mine = posts.find(post => post.id === id);
    if (!idOf(mine)) return [];
    return posts.filter(post => post.id !== id && post.status === mine.status && idOf(post) === idOf(mine)).map(post => post.title);
}

// ---- On the map -------------------------------------------------------------

// The tokens that are engaged with each other, a group to an engagement: [{ id, members }],
// members in the order they were given. Someone engaged with no one else on the map (the
// rest have no token there) is not in a group.
export function engagedGroups(tokens) {
    const byId = new Map();
    tokens.forEach(token => {
        if (!idOf(token)) return;
        byId.set(idOf(token), [...(byId.get(idOf(token)) || []), token]);
    });
    return [...byId.entries()].filter(([, members]) => members.length > 1).map(([id, members]) => ({ id, members }));
}

// The lines that tie a group of points together on the map: every point joined to the nearest
// one already tied in (a minimum spanning tree), so the group reads as one shape however
// many are in it. Pairs of indexes into `points`.
export function engagementLinks(points) {
    const tied = [0];
    const links = [];
    while (tied.length < points.length) {
        let best = null;
        tied.forEach(from => points.forEach((point, to) => {
            if (tied.includes(to)) return;
            const distance = Math.hypot(point.x - points[from].x, point.y - points[from].y);
            if (!best || distance < best.distance) best = { from, to, distance };
        }));
        tied.push(best.to);
        links.push([best.from, best.to]);
    }
    return links;
}

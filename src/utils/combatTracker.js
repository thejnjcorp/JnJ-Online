// Keeping the campaign's combat_tracker (who is in the fight, which zone each is
// in, and - on a map - where each one's token sits) in step with who is actually in
// the fight.

import { placeTokens } from './mapTokens';

// With no map selected there are no zones, so everyone shares this one column.
export const NO_MAP_ZONE = 'Combatants';

// The tracker as it should be, or null when it is already right. `zoneNames` are
// the zones to place people in (none: nothing is done).
//   - anyone no longer in the fight is taken out,
//   - anyone new goes in the first zone,
//   - anyone whose zone isn't among `zoneNames` any more (another map was chosen,
//     or none) moves to the first zone; everyone else keeps their place,
//   - and, given the map's zone rectangles (`rects`), every token has a position
//     inside its zone (see placeTokens).
export function syncCombatTracker(storedPosts, entities, zoneNames, rects = null) {
    if (zoneNames.length === 0) return null;
    // no tracker stored yet is no one placed yet
    const posts = storedPosts ?? [];

    const known = new Set(entities.map(entity => entity.id));
    const existing = new Set(posts.map(post => post.id));
    // Someone is on the tracker once. A second post with the same id (two writers each adding
    // the same newly staged enemy) is dropped - the first one stands - so it shows twice for no one.
    const seen = new Set();
    const survivors = posts.filter(post => {
        if (!known.has(post.id) || seen.has(post.id)) return false;
        seen.add(post.id);
        return true;
    });

    const taken = {};
    zoneNames.forEach(zone => { taken[zone] = survivors.filter(post => post.status === zone).length; });
    const homed = survivors.map(post => (zoneNames.includes(post.status) ? post : { ...post, status: zoneNames[0], index: taken[zoneNames[0]]++ }));
    const moved = homed.some((post, i) => post !== survivors[i]);

    const additions = entities
        .filter(entity => !existing.has(entity.id))
        .map((entity, offset) => ({
            id: entity.id,
            // Firestore refuses an undefined value, and a combatant can lack a name
            title: entity.title ?? '',
            content: '',
            status: zoneNames[0],
            index: survivors.length + offset,
        }));

    const positioned = rects ? placeTokens([...homed, ...additions], rects) : { posts: [...homed, ...additions], changed: false };
    if (additions.length === 0 && !moved && !positioned.changed && survivors.length === posts.length && Boolean(storedPosts)) return null;
    return positioned.posts;
}

// The tracker with `entities` put in it and given a place, and everyone else left
// exactly as stored - or null when they are all there already. This is what a
// player's own client does for their own characters: unlike syncCombatTracker it
// never takes anyone out or moves anyone else, so it is safe for someone who only
// knows part of the fight (a player's copy of the campaign can be behind the
// director's, and would wrongly see freshly staged enemies as gone).
export function addToTracker(storedPosts, entities, zoneNames, rects = null) {
    if (zoneNames.length === 0 || entities.length === 0) return null;
    const posts = storedPosts ?? [];
    const mine = new Set(entities.map(entity => entity.id));
    const existing = new Set(posts.map(post => post.id));

    const additions = entities
        .filter(entity => !existing.has(entity.id))
        .map((entity, offset) => ({ id: entity.id, title: entity.title ?? '', content: '', status: zoneNames[0], index: posts.length + offset }));
    const all = [...posts, ...additions];

    const placed = rects ? placeTokens(all, rects).posts : all;
    const next = placed.map((post, i) => (mine.has(post.id) ? post : all[i]));
    const changed = next.some((post, i) => post !== all[i]) || additions.length > 0 || !storedPosts;
    return changed ? next : null;
}

// Who may drag a combatant around: a director anyone; a player only their own
// characters (or ones they can write). Returns a function of a tracker post, for the
// line view's `canMovePost`.
export function combatantMover(entities, userId, isDirector) {
    const owned = new Set(entities
        .filter(entity => entity.kind === 'player' && Boolean(userId) && Boolean(entity.ownerIds?.includes(userId)))
        .map(entity => entity.id));
    return post => Boolean(userId) && (isDirector || owned.has(post.id));
}

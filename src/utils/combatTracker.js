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
    // an old campaign can hold something that isn't a list here; that is no one placed yet
    const posts = Array.isArray(storedPosts) ? storedPosts : [];

    const known = new Set(entities.map(entity => entity.id));
    const existing = new Set(posts.map(post => post.id));
    const survivors = posts.filter(post => known.has(post.id));

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
    if (additions.length === 0 && !moved && !positioned.changed && survivors.length === posts.length && Array.isArray(storedPosts)) return null;
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
    const posts = Array.isArray(storedPosts) ? storedPosts : [];
    const mine = new Set(entities.map(entity => entity.id));
    const existing = new Set(posts.map(post => post.id));

    const additions = entities
        .filter(entity => !existing.has(entity.id))
        .map((entity, offset) => ({ id: entity.id, title: entity.title ?? '', content: '', status: zoneNames[0], index: posts.length + offset }));
    const all = [...posts, ...additions];

    const placed = rects ? placeTokens(all, rects).posts : all;
    const next = placed.map((post, i) => (mine.has(post.id) ? post : all[i]));
    const changed = next.some((post, i) => post !== all[i]) || additions.length > 0 || !Array.isArray(storedPosts);
    return changed ? next : null;
}

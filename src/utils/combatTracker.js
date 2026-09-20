// Keeping the campaign's combat_tracker (who is in the fight, and which zone each
// is in) in step with who is actually in the fight.

// With no map selected there are no zones, so everyone shares this one column.
export const NO_MAP_ZONE = 'Combatants';

// The tracker as it should be, or null when it is already right. `zoneNames` are
// the zones to place people in (none: nothing is done).
//   - anyone no longer in the fight is taken out,
//   - anyone new goes in the first zone,
//   - anyone whose zone isn't among `zoneNames` any more (another map was chosen,
//     or none) moves to the first zone; everyone else keeps their place.
export function syncCombatTracker(storedPosts, entities, zoneNames) {
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

    if (additions.length === 0 && !moved && survivors.length === posts.length && Array.isArray(storedPosts)) return null;
    return [...homed, ...additions];
}

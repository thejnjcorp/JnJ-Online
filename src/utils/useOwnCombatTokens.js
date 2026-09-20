import { useEffect, useMemo } from 'react';
import { subscribeParty, updateCombatTracker } from './party';
import { addToTracker } from './combatTracker';
import { zoneRects } from './mapTokens';

// Puts a player's own characters on the combat tracker - on the active map's first
// zone, with a token to move - as soon as they open one of their characters, rather
// than only once the director next opens the Director's Page (which is what puts
// everyone else there). It only ever adds the player's own characters, and only
// while a map is active; the director's sync remains what takes people out and
// tidies the rest.
export function useOwnCombatTokens({ campaignId, activeMap, entities, userId }) {
    const own = useMemo(
        () => entities.filter(entity => entity.kind === 'player' && Boolean(userId) && Boolean(entity.ownerIds?.includes(userId))),
        [entities, userId]
    );
    // The map doc is handed back afresh by every write to it; only a zone that
    // really changed should re-run this.
    const zonesKey = (activeMap?.zones ?? []).map(zone => [zone.name, zone.x, zone.y, zone.width, zone.height].join('|')).join(';');
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const zones = useMemo(() => activeMap?.zones ?? [], [zonesKey]);
    const hasMap = Boolean(activeMap);

    useEffect(() => {
        if (!campaignId || !hasMap || own.length === 0) return undefined;
        const zoneNames = zones.map(zone => zone.name);
        const rects = zoneRects(zones);
        return subscribeParty(campaignId, ({ party, loaded, error }) => {
            if (!loaded || error || !addToTracker(party?.combat_tracker, own, zoneNames, rects)) return;
            updateCombatTracker(campaignId, current => addToTracker(current, own, zoneNames, rects))
                .catch(error => console.log("Couldn't put your character on the combat tracker: " + error));
        });
    }, [campaignId, hasMap, zones, own]);
}

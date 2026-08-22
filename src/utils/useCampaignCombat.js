import { useEffect, useMemo, useState } from 'react';
import { collection, documentId, onSnapshot, query, where } from 'firebase/firestore';
import { db } from './firebase';

// Shared between DirectorsPage and CharacterMainTab so both views of a
// campaign's combat resolve the same active map from the same listener setup.
export function useCampaignMaps(campaignInfo) {
    const [maps, setMaps] = useState([]);
    const mapIds = campaignInfo.maps ?? [];
    const mapIdsKey = mapIds.join(',');

    useEffect(() => {
        if (mapIds.length === 0) {
            setMaps([]);
            return;
        }
        const mapsQuery = query(collection(db, "maps"), where(documentId(), "in", mapIds));
        const unsubscribe = onSnapshot(mapsQuery, { includeMetadataChanges: true }, (querySnapshot) => {
            setMaps(querySnapshot.docs.map(doc => ({ map_id: doc.id, ...doc.data() })));
        });
        return () => unsubscribe();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mapIdsKey]);

    const activeMap = useMemo(
        () => maps.find((map) => map.map_id === campaignInfo.active_map),
        [maps, campaignInfo.active_map]
    );

    return { maps, activeMap };
}

// The full campaign roster (player characters + NPCs) that a combat map's
// zones sync against. Both DirectorsPage and CharacterMainTab need this same
// full list - a partial list here would make the map view delete other
// entities' combat_tracker entries as "no longer present".
export function useCombatEntities(characterList, campaignInfo) {
    return useMemo(() => [
        ...characterList.map((character) => ({ id: "character:" + character.character_id, title: character.character_name })),
        ...(campaignInfo.ally_combat_npc_list ?? []).map((npc) => ({ id: "npc:" + npc.id, title: npc.enemy_name })),
        ...(campaignInfo.enemy_list ?? []).map((npc) => ({ id: "npc:" + npc.id, title: npc.enemy_name })),
        ...(campaignInfo.neutral_combat_npc_list ?? []).map((npc) => ({ id: "npc:" + npc.id, title: npc.enemy_name })),
    ], [characterList, campaignInfo.ally_combat_npc_list, campaignInfo.enemy_list, campaignInfo.neutral_combat_npc_list]);
}

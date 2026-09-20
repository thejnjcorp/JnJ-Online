import { useState, useEffect, useMemo } from "react";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useMapDrawing } from "../useMapDrawing";
import { NO_MAP_ZONE, syncCombatTracker } from "../combatTracker";
import { MapDrawingLayer } from "../../components/MapDrawingLayer";
import { MapDrawingToolbar } from "../../components/MapDrawingToolbar";
import { Post, PostListContentAbstract } from "./Post.ts";
import "../../styles/CombatMap.scss";

const combatMapClassName = {
    postColumn: "CombatMap-zone",
    postColumnHeader: "CombatMap-zone-header",
    postColumnBody: "CombatMap-zone-body",
    postCardTitle: "CombatMap-tile-title",
    postCardContent: "CombatMap-tile-content",
    postCardBox: "CombatMap-tile-box",
};

export function PostListContentCombatMap({ campaignId, activeMap, entities = [], userId = undefined, noMap = false, noActiveMapMessage = "No active map selected. Set one from the Maps tab." }) {
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);

    const docQuery = useMemo(() => doc(db, "campaigns", campaignId), [campaignId]);
    // Every write to the map doc (a drawn stroke, say) hands back a fresh activeMap
    // object with a fresh zones array. PostListContentAbstract re-measures the
    // image whenever zoneLayout changes identity - and the <img> never reloads to
    // report its size again - so the zones must only change when they really do.
    // (Compared field by field: Firestore doesn't return a map's keys in the same
    // order every time, so a JSON string of the zones isn't a stable key.)
    const zonesKey = (activeMap?.zones ?? []).map((zone) => [zone.name, zone.x, zone.y, zone.width, zone.height].join("|")).join(";");
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const zones = useMemo(() => activeMap?.zones ?? [], [zonesKey]);
    const zoneNames = useMemo(() => zones.map((zone) => zone.name), [zones]);
    // The zones combatants are placed in: the map's, or - when the director has chosen
    // no map (`noMap`; never guessed from a map that is merely still loading) - one
    // shared column, so the tracker still works without a map.
    const syncZones = useMemo(() => (activeMap ? zoneNames : (noMap ? [NO_MAP_ZONE] : [])), [activeMap, zoneNames, noMap]);
    // What the director has drawn on the map (shown to everyone), and their tools for adding to it.
    const drawing = useMapDrawing(activeMap, userId);

    useEffect(() => {
        const unsubscribe = onSnapshot(docQuery, (docSnap) => {
            if (docSnap.metadata.hasPendingWrites || loading) {
                setPosts((docSnap.data()?.combat_tracker as unknown as Post[]) ?? []);
                setLoading(false);
            }
        });

        return () => unsubscribe();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [docQuery]);

    // keep combat_tracker in sync with who's actually in the fight, without
    // disturbing the zone/position of entities that are still present
    useEffect(() => {
        if (loading) return;
        const next = syncCombatTracker(posts, entities, syncZones);
        if (next) Promise.resolve(updateDoc(docQuery, { combat_tracker: next })).catch((error) => console.log("Couldn't update the combat tracker: " + error));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [entities, syncZones, loading]);

    const usePosts = () => ({ posts, loading });

    const updatePosts = (updatedPosts: Post[]) => {
        updateDoc(docQuery, { combat_tracker: updatedPosts });
    };

    if (!activeMap) {
        return <div className="CombatMap-no-active-map">{noActiveMapMessage}</div>;
    }

    return <>
        {drawing.canDraw && <MapDrawingToolbar drawing={drawing}/>}
        <PostListContentAbstract
            inputStatuses={zoneNames}
            usePosts={usePosts}
            updatePosts={updatePosts}
            backgroundImage={activeMap.link}
            zoneLayout={zones}
            className={combatMapClassName}
            overlay={({ width, height }) => <MapDrawingLayer
                strokes={drawing.strokes}
                aspect={height / width}
                tool={drawing.drawing ? drawing.tool : null}
                color={drawing.color}
                size={drawing.size}
                blocked={drawing.full}
                onStroke={drawing.addStroke}
                onErase={drawing.eraseStrokes}
            />}
        />
    </>;
}

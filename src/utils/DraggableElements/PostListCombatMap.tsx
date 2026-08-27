import { useState, useEffect, useMemo } from "react";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
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

export function PostListContentCombatMap({ campaignId, activeMap, entities = [], noActiveMapMessage = "No active map selected. Set one from the Maps tab." }) {
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);

    const docQuery = useMemo(() => doc(db, "campaigns", campaignId), [campaignId]);
    const zones = useMemo(() => activeMap?.zones ?? [], [activeMap]);
    const zoneNames = useMemo(() => zones.map((zone) => zone.name), [zones]);

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
        if (loading || zoneNames.length === 0) return;

        const knownIds = new Set(entities.map((entity) => entity.id));
        const existingIds = new Set(posts.map((post) => post.id));
        const survivors = posts.filter((post) => knownIds.has(post.id));
        const additions = entities
            .filter((entity) => !existingIds.has(entity.id))
            .map((entity, offset) => ({
                id: entity.id,
                title: entity.title,
                content: "",
                status: zoneNames[0],
                index: survivors.length + offset,
            }));

        if (additions.length > 0 || survivors.length !== posts.length) {
            updateDoc(docQuery, { combat_tracker: [...survivors, ...additions] });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [entities, zoneNames, loading]);

    const usePosts = () => ({ posts, loading });

    const updatePosts = (updatedPosts: Post[]) => {
        updateDoc(docQuery, { combat_tracker: updatedPosts });
    };

    if (!activeMap) {
        return <div className="CombatMap-no-active-map">{noActiveMapMessage}</div>;
    }

    return <PostListContentAbstract
        inputStatuses={zoneNames}
        usePosts={usePosts}
        updatePosts={updatePosts}
        backgroundImage={activeMap.link}
        zoneLayout={zones}
        className={combatMapClassName}
    />;
}

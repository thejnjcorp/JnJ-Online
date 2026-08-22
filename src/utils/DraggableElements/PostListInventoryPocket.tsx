import { useState, useEffect, useMemo } from "react";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { Post, PostListContentAbstract } from "./Post.ts";

export function PostListContentInventoryPocket({ inputStatuses, characterId, className = {} }) {
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);

    const docQuery = useMemo(() => doc(db, "characters", characterId), [characterId]);

    useEffect(() => {
        // eslint-disable-next-line
        const unsubscribe = onSnapshot(docQuery, (docSnap) => {
            if (docSnap.metadata.hasPendingWrites || loading) {
                setPosts((docSnap.data()?.inventory_pocket as unknown as Post[]) ?? []);
                setLoading(false);
            }
        });

        return () => unsubscribe();
        // eslint-disable-next-line
    }, [docQuery]);

    const useCombatTrackerPosts = () => {
        return { posts, loading };
    }

    const updateCombatTrackerPosts = (updatedPosts: Post[]) => {
        updateDoc(docQuery, {
            inventory_pocket: updatedPosts
        });
    }

    return <PostListContentAbstract
        inputStatuses={inputStatuses}
        usePosts={useCombatTrackerPosts}
        updatePosts={updateCombatTrackerPosts}
        columnFormat={false}
        className={className}
    />
}
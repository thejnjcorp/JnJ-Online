import { useState, useEffect, useMemo } from "react";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { Post, PostListContentAbstract } from "./Post.ts";
import { InventoryCard, InventoryContext } from "./InventoryCard.tsx";

// A character's pocket (`inventory_pocket`): one slot beside the backpack, for what
// they keep to hand. Entries are the same as the backpack's (see PostListInventory).
export function PostListContentInventoryPocket({ inputStatuses, characterId, className = {}, campaignId = undefined, canEdit = false, userId = undefined }: {
    inputStatuses: unknown; characterId: string; className?: object; campaignId?: string; canEdit?: boolean; userId?: string;
}) {
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);

    const docQuery = useMemo(() => doc(db, "characters", characterId), [characterId]);

    useEffect(() => {
        const unsubscribe = onSnapshot(docQuery, (docSnap) => {
            setPosts((docSnap.data()?.inventory_pocket as unknown as Post[]) ?? []);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [docQuery]);

    const usePosts = () => ({ posts, loading });

    const updatePosts = (updatedPosts: Post[]) => {
        updateDoc(docQuery, { inventory_pocket: updatedPosts });
    };

    const context = useMemo(() => ({ characterId, canEdit, campaignId, userId }), [characterId, canEdit, campaignId, userId]);

    return <InventoryContext.Provider value={context}>
        <PostListContentAbstract
            inputStatuses={inputStatuses}
            usePosts={usePosts}
            updatePosts={updatePosts}
            columnFormat={false}
            className={className}
            PostCardComponent={InventoryCard}
            readOnly={!canEdit}
        />
    </InventoryContext.Provider>;
}

import { useState, useEffect, useMemo } from "react";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { Post, PostListContentAbstract } from "./Post.ts";
import { InventoryCard, InventoryContext } from "./InventoryCard.tsx";
import '../../styles/PostCardInventoryDefaults.scss';

// A character's inventory (`inventory` on the character doc) as the slot grid of the
// character sheet: entries dragged from slot to slot, each an item from the item
// database with a quantity (see inventory.js and InventoryCard.tsx). Every change to
// the doc is shown, whoever made it - a trade with another player, a director giving
// something - not only the ones made here.
export function PostListContentInventory({ inputStatuses, characterId, className = {}, campaignId = undefined, canEdit = false, userId = undefined }: {
    inputStatuses: unknown; characterId: string; className?: object; campaignId?: string; canEdit?: boolean; userId?: string;
    // no longer used: trading is done on the party page
    campaignCharacterList?: unknown[];
}) {
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);

    const docQuery = useMemo(() => doc(db, "characters", characterId), [characterId]);

    useEffect(() => {
        const unsubscribe = onSnapshot(docQuery, (docSnap) => {
            setPosts((docSnap.data()?.inventory as unknown as Post[]) ?? []);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [docQuery]);

    const usePosts = () => ({ posts, loading });

    const updatePosts = (updatedPosts: Post[]) => {
        updateDoc(docQuery, { inventory: updatedPosts });
    };

    const context = useMemo(() => ({ characterId, canEdit, campaignId, userId }), [characterId, canEdit, campaignId, userId]);

    return <InventoryContext.Provider value={context}>
        <PostListContentAbstract
            inputStatuses={inputStatuses}
            usePosts={usePosts}
            updatePosts={updatePosts}
            grid={true}
            swappableMode={true}
            className={className}
            PostCardComponent={InventoryCard}
            readOnly={!canEdit}
        />
    </InventoryContext.Provider>;
}

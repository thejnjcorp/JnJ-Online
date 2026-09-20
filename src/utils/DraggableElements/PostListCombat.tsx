import { useState, useEffect } from "react";
import { subscribeParty, updateCombatTracker } from "../party";
import { applyLineMove } from "../mapTokens";
import { Post, PostListContentAbstract } from "./Post.ts";

// The combat tracker lives on the campaign's party doc (utils/party.js). `readOnly`
// lists it without letting anyone drag people between zones; `canMovePost` lets only
// some be dragged (a player, their own characters). Dragging someone into another
// zone puts their token in the middle of that zone - or the next free spot in it -
// on the map, given the map's zones as `rects` (see applyLineMove).
export function PostListContentCombat({ inputStatuses, campaignId, className, PostCardComponent, readOnly = false, canMovePost = undefined, rects = null }) {
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);

    // Every change is applied, whoever made it: a token dragged to another zone on
    // the map moves that combatant in this list too.
    useEffect(() => subscribeParty(campaignId, ({ party }) => {
        setPosts((party.combat_tracker as unknown as Post[]) ?? []);
        setLoading(false);
    }), [campaignId]);

    const useCombatTrackerPosts = () => {
        return { posts, loading };
    }

    const updateCombatTrackerPosts = (updatedPosts: Post[]) => {
        updateCombatTracker(campaignId, (current) => applyLineMove(current, updatedPosts, rects)).catch((error) => alert("Couldn't move them: " + error));
    }

    return <PostListContentAbstract
        inputStatuses={inputStatuses}
        usePosts={useCombatTrackerPosts}
        updatePosts={updateCombatTrackerPosts}
        className={className}
        PostCardComponent={PostCardComponent}
        readOnly={readOnly}
        canMovePost={canMovePost}
    />
}
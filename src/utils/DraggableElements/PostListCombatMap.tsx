import { useState, useEffect, useMemo, useRef } from "react";
import { subscribeParty, updateCombatTracker } from "../party";
import { useMapDrawing } from "../useMapDrawing";
import { NO_MAP_ZONE, syncCombatTracker } from "../combatTracker";
import { moveToken, round, settlePending, withPending, zoneRects } from "../mapTokens";
import { MapDrawingLayer } from "../../components/MapDrawingLayer";
import { MapDrawingToolbar } from "../../components/MapDrawingToolbar";
import { MapTokens } from "../../components/MapTokens";
import { Post, PostListContentAbstract } from "./Post.ts";
import "../../styles/CombatMap.scss";

const NO_POSTS: Post[] = [];

// How long a dropped token is held at its new spot waiting for the tracker to show it.
type Spot = { x: number; y: number };
type PendingDrop = { to: Spot; from: Spot | null; skipped: Spot[] };

const PENDING_DROP_MS = 8000;

const combatMapClassName = {
    postColumn: "CombatMap-zone",
    postColumnHeader: "CombatMap-zone-header",
    postColumnBody: "CombatMap-zone-body",
    postCardTitle: "CombatMap-tile-title",
    postCardContent: "CombatMap-tile-content",
    postCardBox: "CombatMap-tile-box",
};

export function PostListContentCombatMap({ campaignId, activeMap, entities = [], userId = undefined, canEdit = false, noMap = false, noActiveMapMessage = "No active map selected. Set one from the Maps tab." }) {
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    // Tokens just dropped that the tracker hasn't caught up with yet (see settlePending).
    const [pending, setPending] = useState<Record<string, PendingDrop>>({});
    const pendingRef = useRef(pending);
    pendingRef.current = pending;
    const dropTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

    // The combat tracker lives on the campaign's party doc, which everyone in the
    // campaign can write (see utils/party.js) - that is what lets a player move their
    // own token.
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

    // Every change to the tracker is applied, whoever made it, so a token moved by
    // anyone moves on everyone's map.
    useEffect(() => subscribeParty(campaignId, ({ party }) => {
        setPosts((party.combat_tracker as unknown as Post[]) ?? []);
        setLoading(false);
    }), [campaignId]);

    // A drop is finished once the tracker shows it (or something newer).
    useEffect(() => {
        if (!Array.isArray(posts)) return;
        setPending((current) => settlePending(current, posts));
    }, [posts]);
    useEffect(() => () => Object.values(dropTimers.current).forEach(clearTimeout), []);

    const rects = useMemo(() => zoneRects(zones), [zones]);

    // Keep the tracker in step with who's actually in the fight - and give every
    // token a place in its zone - without disturbing anyone who is already placed.
    // Only a director does this (everyone else just watches and moves their own
    // token); it settles, so it doesn't write again once the tracker is right. What
    // is written is worked out again from the tracker as it is by then, in a
    // transaction, so a player's move in the meantime isn't lost.
    useEffect(() => {
        if (loading || !canEdit) return;
        if (!syncCombatTracker(posts, entities, syncZones, activeMap ? rects : null)) return;
        updateCombatTracker(campaignId, (current) => syncCombatTracker(current, entities, syncZones, activeMap ? rects : null))
            .catch((error) => console.log("Couldn't update the combat tracker: " + error));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [posts, entities, syncZones, loading, canEdit]);

    // The tokens: everyone in the fight who has been given a place on the map.
    const tokens = useMemo(() => {
        if (!activeMap || !Array.isArray(posts)) return [];
        const byId = new Map(entities.map((entity) => [entity.id, entity]));
        return posts
            .filter((post) => byId.has(post.id) && Number.isFinite(post.x) && Number.isFinite(post.y))
            .map((post) => withPending(post, pending))
            .map((post) => {
                const entity = byId.get(post.id);
                // a director moves anyone's token; a player, their own character's
                const movable = !drawing.drawing && (canEdit || (entity.kind === "player" && Boolean(userId) && Boolean(entity.ownerIds?.includes(userId))));
                return { id: post.id, title: entity.title || post.title, kind: entity.kind, image: entity.image, x: post.x, y: post.y, movable };
            });
    }, [activeMap, posts, entities, pending, canEdit, userId, drawing.drawing]);

    // The token stays where it was dropped while the move is saved, and until the
    // tracker shows it there (a transaction isn't reflected locally until the server
    // has confirmed it) - so it doesn't jump back to its old spot and forward again.
    // If the move can't be saved it goes back; and if the tracker never shows it
    // (someone else's change crossed with it) it is let go after a while.
    const handleMove = (id: string, point: { x: number; y: number }, zone: string) => {
        const before = Array.isArray(posts) ? posts.find((post) => post.id === id) : undefined;
        const earlier = pendingRef.current[id];
        const drop = {
            to: { x: round(point.x), y: round(point.y) },
            from: earlier ? earlier.from : before && Number.isFinite(before.x) && Number.isFinite(before.y) ? { x: before.x, y: before.y } : null,
            skipped: earlier ? [...earlier.skipped, earlier.to] : [],
        };
        const letGo = () => setPending((current) => {
            if (current[id] !== drop) return current;
            const { [id]: _done, ...rest } = current;
            return rest;
        });
        clearTimeout(dropTimers.current[id]);
        dropTimers.current[id] = setTimeout(letGo, PENDING_DROP_MS);
        pendingRef.current = { ...pendingRef.current, [id]: drop };
        setPending((current) => ({ ...current, [id]: drop }));
        updateCombatTracker(campaignId, (current) => moveToken(current, id, point, zone))
            .catch((error) => {
                letGo();
                alert("Couldn't move the token: " + error);
            });
    };

    // The zones' cards are gone from the map - each combatant is a token instead - so
    // the map is given no posts to list; the line view still lists them by zone.
    const usePosts = () => ({ posts: NO_POSTS, loading });

    // nothing is dragged between the map's (empty) zone lists
    const updatePosts = () => {};

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
            overlay={({ width, height }) => <>
                <MapDrawingLayer
                    strokes={drawing.strokes}
                    aspect={height / width}
                    tool={drawing.drawing ? drawing.tool : null}
                    color={drawing.color}
                    size={drawing.size}
                    blocked={drawing.full}
                    onStroke={drawing.addStroke}
                    onErase={drawing.eraseStrokes}
                />
                <MapTokens tokens={tokens} rects={rects} aspect={height / width} onMove={handleMove}/>
            </>}
        />
    </>;
}

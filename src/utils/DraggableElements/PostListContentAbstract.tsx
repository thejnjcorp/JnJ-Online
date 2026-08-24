import { DragDropContext, OnDragEndResponder, OnDragStartResponder } from "@hello-pangea/dnd";
import { useEffect, useMemo, useState } from "react";
import type { Post } from "./Post.ts";
import type { Status } from "./statuses.ts";
import { PostsByStatus, getPostsByStatus } from "./statuses.ts";
import { PostColumn, PostCardComponentType } from "./PostColumn.tsx";

// zones are authored in MapRenderer against an image rendered at this width
const MAP_REFERENCE_WIDTH = 500;

// A stable reference (not a fresh [] literal every render) so the
// [unorderedPosts] effect dependency below only actually changes when real
// data arrives, not on every render while a usePosts hook is still loading.
const EMPTY_POSTS: Post[] = [];

export const PostListContentAbstract = ({ inputStatuses, usePosts, updatePosts, grid=false, columnFormat=true, swappableMode=false, className={}, PostCardComponent, backgroundImage, zoneLayout }: {
  inputStatuses,
  usePosts,
  updatePosts,
  grid?: boolean,
  columnFormat?: boolean,
  swappableMode?: boolean,
  className?,
  PostCardComponent?: PostCardComponentType,
  backgroundImage?: string,
  zoneLayout?: { name: string; x: number; y: number; width: number; height: number }[]
}) => {
  const { posts: rawPosts, loading: isLoading } = usePosts();
  // A usePosts producer that reads a Firestore field directly (rather than
  // via the CharacterPageLayout.json-defaulted merge) can hand back whatever
  // shape happens to be stored there - e.g. the "Orto" campaign's
  // combat_tracker is a legacy { zones: [...] } object, not a Post[] array.
  // `?? []` alone only catches a missing field, not a wrong-shaped one, so
  // this needs an actual type check to keep every .map/.forEach below safe.
  const unorderedPosts: Post[] = Array.isArray(rawPosts) ? rawPosts : EMPTY_POSTS;

  const foundStatuses: Status[] = Array.from(
    new Set(unorderedPosts.map(post => post.status))
  );

  const flatInputStatuses: Status[] = useMemo(() => {
    if (!inputStatuses) return [];
    if (Array.isArray(inputStatuses[0])) {
      return (inputStatuses as Status[][]).flat();
    } else {
      return inputStatuses as Status[];
    }
  }, [inputStatuses]);

  const statuses: Status[] = useMemo(() => {
    return (
      foundStatuses.concat(
        flatInputStatuses.filter((status) => !foundStatuses.includes(status))
      )
    ).sort((a, b) => (a > b ? 1 : -1));
  }, [foundStatuses, flatInputStatuses]);

  const gridStatuses: Status[][] = useMemo(() => {
    if (!grid) return [[]];
    if (Array.isArray(inputStatuses)) {
      return Array.isArray(inputStatuses[0])
        ? inputStatuses as Status[][]
        : [inputStatuses as Status[]];
    }
    return [[]];
  }, [inputStatuses, grid]);

  const [postsByStatus, setPostsByStatus] = useState<PostsByStatus>(
    getPostsByStatus(unorderedPosts, statuses)
  );

  const [draggingId, setDraggingId] = useState<string | null>(null);

  // Plain useRef doesn't work for either of these: this component returns
  // null while isLoading (a check that necessarily comes after all hooks are
  // declared), so on the render(s) before that resolves, these DOM nodes
  // don't exist yet. Effects with a useRef.current guard silently no-op on
  // that first pass and - since [backgroundImage, zoneLayout] hasn't changed
  // by the time the real content mounts - never get a reason to re-run and
  // pick up the now-available node. Callback refs (via useState) turn "the
  // node became available" into a dependency an effect can actually react to.
  const [mapContainerEl, setMapContainerEl] = useState<HTMLDivElement | null>(null);
  // the image's rendered height at MAP_REFERENCE_WIDTH, derived from its natural
  // aspect ratio once loaded. Zones are then positioned in plain CSS percent
  // (of MAP_REFERENCE_WIDTH / referenceHeight) so the browser scales everything
  // - image and zones alike - together, with no JS remeasuring needed
  const [referenceHeight, setReferenceHeight] = useState<number | null>(null);
  // CSS's max-width/max-height + width/height:auto doesn't reliably fit an
  // image to both dimensions of its box at once across browsers, so the
  // rendered size is computed explicitly instead: given the image's natural
  // aspect ratio and the actual available box (from a ResizeObserver on the
  // container), pick whichever of width- or height-constrained sizing is
  // smaller. Applied as an explicit pixel size to both the image and its
  // position:relative wrapper, so the zone percentages below stay aligned to
  // exactly what's visible (a CSS object-fit would letterbox the image
  // *inside* its box instead, throwing that alignment off).
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [containerSize, setContainerSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    if (!backgroundImage || !zoneLayout) return;
    setReferenceHeight(null);
    setNaturalSize(null);
  }, [backgroundImage, zoneLayout]);

  // naturalSize/referenceHeight are otherwise set here, via the native `load`
  // event - reliable regardless of cache state, since it fires once per <img>
  // element rather than once per URL, and doesn't depend on refs being ready.
  const handleMapImageLoad: React.ReactEventHandler<HTMLImageElement> = (e) => {
    const img = e.currentTarget;
    if (img.naturalWidth > 0) {
      setReferenceHeight(MAP_REFERENCE_WIDTH * (img.naturalHeight / img.naturalWidth));
      setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
    }
  };

  useEffect(() => {
    if (!backgroundImage || !zoneLayout || !mapContainerEl) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        setContainerSize({ width, height });
      }
    });
    observer.observe(mapContainerEl);
    return () => observer.disconnect();
  }, [backgroundImage, zoneLayout, mapContainerEl]);

  const renderedSize = useMemo(() => {
    if (!naturalSize || !containerSize) return null;
    const widthConstrainedHeight = containerSize.width * (naturalSize.height / naturalSize.width);
    if (widthConstrainedHeight <= containerSize.height) {
      return { width: containerSize.width, height: widthConstrainedHeight };
    }
    return { width: containerSize.height * (naturalSize.width / naturalSize.height), height: containerSize.height };
  }, [naturalSize, containerSize]);

  useEffect(() => {
    if (unorderedPosts) {
      const newPostsByStatus = getPostsByStatus(unorderedPosts, statuses);
      setPostsByStatus(newPostsByStatus);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unorderedPosts]);

  if (isLoading) return null;

  const onDragStart: OnDragStartResponder = (start: { draggableId: string }) => {
    setDraggingId(start.draggableId);
  }

  const onDragEnd: OnDragEndResponder = (result) => {
    const { destination, source } = result;

    if (!destination) {
      return;
    }

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    const sourceStatus = source.droppableId as Post["status"];
    const destinationStatus = destination.droppableId as Post["status"];
    const sourcePost = (postsByStatus[sourceStatus] ?? [])[source.index];

    const newPostStatus = swappableMode ? 
      {
        ...postsByStatus,
        [sourceStatus]: [...(postsByStatus[destinationStatus] ?? [])],
        [destinationStatus]: postsByStatus[sourceStatus] ?? []
      } :
      updatePostStatusLocal(
        sourcePost,
        { status: sourceStatus, index: source.index },
        { status: destinationStatus, index: destination.index },
        postsByStatus
      );

    // compute local state change synchronously
    setPostsByStatus(newPostStatus);

    // update the backend asynchronously
    updatePosts(
      updateUnorderedPosts(
        unorderedPosts, 
        newPostStatus,
        { status: sourceStatus, index: source.index },
        { status: destinationStatus, index: destination.index }
      )
    );

    // reset dragging id
    setDraggingId(null);
  };

  if (backgroundImage && zoneLayout) {
    return (
      <DragDropContext onDragStart={onDragStart} onDragEnd={onDragEnd}>
        {/* flex-basis 0 (not "auto") so this fills whatever space its flex-column
            parent has left after any siblings, regardless of this element's own
            content size - the usual pattern for "take remaining space" in a flex
            column. Outside an actual flex parent (e.g. DirectorsPage's plain
            block wrapper) `flex` is simply inert, so this falls back to normal
            width-driven sizing there with no behavior change (renderedSize just
            never resolves smaller than 100% width in that case). */}
        <div ref={setMapContainerEl} style={{ width: "100%", flex: "1 1 0%", minHeight: 0, display: "flex", justifyContent: "center", alignItems: "center", overflow: "hidden" }}>
        {/* sized to exactly match the image's computed renderedSize (see above)
            so zone percentages below stay pixel-accurate. --map-scale lets
            zone/tile labels (see CombatMap.scss) size themselves relative to
            MAP_REFERENCE_WIDTH - the same reference zones are authored
            against - rather than a fixed px value that looks fine at one
            rendered size and wrong at every other */}
        <div style={renderedSize ? {
          position: "relative",
          width: renderedSize.width,
          height: renderedSize.height,
          "--map-scale": renderedSize.width / MAP_REFERENCE_WIDTH,
        } as React.CSSProperties : { position: "relative", width: "100%" }}>
          <img
            src={backgroundImage}
            alt="combat map"
            style={renderedSize ? { width: renderedSize.width, height: renderedSize.height, display: "block" } : { width: "100%", height: "auto", display: "block" }}
            onLoad={handleMapImageLoad}
          />
          {referenceHeight && zoneLayout.map((zone) => (
            <PostColumn
              status={zone.name}
              posts={postsByStatus[zone.name] ?? []}
              key={zone.name}
              position={{
                x: `${(zone.x / MAP_REFERENCE_WIDTH) * 100}%`,
                y: `${(zone.y / referenceHeight) * 100}%`,
                width: `${(zone.width / MAP_REFERENCE_WIDTH) * 100}%`,
                height: `${(zone.height / referenceHeight) * 100}%`,
              }}
              className={className || {}}
              PostCardComponent={PostCardComponent}
              overlayHeader
            />
          ))}
        </div>
        </div>
      </DragDropContext>
    );
  }

  return (
    <DragDropContext onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div style={{ display: "flex", width: "100%", height: "100%",
        flexDirection: grid ? (columnFormat ? "column" : "row") : (columnFormat ? "row" : "column") }}>
        {!grid && statuses.map((status) => (
          <PostColumn
            status={status}
            posts={postsByStatus[status] ?? []}
            key={status}
            width={"calc(100% / " + statuses.length + ")"}
            className={className || {}}
            PostCardComponent={PostCardComponent}
          />
        ))}

        {grid && gridStatuses.map((statusRow, index) => (
          <div key={index} style={{ display: "flex", flexDirection: columnFormat ? "row" : "column", width: "100%" }}>
            {statusRow.map((status) => (
              <PostColumn
                status={status}
                posts={postsByStatus[status] ?? []}
                key={status}
                width={"calc(100% / " + statusRow.length + ")"}
                className={className || {}}
                PostCardComponent={PostCardComponent}
                swappableMode={swappableMode}
                draggableId={draggingId}
              />
            ))}
          </div>
        ))}
      </div>
    </DragDropContext>
  );
};

const updatePostStatusLocal = (
  sourcePost: Post,
  source: { status: Post["status"]; index: number },
  destination: { status: Post["status"]; index: number },
  postsByStatus: PostsByStatus
) => {
  const sameColumn = source.status === destination.status;
  // Always clone columns to avoid mutating state directly
  const sourceColumn = [...(postsByStatus[source.status] ?? [])];

  if (sameColumn) {
    // Remove from source
    const [removed] = sourceColumn.splice(source.index, 1);

    // Insert into destination
    sourceColumn.splice(destination.index, 0, removed);

    // update indexes of posts in sourceColumn
    sourceColumn.forEach((post, index) => {
      post.index = index;
    });
    
    return {
      ...postsByStatus,
      [source.status]: sourceColumn
    }
  }

  // Always clone columns to avoid mutating state directly
  const destinationColumn = [...(postsByStatus[destination.status] ?? [])];

  // Remove from source
  sourceColumn.splice(source.index, 1);

  // update indexes of posts in sourceColumn
  sourceColumn.forEach((post, index) => {
    post.index = index;
  });

  // update sourcePost with new status and index
  const updatedSourcePost: Post = {
    ...sourcePost,
    status: destination.status,
    index: destination.index ?? sourceColumn.length,
  }

  // Insert into destination
  destinationColumn.splice(destination.index ?? destinationColumn.length, 0, updatedSourcePost);

  // update indexes of posts in destinationColumn
  destinationColumn.forEach((post, index) => {
    post.index = index;
  });

  return {
    ...postsByStatus,
    [source.status]: sourceColumn,
    [destination.status]: destinationColumn,
  };
};

const updateUnorderedPosts = (
        unorderedPosts: Post[],
        newPostStatus: { [x: string]: Post[]; },
        source: { status: Post["status"]; index: number },
        destination: { status: Post["status"]; index: number }
    ) => {
        const sourceColumnPosts = newPostStatus[source.status].map(post => {
            return post;
        });
        const destinationColumnPosts = newPostStatus[destination.status].map(post => {
            return post;
        });
        const postsToUpdate = sourceColumnPosts.concat(destinationColumnPosts);

        const updatedPosts = unorderedPosts.map(post => {
            const updatedPost = postsToUpdate.find(p => p.id === post.id);
            return updatedPost ? updatedPost : post;
        });

        return updatedPosts;
    }
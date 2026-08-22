import { DragDropContext, OnDragEndResponder, OnDragStartResponder } from "@hello-pangea/dnd";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Post } from "./Post.ts";
import type { Status } from "./statuses.ts";
import { PostsByStatus, getPostsByStatus } from "./statuses.ts";
import { PostColumn, PostCardComponentType } from "./PostColumn.tsx";

// zones are authored in MapRenderer against an image rendered at this width
const MAP_REFERENCE_WIDTH = 500;

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
  const { posts: unorderedPosts, loading: isLoading } = usePosts();

  const foundStatuses: Status[] = Array.from(
    new Set((unorderedPosts ?? []).map(post => post.status))
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

  const mapImageRef = useRef<HTMLImageElement | null>(null);
  // the image's rendered height at MAP_REFERENCE_WIDTH, derived from its natural
  // aspect ratio once loaded. Zones are then positioned in plain CSS percent
  // (of MAP_REFERENCE_WIDTH / referenceHeight) so the browser scales everything
  // - image and zones alike - together, with no JS remeasuring needed
  const [referenceHeight, setReferenceHeight] = useState<number | null>(null);

  useEffect(() => {
    if (!backgroundImage || !zoneLayout) return;
    setReferenceHeight(null);
    const img = mapImageRef.current;
    if (img && img.complete && img.naturalWidth > 0) {
      setReferenceHeight(MAP_REFERENCE_WIDTH * (img.naturalHeight / img.naturalWidth));
    }
  }, [backgroundImage, zoneLayout]);

  const handleMapImageLoad: React.ReactEventHandler<HTMLImageElement> = (e) => {
    const img = e.currentTarget;
    if (img.naturalWidth > 0) {
      setReferenceHeight(MAP_REFERENCE_WIDTH * (img.naturalHeight / img.naturalWidth));
    }
  };

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
        <div style={{ position: "relative", width: "100%" }}>
          <img
            ref={mapImageRef}
            src={backgroundImage}
            alt="combat map"
            style={{ width: "100%", height: "auto", display: "block" }}
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
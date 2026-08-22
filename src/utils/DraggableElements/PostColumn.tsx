import { Droppable } from "@hello-pangea/dnd";
import type { Post } from "./Post.ts";
import { PostCard } from "./PostCard.tsx";
import '../../styles/PostDefaults.scss';

export type PostCardComponentType = React.ComponentType<{
  post: Post;
  index: number;
  titleClassName: string;
  contentClassName: string;
  boxClassName: string;
  extraClassNames: string[];
}>;

export const PostColumn = ({
  status,
  posts,
  width,
  position,
  overlayHeader = false,
  className = {},
  PostCardComponent = PostCard,
  swappableMode = false,
  draggableId,
}: {
  status: Post["status"];
  posts: Post[];
  width?: string;
  position?: { x: string; y: string; width: string; height: string };
  // when true, the header renders on top of the droppable instead of pushing
  // it down - keeps the drop target's real hit-area matching its drawn box
  // exactly (used for the combat map, where that box is a hand-drawn zone)
  overlayHeader?: boolean;
  className?: {
    postColumn?: string;
    postColumnHeader?: string;
    postColumnBody?: string;
    postCardTitle?: string;
    postCardContent?: string;
    postCardBox?: string;
    extraClassNames?: string[];
  };
  PostCardComponent?: PostCardComponentType;
  swappableMode?: boolean;
  draggableId?: string | null;
}) => {
  const {
    postColumn = "PostColumn-default",
    postColumnHeader = "PostColumn-header-default",
    postColumnBody = "PostColumn-body-default",
    postCardTitle = "PostCardTitle-default",
    postCardContent = "PostCardContent-default",
    postCardBox = "PostCardBox-default",
    extraClassNames = []
  } = className;

  const wrapperStyle = position
    ? { position: "absolute" as const, left: position.x, top: position.y, width: position.width, height: position.height }
    : { width: width ?? "100%" };

  const header = <div className={postColumnHeader}>{status}</div>;

  return <div className={postColumnBody} style={wrapperStyle}>
    {!overlayHeader && header}
    <Droppable droppableId={status}>
      {(droppableProvided, snapshot) => {
        const isSourceDroppable = draggableId ? posts.some(post => String(post.id) === draggableId) : false;
        const shouldHideContent = !snapshot.isDraggingOver || (snapshot.isDraggingOver && isSourceDroppable) || !swappableMode;
        return <div
          ref={droppableProvided.innerRef}
          {...droppableProvided.droppableProps}
          className={snapshot.isDraggingOver ? `${postColumn} isDraggingOver` : postColumn}
          style={overlayHeader ? { position: "relative", height: "100%" } : undefined}
        >
          {overlayHeader && header}
          {shouldHideContent && posts.map((post, index) => (
            <PostCardComponent
              key={post.id}
              post={post}
              index={index}
              titleClassName={postCardTitle}
              contentClassName={postCardContent}
              boxClassName={postCardBox}
              extraClassNames={extraClassNames}
            />
          ))}
          {droppableProvided.placeholder}
        </div>
      }}
    </Droppable>
  </div>
};

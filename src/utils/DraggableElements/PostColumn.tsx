import { Fragment } from "react";
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
  readOnly?: boolean;
}>;

// The posts in order, with each run of posts sharing an engagement gathered into one group.
type PostGroup = { engagement: string; items: { post: Post; index: number }[] };

export function groupByEngagement(posts: Post[]): PostGroup[] {
  const groups: PostGroup[] = [];
  posts.forEach((post, index) => {
    const engagement = post.engagement || "";
    const last = groups.at(-1);
    if (engagement && last?.engagement === engagement) last.items.push({ post, index });
    else groups.push({ engagement, items: [{ post, index }] });
  });
  return groups;
}

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
  readOnly = false,
  canMovePost,
  combine = false,
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
    // the tile around people who are engaged with each other
    postEngagement?: string;
    extraClassNames?: string[];
  };
  PostCardComponent?: PostCardComponentType;
  swappableMode?: boolean;
  draggableId?: string | null;
  // the cards can be looked at but not dragged
  readOnly?: boolean;
  // when given, only the cards this says yes to can be dragged (a player moving their own character)
  canMovePost?: (post: Post) => boolean;
  // a card dropped onto another one, rather than between them, is handed to onDragEnd as a combine
  combine?: boolean;
}) => {
  const {
    postColumn = "PostColumn-default",
    postColumnHeader = "PostColumn-header-default",
    postColumnBody = "PostColumn-body-default",
    postCardTitle = "PostCardTitle-default",
    postCardContent = "PostCardContent-default",
    postCardBox = "PostCardBox-default",
    postEngagement = "PostEngagement-default",
    extraClassNames = []
  } = className;

  const wrapperStyle = position
    ? { position: "absolute" as const, left: position.x, top: position.y, width: position.width, height: position.height }
    : { width: width ?? "100%" };

  const header = <div className={postColumnHeader}>{status}</div>;

  return <div className={postColumnBody} style={wrapperStyle}>
    {!overlayHeader && header}
    <Droppable droppableId={status} isCombineEnabled={combine}>
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
          {shouldHideContent && groupByEngagement(posts).map(group => {
            const cards = group.items.map(({ post, index }) => (
              <PostCardComponent
                key={post.id}
                post={post}
                index={index}
                titleClassName={postCardTitle}
                contentClassName={postCardContent}
                boxClassName={postCardBox}
                extraClassNames={extraClassNames}
                readOnly={readOnly || (canMovePost ? !canMovePost(post) : false)}
              />
            ));
            if (!group.engagement) return <Fragment key={group.items[0].post.id}>{cards}</Fragment>;
            return <fieldset key={group.engagement} className={postEngagement} aria-label={`Engaged: ${group.items.map(({ post }) => post.title).join(", ")}`}>
              <span className="PostEngagement-label" aria-hidden="true">Engaged</span>
              {cards}
            </fieldset>;
          })}
          {droppableProvided.placeholder}
        </div>
      }}
    </Droppable>
  </div>
};

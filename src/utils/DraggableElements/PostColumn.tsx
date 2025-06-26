import { Droppable } from "@hello-pangea/dnd";

import type { Post } from "./Post.ts";
import { PostCard } from "./PostCard.tsx";

export const PostColumn = ({
  status,
  posts,
}: {
  status: Post["status"];
  posts: Post[];
}) => (
  <div
    style={{
      flex: 1,
      paddingTop: "8px",
      paddingBottom: "16px",
      background: "#eaeaee"
    }}
  >
    <div style={{ color: "#000", fontWeight: "bold" }}>
      {status}
    </div>
    <Droppable droppableId={status}>
      {(droppableProvided, snapshot) => (
        <div
          ref={droppableProvided.innerRef}
          {...droppableProvided.droppableProps}
          className={snapshot.isDraggingOver ? " isDraggingOver" : ""}
          style={{
            background: snapshot.isDraggingOver ? "#777" : "#eaeaee",
            padding: "5px",
            borderRadius: "5px",
            display: "flex",
            flexDirection: "column",
            minHeight: "100px",
            width: "300px",
          }}
        >
          {posts.map((post, index) => (
            <PostCard key={post.id} post={post} index={index} />
          ))}
          {droppableProvided.placeholder}
        </div>
      )}
    </Droppable>
  </div>
);

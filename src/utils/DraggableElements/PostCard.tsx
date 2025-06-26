import { Draggable } from "@hello-pangea/dnd";

import type { Post } from "./Post";

export const PostCard = ({ post, index }: { post: Post; index: number }) => {
  return (
    <Draggable draggableId={String(post.id)} index={index}>
      {(provided, snapshot) => (
        <div
          style={{ marginBottom: "1px" }}
          {...provided.dragHandleProps}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          ref={provided.innerRef}
        >
          <div
            style={{
              background: "#444",
              margin: "5px",
              opacity: snapshot.isDragging ? 0.9 : 1,
              transform: snapshot.isDragging ? "rotate(-2deg)" : "",
            }}
            /* elevation={snapshot.isDragging ? 3 : 1} */
          >
            <div>
              <div>
                {post.title}
              </div>
              <div>{post.content}</div>
              <div style={{ fontSize: "10px", color: "#666" }}>
                {`Index: ${post.index}`}
              </div>
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
};

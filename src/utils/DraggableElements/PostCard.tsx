import { Draggable } from "@hello-pangea/dnd";

import type { Post } from "./Post";

export const PostCard = ({ post, index, titleClassName, contentClassName, boxClassName, extraClassNames, readOnly = false}: 
  { post: Post; index: number, titleClassName: string, contentClassName: string, boxClassName: string, extraClassNames: string[], readOnly?: boolean }) => {
  return (
    <Draggable draggableId={String(post.id)} index={index} isDragDisabled={readOnly}>
      {(provided, snapshot) => (
        <div
          style={{ marginBottom: "1px" }}
          {...provided.dragHandleProps}
          {...provided.draggableProps}
          ref={provided.innerRef}
        >
          <div className={snapshot.isDragging ? `${boxClassName} isDragging` : boxClassName}>
            <div>
              <div className={titleClassName}>
                {post.title}
              </div>
              <div className={contentClassName}>
                {post.content}
              </div>
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
};

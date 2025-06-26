import { DragDropContext, OnDragEndResponder } from "@hello-pangea/dnd";
import isEqual from "lodash/isEqual";
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { Post } from "./Post.ts";
import { PostsByStatus, getPostsByStatus } from "./statuses.ts";
import { PostColumn } from "./PostColumn.tsx";
import { collection, getDocs, updateDoc, doc, query } from "firebase/firestore";
import data from "./data.json";
import { db } from "../firebase"

function useFirebasePosts() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPosts = async () => {
    setLoading(true);
    const snapshot = await getDocs(collection(db, "posts"));
    setPosts(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as unknown as Post)));
    setLoading(false);
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  return { posts, loading, refetch: () => fetchPosts() };
}

function useLocalPosts() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setPosts(data.posts as Post[]);
    setLoading(false);
  }, []);

  return { posts, loading, setLoading, refetch: () => {} };
}

export const PostListContent = ({ inputStatuses }) => {
  // const { posts: unorderedPosts, loading: isLoading, refetch } = useFirebasePosts();
  const { posts: unorderedPosts, loading: isLoading, setLoading: setIsLoading, refetch } = useLocalPosts();

  const foundStatuses = Array.from(
    new Set((unorderedPosts ?? []).map(post => post.status))
  );

  const statuses = inputStatuses !== undefined ? foundStatuses.concat(inputStatuses.filter(
    status => !foundStatuses.includes(status))) : foundStatuses;

  const [postsByStatus, setPostsByStatus] = useState<PostsByStatus>(
    getPostsByStatus(unorderedPosts, statuses)
  );

  useEffect(() => {
    if (unorderedPosts) {
      const newPostsByStatus = getPostsByStatus(unorderedPosts, statuses);
      if (!isEqual(newPostsByStatus, postsByStatus)) {
        setPostsByStatus(newPostsByStatus);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unorderedPosts]);

  /*
  const mutation = useMutation(
    async ({ source, destination }: { source: Post; destination: Post }) => {
      // Example: update the status and index of the post in Firestore
      await updateDoc(doc(db, "posts", String(source.id)), {
        status: destination.status,
        index: destination.index ?? 0,
      });
    },
    { onSettled: () => refetch() }
  );
  */
  const mutation = {
    mutateAsync: async ({}) => {},
  };


  if (isLoading) return null;

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
    const destinationPost = (postsByStatus[destinationStatus] ?? [])[destination.index] ?? {
      status: destinationStatus,
      index: undefined,
    };

    // compute local state change synchronously
    setPostsByStatus(
      updatePostStatusLocal(
        sourcePost,
        { status: sourceStatus, index: source.index },
        { status: destinationStatus, index: destination.index },
        postsByStatus
      )
    );

    // trigger the mutation to persist the changes
    mutation.mutateAsync({
      source: sourcePost,
      destination: destinationPost,
    });
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div style={{ display: "flex" }}>
        {statuses.map((status) => (
          <PostColumn
            status={status}
            posts={postsByStatus[status] ?? []}
            key={status}
          />
        ))}
      </div>
    </DragDropContext>
  );
};

const updatePostStatusLocal = (
  sourcePost: Post,
  source: { status: Post["status"]; index: number },
  destination: { status: Post["status"]; index?: number },
  postsByStatus: PostsByStatus
) => {
  // Always clone columns to avoid mutating state directly
  const sourceColumn = [...(postsByStatus[source.status] ?? [])];
  const destinationColumn = [...(postsByStatus[destination.status] ?? [])];

  // Remove from source
  sourceColumn.splice(source.index, 1);

  // Insert into destination
  destinationColumn.splice(destination.index ?? destinationColumn.length, 0, sourcePost);

  return {
    ...postsByStatus,
    [source.status]: sourceColumn,
    [destination.status]: destinationColumn,
  };
};

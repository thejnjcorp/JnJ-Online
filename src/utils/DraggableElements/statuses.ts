import type { Post } from "./Post.ts";

export type Status = string; // or a union if you want stricter typing

export type PostsByStatus = Record<Status, Post[]>;

export const getPostsByStatus = (unorderedPosts: Post[], statuses: Status[]) => {
  // Initialize all statuses as empty arrays
  const postsByStatus: PostsByStatus = statuses.reduce(
    (obj, status) => ({ ...obj, [status]: [] }),
    {} as PostsByStatus
  );
  // Fill arrays with posts
  unorderedPosts.forEach((post) => {
    if (postsByStatus[post.status]) {
      postsByStatus[post.status].push(post);
    } else {
      // If the post has a status not in statuses, add it dynamically
      postsByStatus[post.status] = [post];
    }
  });
  // Sort each column by index
  statuses.forEach((status) => {
    postsByStatus[status] = postsByStatus[status].sort(
      (a, b) => a.index - b.index
    );
  });
  return postsByStatus;
};
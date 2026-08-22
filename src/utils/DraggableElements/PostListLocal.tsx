import { useEffect, useState } from "react";
import { Post, PostListContentAbstract } from "./Post.ts";
import data from "./data.json";

function useLocalPosts() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setPosts(data.posts as Post[]);
    setLoading(false);
  }, []);

  return { posts, loading };
}

function updateLocalPosts() {
  return {};
}

export function PostListContentLocal({ inputStatuses }) {
    return PostListContentAbstract({
        inputStatuses,
        usePosts: useLocalPosts,
        updatePosts: updateLocalPosts
    });
}
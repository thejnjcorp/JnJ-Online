export * from "./statuses.ts";
export * from "./PostCard.tsx";
export * from "./PostColumn.tsx";
export * from "./PostListContent.tsx";

export interface Post {
  id: number;
  title: string;
  content: string;
  status: string;
  index: number;
}

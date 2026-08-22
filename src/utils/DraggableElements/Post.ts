export * from "./statuses.ts";
export * from "./PostCard.tsx";
export * from "./PostColumn.tsx";
export * from "./PostListContentAbstract.tsx";

export interface Post {
  id: number | string;
  title: string;
  content: string;
  status: string;
  index: number;
}

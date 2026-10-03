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
  // who the post is engaged with: everyone in the same zone with the same id is in one engagement
  engagement?: string;
}

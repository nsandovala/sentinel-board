export type CommentType = "comment" | "decision" | "system" | "agent";

export interface CardComment {
  id: string;
  cardId: string;
  author: string;
  body: string;
  type: CommentType;
  createdAt: string;
}

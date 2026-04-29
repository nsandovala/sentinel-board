export type KnowledgeCategory = "report" | "decision" | "runbook" | "note" | "postmortem";
export type KnowledgeStatus = "draft" | "published" | "archived";

export interface KnowledgeEntry {
  id: string;
  projectId?: string;
  title: string;
  slug: string;
  category: KnowledgeCategory;
  status: KnowledgeStatus;
  tags: string[];
  summary?: string;
  body: string;
  sourceTaskId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SearchCardResult {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  type: string;
  tags: string[];
}

export interface SearchResponse {
  ok: boolean;
  cards: SearchCardResult[];
  knowledge: KnowledgeEntry[];
  total: {
    cards: number;
    knowledge: number;
  };
}

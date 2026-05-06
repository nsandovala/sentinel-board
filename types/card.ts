import { CardStatus, CardType, PriorityLevel } from "./enums";

export type ChecklistItemStatus =
  | "pending"
  | "in_progress"
  | "review"
  | "blocked"
  | "done";

export interface ChecklistItem {
  id: string;
  text: string;
  status: ChecklistItemStatus;
}

export interface CodexLoopData {
  problem?: string;
  objective?: string;
  hypothesis?: string;
  solution?: string;
  validation?: string;
  nextStep?: string;
}

export interface AgentRisk {
  label: string;
  mitigation?: string;
  status?: "open" | "mitigated" | "watch";
}

export interface CardAgentMetadata {
  plan: string[];
  risks: AgentRisk[];
  validations: string[];
  done_when: string[];
  files_to_touch: string[];
  state_guardian?: string;
  qa_review?: string;
  scoring_detail?: string;
  score?: number;
  source?: string;
  agent?: string;
  externalTaskId?: string;
}

export interface FiveWhysData {
  why1?: string;
  why2?: string;
  why3?: string;
  why4?: string;
  why5?: string;
  rootCause?: string;
}

export type MoneyClassification = "core" | "quick_win" | "apuesta" | "ruido";

export interface MoneyCodeData {
  revenue: number;
  savings: number;
  automation: number;
  reuse: number;
  validation: number;
  execution: number;
  score: number;
  classification: MoneyClassification;
  rationale: string;
  /** Scoring v2 fields */
  executionClarity?: number;
  validationPath?: number;
  strategicFit?: number;
  riskControl?: number;
  /** @deprecated v1 fields kept for DB compat — ignore in new code */
  impact?: number;
  urgency?: number;
  effort?: number;
  returnValue?: number;
  strategyAlignment?: number;
  reuseValue?: number;
  validationValue?: number;
}

export interface SentinelCard {
  id: string;
  title: string;
  description?: string;
  status: CardStatus;
  type: CardType;
  priority: PriorityLevel;
  tags: string[];
  projectId: string;
  checklist: ChecklistItem[];
  codexLoop?: CodexLoopData;
  fiveWhys?: FiveWhysData;
  moneyCode?: MoneyCodeData;
  metadata?: CardAgentMetadata;
  blocked?: boolean;
  blockerReason?: string;
  createdAt?: string;
}

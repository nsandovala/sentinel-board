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
  blocked?: boolean;
  blockerReason?: string;
  createdAt?: string;
}
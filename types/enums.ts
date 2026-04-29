export type CardStatus =
  | "idea_bruta"
  | "clarificando"
  | "validando"
  | "en_proceso"
  | "desarrollo"
  | "qa"
  | "listo"
  | "produccion"
  | "archivado";

export type CardType =
  | "idea"
  | "feature"
  | "bug"
  | "task"
  | "decision"
  | "experiment"
  | "deploy"
  | "research";

export type PriorityLevel = "low" | "medium" | "high" | "critical";
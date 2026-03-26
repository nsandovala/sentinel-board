import type { CardStatus } from "@/types/enums";

export const STATUS_LABELS: Record<CardStatus, string> = {
  idea_bruta: "Idea bruta",
  clarificando: "Clarificando",
  validando: "Validando",
  en_proceso: "En proceso",
  desarrollo: "Desarrollo",
  qa: "QA",
  listo: "Listo",
  produccion: "Producción",
  archivado: "Archivado",
};

export const BOARD_STATUS_OPTIONS: { value: CardStatus; label: string }[] = (
  Object.entries(STATUS_LABELS) as [CardStatus, string][]
).map(([value, label]) => ({ value, label }));

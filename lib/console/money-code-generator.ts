import type { SentinelCard, MoneyCodeData } from "@/types/card";

const PRIORITY_IMPACT: Record<string, number> = {
  critical: 10,
  high: 8,
  medium: 5,
  low: 3,
};

const STATUS_URGENCY: Record<string, number> = {
  idea_bruta: 2,
  clarificando: 3,
  validando: 5,
  en_proceso: 7,
  desarrollo: 8,
  qa: 9,
  listo: 6,
  produccion: 4,
  archivado: 1,
};

const TYPE_RETURN: Record<string, number> = {
  feature: 8,
  bug: 7,
  task: 5,
  research: 6,
  experiment: 7,
  idea: 4,
  decision: 6,
  deploy: 9,
};

function clamp(v: number, min = 1, max = 10): number {
  return Math.max(min, Math.min(max, Math.round(v)));
}

export function generateMoneyCode(card: SentinelCard): MoneyCodeData {
  const impact = PRIORITY_IMPACT[card.priority] ?? 5;
  const urgency = STATUS_URGENCY[card.status] ?? 5;

  const total = card.checklist.length;
  const done = card.checklist.filter((c) => c.status === "done").length;
  const effort = clamp(total > 0 ? 10 - (done / total) * 7 : 5);

  const returnValue = TYPE_RETURN[card.type] ?? 5;

  const coreTagBonus = card.tags.some((t) =>
    ["core", "strategy", "revenue", "growth"].includes(t.toLowerCase()),
  )
    ? 2
    : 0;
  const strategyAlignment = clamp(5 + coreTagBonus);

  const reuseBonus = card.tags.some((t) =>
    ["lib", "sdk", "shared", "reuse", "api"].includes(t.toLowerCase()),
  )
    ? 3
    : 0;
  const reuseValue = clamp(4 + reuseBonus);

  const validationValue = clamp(
    total > 0 ? Math.round((done / total) * 10) : 3,
  );

  const raw =
    impact * 0.2 +
    urgency * 0.15 +
    (10 - effort) * 0.1 +
    returnValue * 0.2 +
    strategyAlignment * 0.15 +
    reuseValue * 0.1 +
    validationValue * 0.1;

  const score = Math.round(raw * 10);

  return {
    impact,
    urgency,
    effort,
    returnValue,
    strategyAlignment,
    reuseValue,
    validationValue,
    score,
  };
}

import { extractCardMetadata } from "./card-metadata";
import type { SentinelCard } from "@/types/card";

export interface MoneyCodeDimensions {
  revenue: number;
  savings: number;
  automation: number;
  reuse: number;
  execution: number;
  validation: number;
  strategicFit: number;
  riskControl: number;
}

export interface MoneyCodeAnalysis {
  total: number;
  dimensions: MoneyCodeDimensions;
  label: "low" | "medium" | "high" | "critical";
  explanation: string;
}

const PRIORITY_WEIGHT: Record<SentinelCard["priority"], number> = {
  low: 2,
  medium: 5,
  high: 8,
  critical: 10,
};

const TYPE_PROFILE: Record<SentinelCard["type"], Partial<MoneyCodeDimensions>> = {
  idea: { strategicFit: 7, revenue: 4, execution: 4 },
  feature: { revenue: 8, automation: 6, strategicFit: 7 },
  bug: { savings: 7, validation: 7, riskControl: 8 },
  task: { execution: 7, savings: 5, automation: 5 },
  decision: { strategicFit: 8, riskControl: 7, validation: 6 },
  experiment: { automation: 5, validation: 8, strategicFit: 6 },
  deploy: { execution: 8, validation: 7, riskControl: 8 },
  research: { reuse: 6, validation: 6, strategicFit: 7 },
};

function clamp(value: number, min = 0, max = 10): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function countTags(tags: string[], needles: string[]): number {
  return tags.filter((tag) => needles.some((needle) => tag.includes(needle))).length;
}

function explainTopDimensions(dimensions: MoneyCodeDimensions): string {
  const labels: Record<keyof MoneyCodeDimensions, string> = {
    revenue: "ingreso",
    savings: "ahorro",
    automation: "automatizacion",
    reuse: "reutilizacion",
    execution: "ejecucion",
    validation: "validacion",
    strategicFit: "alineacion estrategica",
    riskControl: "control de riesgo",
  };

  const top = Object.entries(dimensions)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([key]) => labels[key as keyof MoneyCodeDimensions]);

  return `Score ${top.length > 1 ? "alto" : "estable"} porque tiene impacto en ${top.join(", ")}.`;
}

export function calculateMoneyCode(card: SentinelCard): MoneyCodeAnalysis {
  const metadata = extractCardMetadata(card);
  const tags = (card.tags ?? []).map((tag) => tag.toLowerCase());
  const checklistTotal = card.checklist.length;
  const checklistDone = card.checklist.filter((item) => item.status === "done").length;
  const checklistReady = card.checklist.filter((item) =>
    item.status === "done" || item.status === "review",
  ).length;
  const metadataScore = Math.max(0, Math.min(100, metadata.score ?? card.moneyCode?.score ?? 0));
  const priority = PRIORITY_WEIGHT[card.priority] ?? 5;
  const typeProfile = TYPE_PROFILE[card.type] ?? {};
  const validations = metadata.validations.length;
  const doneWhen = metadata.done_when.length;
  const files = metadata.files_to_touch.length;
  const risks = metadata.risks.length;
  const mitigated = metadata.risks.filter((risk) => risk.mitigation || risk.status === "mitigated").length;
  const planDepth = metadata.plan.length;

  const revenue =
    priority * 0.45 +
    (typeProfile.revenue ?? 4) * 0.35 +
    metadataScore * 0.02 +
    countTags(tags, ["revenue", "growth", "upsell", "billing", "sales"]) * 0.7;

  const savings =
    (typeProfile.savings ?? 4) * 0.45 +
    countTags(tags, ["ops", "cost", "cleanup", "infra", "perf"]) * 1.1 +
    metadataScore * 0.015;

  const automation =
    (typeProfile.automation ?? 4) * 0.4 +
    countTags(tags, ["automation", "agent", "worker", "pipeline", "integration"]) * 1.1 +
    Math.min(planDepth, 4) * 0.8;

  const reuse =
    (typeProfile.reuse ?? 4) * 0.4 +
    countTags(tags, ["shared", "sdk", "lib", "api", "component", "template", "platform"]) * 1.1 +
    Math.min(metadata.files_to_touch.length <= 3 ? 2 : 0, 2);

  const execution =
    (typeProfile.execution ?? 5) * 0.35 +
    Math.min(planDepth, 5) * 0.9 +
    Math.min(doneWhen, 4) * 0.7 +
    (files === 0 ? 0 : Math.max(0, 2.5 - files * 0.35)) +
    (card.blocked ? -3 : 0);

  const validation =
    (typeProfile.validation ?? 4) * 0.3 +
    Math.min(validations, 5) * 1 +
    Math.min(doneWhen, 4) * 0.8 +
    (checklistTotal > 0 ? (checklistReady / checklistTotal) * 2 : 0);

  const strategicFit =
    (typeProfile.strategicFit ?? 5) * 0.35 +
    priority * 0.35 +
    metadataScore * 0.025 +
    countTags(tags, ["core", "platform", "customer", "neon", "drizzle", "next"]) * 0.6;

  const riskControl =
    (typeProfile.riskControl ?? 4) * 0.3 +
    Math.min(validations, 4) * 0.6 +
    Math.min(mitigated, 4) * 1.1 +
    (risks > 0 ? Math.max(0, 2 - (risks - mitigated) * 0.8) : 2.4) +
    (card.blocked ? -2 : 0);

  const dimensions: MoneyCodeDimensions = {
    revenue: clamp(revenue),
    savings: clamp(savings),
    automation: clamp(automation),
    reuse: clamp(reuse),
    execution: clamp(execution),
    validation: clamp(validation),
    strategicFit: clamp(strategicFit),
    riskControl: clamp(riskControl),
  };

  const total = clamp(
    (Object.values(dimensions).reduce((sum, value) => sum + value, 0) / 80) * 100,
    0,
    100,
  );

  const label =
    total >= 80 ? "critical" : total >= 60 ? "high" : total >= 40 ? "medium" : "low";

  return {
    total,
    dimensions,
    label,
    explanation: explainTopDimensions(dimensions),
  };
}

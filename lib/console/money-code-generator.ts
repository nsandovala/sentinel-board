import { calculateMoneyCode } from "@/lib/analysis/money-code";
import type { MoneyCodeData, SentinelCard } from "@/types/card";

function mapLabelToClassification(label: "low" | "medium" | "high" | "critical") {
  if (label === "critical") return "core" as const;
  if (label === "high") return "quick_win" as const;
  if (label === "medium") return "apuesta" as const;
  return "ruido" as const;
}

export function generateMoneyCode(card: SentinelCard): MoneyCodeData {
  if (card.moneyCode && card.moneyCode.score > 0) {
    return card.moneyCode;
  }

  const analysis = calculateMoneyCode(card);

  return {
    revenue: analysis.dimensions.revenue,
    savings: analysis.dimensions.savings,
    automation: analysis.dimensions.automation,
    reuse: analysis.dimensions.reuse,
    execution: analysis.dimensions.execution,
    validation: analysis.dimensions.validation,
    score: analysis.total,
    classification: mapLabelToClassification(analysis.label),
    rationale: analysis.explanation,
    executionClarity: analysis.dimensions.execution,
    validationPath: analysis.dimensions.validation,
    strategicFit: analysis.dimensions.strategicFit,
    riskControl: analysis.dimensions.riskControl,
  };
}

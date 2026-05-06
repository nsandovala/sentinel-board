import { extractCardMetadata } from "./card-metadata";
import type { CodexLoopData, SentinelCard } from "@/types/card";

function firstText(values: Array<string | undefined>): string | undefined {
  return values.find((value) => typeof value === "string" && value.trim().length > 0)?.trim();
}

function buildHypothesis(card: SentinelCard, risks: string[]): string {
  if (card.codexLoop?.hypothesis?.trim()) {
    return card.codexLoop.hypothesis.trim();
  }

  if (risks.length > 0) {
    return `Si resolvemos ${risks[0].toLowerCase()}, la card puede avanzar sin ampliar alcance.`;
  }

  return `Si ejecutamos un primer paso claro sobre "${card.title}", vamos a reducir incertidumbre y acelerar validacion.`;
}

export function deriveCodexLoop(card: SentinelCard): Required<CodexLoopData> {
  const metadata = extractCardMetadata(card);
  const plan = metadata.plan;
  const validations = metadata.validations;
  const doneWhen = metadata.done_when;
  const risks = metadata.risks.map((risk) => risk.label);
  const pendingChecklist = card.checklist.find((item) => item.status !== "done")?.text;

  const problem =
    firstText([card.codexLoop?.problem, card.description]) ??
    `La card "${card.title}" todavia no tiene una formulacion operativa del problema.`;

  const objective =
    firstText([
      card.codexLoop?.objective,
      doneWhen[0],
      metadata.state_guardian,
      `Mover "${card.title}" a un estado con validacion ejecutable.`,
    ]) ??
    `Mover "${card.title}" a un estado con validacion ejecutable.`;

  const solution =
    firstText([
      card.codexLoop?.solution,
      plan[0],
      metadata.files_to_touch[0]
        ? `Intervenir primero ${metadata.files_to_touch[0]} para crear una base operativa.`
        : undefined,
    ]) ?? "Tomar el primer item del plan y convertirlo en trabajo ejecutable.";

  const validation =
    firstText([
      card.codexLoop?.validation,
      validations[0],
      doneWhen[0],
      metadata.qa_review,
    ]) ?? "Definir criterio de validacion antes de avanzar.";

  const nextStep =
    firstText([
      card.codexLoop?.nextStep,
      pendingChecklist,
      plan[0],
      validations[0] ? `Preparar evidencia para: ${validations[0]}` : undefined,
    ]) ?? "Tomar el primer item pendiente del checklist.";

  return {
    problem,
    objective,
    hypothesis: buildHypothesis(card, risks),
    solution,
    validation,
    nextStep,
  };
}

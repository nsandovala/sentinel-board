import type { SentinelCard, CodexLoopData } from "@/types/card";

export function generateCodexLoop(card: SentinelCard): CodexLoopData {
  const checkedCount = card.checklist.filter((c) => c.status === "done").length;
  const total = card.checklist.length;
  const progress = total > 0 ? checkedCount / total : 0;

  const problem = card.description ?? `Resolver: ${card.title}`;

  const objectiveMap: Record<string, string> = {
    feature: "Entregar funcionalidad operativa",
    bug: "Corregir el error y validar fix",
    task: "Completar la tarea asignada",
    research: "Generar conclusión accionable",
    experiment: "Validar o descartar hipótesis",
    idea: "Definir viabilidad del concepto",
    decision: "Tomar decisión informada",
    deploy: "Desplegar a producción estable",
  };

  const objective = objectiveMap[card.type] ?? "Avanzar hacia producción";

  let hypothesis: string;
  if (card.type === "bug") {
    hypothesis = "El bug se origina en la lógica actual y tiene fix directo";
  } else if (card.type === "research") {
    hypothesis = "La investigación revelará un patrón aplicable";
  } else {
    hypothesis = `Implementar ${card.title.toLowerCase()} es viable en el sprint actual`;
  }

  let solution: string | undefined;
  if (progress > 0.3) {
    solution = `Avance ${Math.round(progress * 100)}% — ${checkedCount}/${total} subtareas completadas`;
  }

  let validation: string | undefined;
  if (progress >= 0.8) {
    validation = "La mayoría de subtareas están completas — listo para revisión";
  } else if (card.status === "qa" || card.status === "listo") {
    validation = "En validación o ya validado";
  }

  const nextStep = card.blocked
    ? `Desbloquear: ${card.blockerReason ?? "pendiente de resolución"}`
    : progress < 0.5
      ? "Avanzar subtareas pendientes"
      : progress < 1
        ? "Completar subtareas restantes y revisar"
        : "Mover a siguiente fase";

  return { problem, objective, hypothesis, solution, validation, nextStep };
}

import { extractCardMetadata, hasUnmitigatedRisks } from "./card-metadata";
import { calculateMoneyCode } from "./money-code";
import type { SentinelCard } from "@/types/card";

export interface SuggestedAction {
  label: string;
  command: string;
  reason: string;
}

const STATUS_ORDER: Record<SentinelCard["status"], number> = {
  idea_bruta: 0,
  clarificando: 1,
  validando: 2,
  en_proceso: 3,
  desarrollo: 4,
  qa: 5,
  listo: 6,
  produccion: 7,
  archivado: 8,
};

function quoteTitle(title: string): string {
  return `"${title}"`;
}

export function suggestNextAction(card: SentinelCard): SuggestedAction {
  const metadata = extractCardMetadata(card);
  const moneyCode = calculateMoneyCode(card);
  const hasPlan = metadata.plan.length > 0;
  const hasChecklist = card.checklist.length > 0;
  const hasValidations = metadata.validations.length > 0;
  const statusRank = STATUS_ORDER[card.status] ?? 0;

  if (card.blocked) {
    return {
      label: "Resolver blocker",
      command: `focus ${quoteTitle(card.title)}`,
      reason: card.blockerReason
        ? `La card esta bloqueada por: ${card.blockerReason}.`
        : "La card esta bloqueada y necesita una resolucion humana antes de seguir.",
    };
  }

  if (hasUnmitigatedRisks(metadata)) {
    return {
      label: "Revisar riesgos",
      command: `focus ${quoteTitle(card.title)}`,
      reason: "Hay riesgos sin mitigacion explicita y conviene cerrarlos antes de ejecutar mas trabajo.",
    };
  }

  if (card.status === "idea_bruta" && hasPlan) {
    return {
      label: "Avanzar a clarificando",
      command: `move ${quoteTitle(card.title)} to clarificando`,
      reason: "La card ya tiene plan y validaciones minimas para dejar de operar como idea bruta.",
    };
  }

  if (card.status === "clarificando" && hasChecklist) {
    return {
      label: "Iniciar foco",
      command: `focus ${quoteTitle(card.title)}`,
      reason: "Ya existe checklist accionable; conviene abrir foco sobre la card y ejecutar el primer paso.",
    };
  }

  if (card.status === "validando" && hasValidations) {
    return {
      label: "Pasar a en proceso",
      command: `move ${quoteTitle(card.title)} to en_proceso`,
      reason: "La card ya tiene validaciones definidas y puede reingresar a ejecucion con criterio claro.",
    };
  }

  if ((moneyCode.label === "high" || moneyCode.label === "critical") && statusRank <= 1) {
    return {
      label: "Priorizar ahora",
      command: `move ${quoteTitle(card.title)} to clarificando`,
      reason: "El score operativo es alto y la card sigue demasiado atras en el flujo.",
    };
  }

  if (hasValidations) {
    return {
      label: "Preparar validacion",
      command: `score ${quoteTitle(card.title)}`,
      reason: "Conviene revisar score y criterios de validacion antes de mover la card al siguiente estado.",
    };
  }

  return {
    label: "Abrir foco en la card",
    command: `focus ${quoteTitle(card.title)}`,
    reason: "La siguiente accion mas util es abrir la card, revisar contexto y ejecutar el siguiente paso disponible.",
  };
}

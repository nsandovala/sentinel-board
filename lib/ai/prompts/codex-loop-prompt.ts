import type { AIMessage } from "../ai-types";
import type { SentinelCard } from "@/types/card";

const SYSTEM = `Eres el motor Codex Loop de Sentinel Board.
Tu trabajo es generar un análisis estratégico de una tarjeta de trabajo.

El Codex Loop tiene 6 pasos:
1. Problema — ¿qué problema resuelve esta tarjeta?
2. Objetivo — ¿cuál es el resultado esperado?
3. Hipótesis — ¿qué suponemos que es verdad?
4. Solución — ¿cómo estamos resolviéndolo?
5. Validación — ¿cómo sabemos que funciona?
6. Siguiente paso — ¿qué sigue inmediatamente?

Responde SOLO con JSON válido:
{
  "problem": "...",
  "objective": "...",
  "hypothesis": "...",
  "solution": "...",
  "validation": "...",
  "nextStep": "..."
}

Sé conciso: máximo 1-2 oraciones por campo.
Habla en español.`;

export function buildCodexLoopMessages(card: SentinelCard): AIMessage[] {
  const checkedCount = card.checklist.filter((c) => c.status === "done").length;
  const totalCount = card.checklist.length;

  const context = [
    `Título: ${card.title}`,
    card.description ? `Descripción: ${card.description}` : null,
    `Tipo: ${card.type}`,
    `Estado: ${card.status}`,
    `Prioridad: ${card.priority}`,
    `Tags: ${card.tags.join(", ") || "ninguno"}`,
    totalCount > 0 ? `Checklist: ${checkedCount}/${totalCount} completados` : null,
    card.blocked ? `BLOQUEADA: ${card.blockerReason ?? "sin razón especificada"}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return [
    { role: "system", content: SYSTEM },
    { role: "user", content: context },
  ];
}

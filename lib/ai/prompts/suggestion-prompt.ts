import type { AIMessage } from "../ai-types";
import type { SentinelCard } from "@/types/card";
import type { DockEvent } from "@/types/event";

const SYSTEM = `Eres HEO, el asistente de productividad de Sentinel Board.
Tu trabajo es sugerir 2-4 acciones concretas que el usuario debería tomar ahora mismo.

Las sugerencias deben ser:
- Accionables (el usuario puede ejecutarlas como comando)
- Breves (máximo 8 palabras cada una)
- Basadas en el contexto actual del board

Cada sugerencia debe incluir el comando exacto que el usuario puede escribir.

Responde SOLO con JSON válido:
[
  { "text": "Descripción corta", "command": "comando ejecutable" },
  ...
]

Habla en español.`;

export function buildSuggestionMessages(
  cards: SentinelCard[],
  recentEvents: DockEvent[],
): AIMessage[] {
  const stuckCards = cards.filter(
    (c) =>
      c.status !== "listo" &&
      c.status !== "produccion" &&
      c.status !== "archivado",
  );

  const summary = [
    `Tarjetas activas: ${stuckCards.length}`,
    ...stuckCards.slice(0, 5).map(
      (c) => `- "${c.title}" en ${c.status} (${c.priority})`,
    ),
    "",
    `Últimos eventos:`,
    ...recentEvents.slice(-3).map((e) => `- ${e.message}`),
  ].join("\n");

  return [
    { role: "system", content: SYSTEM },
    { role: "user", content: summary },
  ];
}

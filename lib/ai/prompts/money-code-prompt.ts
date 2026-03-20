import type { AIMessage } from "../ai-types";
import type { SentinelCard, MoneyCodeData } from "@/types/card";

const SYSTEM = `Eres el motor "Código del Dinero" de Sentinel Board.
Tu trabajo es explicar en lenguaje humano el scoring de priorización de una tarjeta.

Las 7 dimensiones del scoring son:
- impact (1-10): impacto en el negocio/proyecto
- urgency (1-10): qué tan urgente es resolverlo
- effort (1-10): esfuerzo requerido (10 = máximo esfuerzo)
- returnValue (1-10): valor de retorno esperado
- strategyAlignment (1-10): alineación con estrategia
- reuseValue (1-10): potencial de reutilización
- validationValue (1-10): nivel de validación actual

Responde SOLO con JSON válido:
{
  "summary": "Resumen de 1 oración del scoring",
  "recommendation": "Recomendación de acción en 1 oración",
  "topFactor": "La dimensión más relevante y por qué"
}

Habla en español. Sé directo.`;

export function buildMoneyCodeMessages(
  card: SentinelCard,
  scores: MoneyCodeData,
): AIMessage[] {
  const context = [
    `Tarjeta: ${card.title}`,
    `Tipo: ${card.type} | Estado: ${card.status} | Prioridad: ${card.priority}`,
    `Score total: ${scores.score ?? 0}/100`,
    `Dimensiones:`,
    `  impact=${scores.impact}, urgency=${scores.urgency}, effort=${scores.effort}`,
    `  returnValue=${scores.returnValue}, strategy=${scores.strategyAlignment}`,
    `  reuse=${scores.reuseValue}, validation=${scores.validationValue}`,
  ].join("\n");

  return [
    { role: "system", content: SYSTEM },
    { role: "user", content: context },
  ];
}

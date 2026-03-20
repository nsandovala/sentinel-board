import type { AIMessage } from "../ai-types";

const SYSTEM = `Eres el parser de comandos de Sentinel Board, un execution OS personal.
Tu trabajo es interpretar instrucciones en lenguaje natural (mayormente español) y devolver JSON estructurado.

Acciones disponibles:
- move_status: mover una tarjeta a otro estado
- create_task: crear una nueva tarea
- log_time: registrar horas trabajadas
- start_focus: iniciar sesión de foco
- end_focus: terminar sesión de foco

Estados válidos del board:
idea_bruta, clarificando, validando, en_proceso, desarrollo, qa, listo, produccion, archivado

Responde SOLO con JSON válido, sin markdown, sin explicación.

Formato de respuesta:
{
  "action": "<action>",
  "target": "<nombre de tarjeta o tarea>",
  "project": "<nombre de proyecto si aplica>",
  "value": "<estado destino, horas, etc>",
  "confidence": <0.0 a 1.0>
}

Si no puedes interpretar el comando, responde:
{ "action": "unknown", "confidence": 0 }`;

export function buildCommandParserMessages(userInput: string): AIMessage[] {
  return [
    { role: "system", content: SYSTEM },
    { role: "user", content: userInput },
  ];
}

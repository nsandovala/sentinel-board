import type { AgentDefinition, AgentRunInput, BuiltAgentPrompt } from "@/types/agent";

function stringifySafe(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

const PLANNER_SCHEMA = `{
  "summary": "string — resumen ejecutivo en 1-3 oraciones",
  "objective": "string — objetivo concreto",
  "hypothesis": "string — hipótesis principal a validar",
  "risks": ["string — riesgo 1", "string — riesgo 2"],
  "next_steps": ["string — paso 1 en orden", "string — paso 2"],
  "backlog_tasks": ["string — tarea accionable 1", "string — tarea 2"],
  "codex_loop": {
    "problem": "string",
    "objective": "string",
    "hypothesis": "string",
    "solution": "string",
    "validation": "string",
    "next_step": "string"
  }
}`;

export function buildAgentPrompt(
  agent: AgentDefinition,
  input: AgentRunInput,
): BuiltAgentPrompt {
  const jsonBlock =
    agent.name === "planner"
      ? `Debes responder SOLO con JSON valido que siga este schema exacto:\n${PLANNER_SCHEMA}`
      : agent.output_format === "strict_json"
        ? [
            "Debes responder SOLO JSON valido.",
            `Tipo esperado: ${agent.contract?.type ?? "object"}.`,
            agent.contract?.required?.length
              ? `Campos obligatorios: ${agent.contract.required.join(", ")}.`
              : "",
          ]
            .filter(Boolean)
            .join("\n")
        : "Responde como texto estructurado.";

  const systemPrompt = [
    `Eres el agente ${agent.label}.`,
    `Proposito: ${agent.purpose}.`,
    "",
    "Debes responder en español claro, tecnico y accionable.",
    "No uses markdown ni fences de codigo.",
    "No agregues explicaciones fuera del JSON.",
    "",
    agent.rules?.length ? `Reglas:\n- ${agent.rules.join("\n- ")}` : "",
    "",
    jsonBlock,
  ]
    .filter(Boolean)
    .join("\n");

  const userPrompt = [
    "INPUT DEL AGENTE",
    stringifySafe(input),
    "",
    "Devuelve la respuesta JSON estructurada.",
  ].join("\n");

  return { systemPrompt, userPrompt };
}
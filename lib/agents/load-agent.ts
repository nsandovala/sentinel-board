import type { AgentDefinition } from "@/types/agent";

const AGENTS: Record<string, AgentDefinition> = {
  planner: {
    name: "planner",
    label: "Planner",
    purpose: "Traducir ideas, tareas o contexto difuso en un plan estructurado y accionable para sentinel-board.",
    inputs: ["task", "context", "constraints"],
    outputs: [
      "summary",
      "objective",
      "hypothesis",
      "risks",
      "next_steps",
      "backlog_tasks",
      "codex_loop",
    ],
    mode: "advisory",
    output_format: "strict_json",
    contract: {
      type: "object",
      required: [
        "summary",
        "objective",
        "hypothesis",
        "risks",
        "next_steps",
        "backlog_tasks",
        "codex_loop",
      ],
    },
    rules: [
      "Responder SOLO JSON valido, sin texto fuera del JSON",
      "No usar markdown ni fences",
      "No inventar integraciones o servicios no mencionados",
      "Priorizar MVP y velocidad de validacion",
      "Convertir ideas abstractas en pasos ejecutables",
      "Si falta contexto asumir la version mas simple y util",
      "risks, next_steps y backlog_tasks son arrays de strings",
      "codex_loop tiene: problem, objective, hypothesis, solution, validation, next_step",
    ],
  },
  "frontend-builder": {
    name: "frontend-builder",
    label: "Frontend Builder",
    purpose: "Construir UI funcional con cambios mínimos y seguros.",
    inputs: ["task", "context", "constraints"],
    outputs: ["objective", "files_to_touch", "plan", "risks", "done_when"],
    mode: "advisory",
    output_format: "strict_json",
  },
  "qa-reviewer": {
    name: "qa-reviewer",
    label: "QA Reviewer",
    purpose: "Revisar cambios y detectar riesgos funcionales y de UX.",
    inputs: ["task", "context", "constraints"],
    outputs: ["summary", "issues", "risks", "done_when"],
    mode: "advisory",
    output_format: "strict_json",
  },
  "state-guardian": {
    name: "state-guardian",
    label: "State Guardian",
    purpose: "Revisar integridad del estado y evitar duplicaciones o wiring roto.",
    inputs: ["task", "context", "constraints"],
    outputs: ["summary", "issues", "risks", "done_when"],
    mode: "advisory",
    output_format: "strict_json",
  },
};

export function loadAgent(agentName: string): AgentDefinition {
  const agent = AGENTS[agentName];

  if (!agent) {
    throw new Error(`Agent not found: ${agentName}`);
  }

  return agent;
}
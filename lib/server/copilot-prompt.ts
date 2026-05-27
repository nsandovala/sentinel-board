/**
 * copilot-prompt.ts
 *
 * Builds the system + user prompt for HEO Copilot conversational replies
 * (Execute mode fallback when the deterministic parser can't recognize the
 * input, and Analyze "ask about this card" follow-ups).
 *
 * Lives server-side. Never echoes API keys or env vars; only injects user
 * message + an optional minimal card snapshot.
 */

import type { CardStatus, PriorityLevel } from "@/types/enums";

export interface CopilotCardContext {
  id: string;
  title: string;
  description?: string;
  status: CardStatus;
  priority?: PriorityLevel;
  projectName?: string;
  tags?: string[];
  checklist?: Array<{ text: string; status: string }>;
  blocked?: boolean;
  blockerReason?: string;
}

export interface BuildCopilotPromptInput {
  message: string;
  card?: CopilotCardContext;
  projectName?: string;
}

const SYSTEM_PROMPT = [
  "Eres HEO Copilot, el copiloto operacional de Sentinel Board.",
  "Tu rol es ayudar al usuario a operar sobre el board: clarificar tareas,",
  "diagnosticar bloqueos, sugerir próximos pasos y proponer comandos del",
  "dock cuando aplique.",
  "",
  "Reglas de respuesta:",
  "- Responde en español neutro, técnico y accionable.",
  "- Máximo 200 palabras. Sé conciso.",
  "- No uses markdown, ni fences de código, ni emojis.",
  "- No inventes datos del board: si no tienes contexto suficiente, dilo.",
  "- No ejecutes acciones por tu cuenta; sugiere comandos para que el",
  "  usuario los aplique.",
  "",
  "Cuando un comando determinista del dock resuelva lo que pide el",
  "usuario, agrégalo en una última línea independiente con este formato",
  "EXACTO:",
  "  SUGGESTED_COMMAND: <comando>",
  "Comandos válidos (sin acentos):",
  '  crear tarea <titulo> en <proyecto>',
  '  mover "<titulo>" a <estado>',
  '  iniciar foco en <proyecto>',
  '  terminar foco',
  '  registrar <n> horas en <proyecto>',
  "Si ningún comando aplica, omite la línea SUGGESTED_COMMAND.",
].join("\n");

function formatChecklist(items: NonNullable<CopilotCardContext["checklist"]>): string {
  if (!items.length) return "(vacío)";
  return items
    .slice(0, 8)
    .map((it, i) => `  ${i + 1}. [${it.status}] ${it.text}`)
    .join("\n");
}

function formatCardBlock(card: CopilotCardContext): string {
  const lines: string[] = [
    "CONTEXTO DE LA CARD SELECCIONADA",
    `- id: ${card.id}`,
    `- titulo: ${card.title}`,
    `- estado: ${card.status}`,
  ];
  if (card.priority) lines.push(`- prioridad: ${card.priority}`);
  if (card.projectName) lines.push(`- proyecto: ${card.projectName}`);
  if (card.tags?.length) lines.push(`- tags: ${card.tags.join(", ")}`);
  if (card.description?.trim()) {
    lines.push("- descripcion:");
    lines.push(`  ${card.description.trim().slice(0, 600)}`);
  }
  if (card.checklist?.length) {
    lines.push("- checklist:");
    lines.push(formatChecklist(card.checklist));
  }
  if (card.blocked) {
    lines.push(`- bloqueada: si${card.blockerReason ? ` — ${card.blockerReason}` : ""}`);
  }
  return lines.join("\n");
}

export function buildCopilotPrompt(input: BuildCopilotPromptInput): {
  systemPrompt: string;
  userPrompt: string;
} {
  const parts: string[] = [];
  if (input.card) {
    parts.push(formatCardBlock(input.card));
    parts.push("");
  } else if (input.projectName) {
    parts.push(`CONTEXTO: proyecto activo = ${input.projectName}`);
    parts.push("");
  }
  parts.push("MENSAJE DEL USUARIO:");
  parts.push(input.message.trim().slice(0, 2000));

  return {
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: parts.join("\n"),
  };
}

const SUGGESTED_RE = /^\s*SUGGESTED_COMMAND\s*:\s*(.+?)\s*$/im;

export function extractSuggestedCommand(rawText: string): {
  text: string;
  suggestedCommand: string | null;
} {
  const m = rawText.match(SUGGESTED_RE);
  if (!m) return { text: rawText.trim(), suggestedCommand: null };
  const suggestedCommand = m[1].trim().replace(/^["'`]|["'`]$/g, "");
  const text = rawText.replace(SUGGESTED_RE, "").trim();
  return { text, suggestedCommand: suggestedCommand || null };
}

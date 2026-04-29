/**
 * terminal-runner.ts
 *
 * Purpose: Server-side orchestrator for the terminal. Tries local actions
 * first (action-resolver → action-executor) and falls back to the AI
 * router only for unrecognized commands.
 *
 * Flow:
 *   command → resolveAction() → if matched → executeAction() → done
 *                              → if null   → routeAI()       → done
 *
 * Input:  { command, context?, projectId?, repo?, agent? }
 * Output: TerminalRunResult with outputType "action" | "json" | "text"
 *
 * Dependencies:
 *   - lib/server/action-resolver.ts (pure parsing, no DB)
 *   - lib/server/action-executor.ts (DB reads/writes via Drizzle)
 *   - lib/ai/ai-router.ts (LLM fallback)
 */

import { routeAI, type AIProviderName } from "@/lib/ai/ai-router";
import { resolveAction } from "./action-resolver";
import { executeAction } from "./action-executor";

export type TerminalRunStatus = "running" | "success" | "error";
export type TerminalOutputType = "action" | "json" | "text";

export interface TerminalRunInput {
  command: string;
  context?: string;
  projectId?: string;
  repo?: string;
  agent?: string;
}

export interface TerminalRunResult {
  ok: boolean;
  provider: AIProviderName | "none" | "local";
  status: TerminalRunStatus;
  outputType: TerminalOutputType;
  logs: string[];
  rawText?: string;
  structuredOutput?: unknown;
  meta?: Record<string, unknown>;
  isJson: boolean;
  hint?: string;
  error?: string;
  durationMs: number;
}

const SYSTEM_PROMPT = `You are a command runner inside Sentinel Board, a developer workspace.

RULES — follow strictly:
- Execute the command. Do NOT ask questions. Do NOT converse.
- If the command is ambiguous, pick the most operationally useful interpretation and execute it.
- Output plain text only. No markdown, no headings, no bullet lists, no code fences.
- If the command requests JSON, output ONLY valid JSON — nothing before, nothing after.
- Never apologize, greet, or add commentary. Output = result only.
- Keep responses under 40 lines unless the command explicitly asks for more.`;

function stripCodeFences(text: string): string {
  const fenced = text.match(/^```(?:json|JSON)?\s*\n([\s\S]*?)\n```\s*$/);
  if (fenced) return fenced[1].trim();
  const inlineFenced = text.match(/^```(?:json|JSON)?\s*([\s\S]*?)```\s*$/);
  if (inlineFenced) return inlineFenced[1].trim();
  return text.trim();
}

function tryParseJson(text: string): { parsed: unknown; isJson: true } | { parsed: null; isJson: false } {
  const cleaned = stripCodeFences(text);
  if (!cleaned.startsWith("{") && !cleaned.startsWith("[")) {
    return { parsed: null, isJson: false };
  }
  try {
    return { parsed: JSON.parse(cleaned), isJson: true };
  } catch {
    return { parsed: null, isJson: false };
  }
}

export async function runTerminalCommand(
  input: TerminalRunInput,
): Promise<TerminalRunResult> {
  const start = Date.now();
  const logs: string[] = [];
  const cmd = input.command.trim();

  if (!cmd) {
    return {
      ok: false, provider: "none", status: "error", outputType: "text",
      logs: ["Comando vacío"], error: "Comando vacío", isJson: false, durationMs: 0,
    };
  }

  logs.push(`> ${cmd}`);

  // ── Try local action first ──
  const action = resolveAction(cmd);
  if (action) {
    logs.push(`action: ${action.type}`);
    const result = await executeAction(action);
    const durationMs = Date.now() - start;
    logs.push(`local (${durationMs}ms)`);

    return {
      ok: result.ok,
      provider: "local",
      status: result.ok ? "success" : "error",
      outputType: "action",
      logs,
      rawText: result.message,
      structuredOutput: result.data,
      meta: result.meta,
      isJson: false,
      hint: result.hint,
      error: result.ok ? undefined : result.message,
      durationMs,
    };
  }

  // ── Fallback to AI router — no local action matched ──
  logs.push(`[guardrail] No local match for: "${cmd.slice(0, 60)}" → fallback to LLM`);

  let userPrompt = cmd;
  if (input.context) userPrompt += `\n\nContext:\n${input.context}`;
  if (input.projectId) userPrompt += `\nProject: ${input.projectId}`;
  if (input.repo) userPrompt += `\nRepo: ${input.repo}`;

  logs.push("routing...");

  try {
    const result = await routeAI(SYSTEM_PROMPT, userPrompt);
    const durationMs = Date.now() - start;
    logs.push(`provider: ${result.provider} (${durationMs}ms)`);

    if (result.ok) {
      const normalized = stripCodeFences(result.rawText);
      const jsonResult = tryParseJson(result.rawText);

      return {
        ok: true,
        provider: result.provider,
        status: "success",
        outputType: jsonResult.isJson ? "json" : "text",
        logs,
        rawText: normalized,
        structuredOutput: jsonResult.parsed,
        isJson: jsonResult.isJson,
        durationMs,
      };
    }

    logs.push(`error: ${result.error ?? "unknown"}`);
    return {
      ok: false, provider: result.provider, status: "error", outputType: "text",
      logs, rawText: result.rawText || undefined, isJson: false,
      error: result.error, durationMs,
    };
  } catch (err) {
    const durationMs = Date.now() - start;
    const message = err instanceof Error ? err.message : "Error desconocido";
    logs.push(`exception: ${message}`);
    return {
      ok: false, provider: "none", status: "error", outputType: "text",
      logs, isJson: false, error: message, durationMs,
    };
  }
}

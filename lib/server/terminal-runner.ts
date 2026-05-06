/**
 * terminal-runner.ts
 *
 * Purpose: Local command runner for the IDE terminal.
 */

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
  provider: "none" | "local";
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

export async function runTerminalCommand(
  input: TerminalRunInput,
): Promise<TerminalRunResult> {
  const start = Date.now();
  const logs: string[] = [];
  const command = input.command.trim();

  if (!command) {
    return {
      ok: false,
      provider: "none",
      status: "error",
      outputType: "text",
      logs: ["Comando vacio"],
      error: "Comando vacio",
      isJson: false,
      durationMs: 0,
    };
  }

  logs.push(`> ${command}`);

  const action = resolveAction(command);
  if (!action) {
    return {
      ok: false,
      provider: "local",
      status: "error",
      outputType: "text",
      logs,
      rawText:
        "No reconoci ese comando. Prueba con: move, focus, score o analyze backlog.",
      error: "Comando no reconocido",
      isJson: false,
      durationMs: Date.now() - start,
    };
  }

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

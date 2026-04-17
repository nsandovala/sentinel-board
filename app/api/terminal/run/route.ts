/**
 * POST /api/terminal/run
 *
 * Purpose: HTTP endpoint that receives terminal commands from the UI and
 * delegates execution to terminal-runner.ts, which in turn calls the
 * existing ai-router.ts provider chain.
 *
 * Input:  JSON { command: string, context?: string, projectId?: string, repo?: string, agent?: string }
 * Output: JSON TerminalRunResult { ok, provider, status, logs, rawText?, error?, durationMs }
 *
 * Dependency: lib/server/terminal-runner.ts → lib/ai/ai-router.ts
 *
 * Risks:
 * - Long-running commands block the response. Future phases should use
 *   streaming (SSE or WebSocket) instead of request/response.
 * - No auth layer; safe for local dev, needs protection before deploy.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  runTerminalCommand,
  type TerminalRunInput,
} from "@/lib/server/terminal-runner";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const command = typeof body?.command === "string" ? body.command.trim() : "";
    if (!command) {
      return NextResponse.json(
        {
          ok: false,
          provider: "none",
          status: "error",
          logs: ["Comando vacío o no proporcionado"],
          error: "El campo 'command' es requerido",
          durationMs: 0,
        },
        { status: 400 },
      );
    }

    const input: TerminalRunInput = {
      command,
      context: typeof body.context === "string" ? body.context : undefined,
      projectId: typeof body.projectId === "string" ? body.projectId : undefined,
      repo: typeof body.repo === "string" ? body.repo : undefined,
      agent: typeof body.agent === "string" ? body.agent : undefined,
    };

    const result = await runTerminalCommand(input);

    return NextResponse.json(result, {
      status: result.ok ? 200 : 502,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        provider: "none",
        status: "error",
        logs: ["Error interno del servidor"],
        error: err instanceof Error ? err.message : "Error desconocido",
        durationMs: 0,
      },
      { status: 500 },
    );
  }
}

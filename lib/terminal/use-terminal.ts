"use client";

/**
 * use-terminal.ts
 *
 * Purpose: React hook that bridges the xterm.js terminal UI with the
 * server-side terminal runner via POST /api/terminal/run.
 *
 * Input:  User commands typed in the terminal
 * Output: AI responses rendered in xterm, plus status/provider state
 *
 * Dependency: /api/terminal/run -> lib/server/terminal-runner -> lib/ai/ai-router
 *
 * Risks:
 * - Long-running requests block the UI feedback loop. Phase 2 should
 *   switch to SSE/streaming for progressive output.
 * - No abort mechanism yet; a stuck request will resolve eventually
 *   via provider timeout (~30s).
 */

import { useCallback, useRef, useState } from "react";
import type { Terminal } from "@xterm/xterm";

export type TerminalStatus = "idle" | "running" | "success" | "error";

export interface TerminalHandle {
  appendLog: (line: string) => void;
  clearTerminal: () => void;
  executeCommand: (input: string) => void;
}

export interface TerminalState {
  status: TerminalStatus;
  provider: string | null;
}

const ANSI = {
  reset: "\x1b[0m",
  dim: "\x1b[90m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  magenta: "\x1b[35m",
  bold: "\x1b[1m",
} as const;

export function useTerminal(onRefresh?: () => void) {
  const termRef = useRef<Terminal | null>(null);
  const [state, setState] = useState<TerminalState>({
    status: "idle",
    provider: null,
  });

  const setTerminal = useCallback((term: Terminal | null) => {
    termRef.current = term;
  }, []);

  const appendLog = useCallback((line: string) => {
    termRef.current?.writeln(line);
  }, []);

  const clearTerminal = useCallback(() => {
    termRef.current?.clear();
  }, []);

  const executeCommand = (input: string) => {
    const term = termRef.current;
    if (!term) return;

    const trimmed = input.trim();
    if (!trimmed) return;

    if (trimmed === "clear") {
      term.clear();
      return;
    }

    term.writeln(`${ANSI.cyan}${ANSI.bold}>${ANSI.reset} ${trimmed}`);
    term.writeln(`${ANSI.dim}Ejecutando...${ANSI.reset}`);

    setState({ status: "running", provider: null });

    fetch("/api/terminal/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command: trimmed }),
    })
      .then(async (res) => {
        const data = await res.json();

        if (data.logs?.length) {
          for (const log of data.logs) {
            term.writeln(`${ANSI.dim}  ${log}${ANSI.reset}`);
          }
        }

        if (data.ok && data.rawText) {
          const ot = data.outputType ?? (data.isJson ? "json" : "text");
          const typeTag =
            ot === "action" ? `${ANSI.magenta}${ANSI.bold}[ACTION]${ANSI.reset} `
            : ot === "json" ? `${ANSI.yellow}[JSON]${ANSI.reset} `
            : `${ANSI.dim}[TEXT]${ANSI.reset} `;
          const color =
            ot === "action" ? ANSI.magenta
            : ot === "json" ? ANSI.cyan
            : ANSI.green;

          if (ot === "json" && data.structuredOutput) {
            const pretty = JSON.stringify(data.structuredOutput, null, 2);
            for (const line of pretty.split("\n")) {
              term.writeln(`${typeTag}${color}${line}${ANSI.reset}`);
            }
          } else {
            for (const line of data.rawText.split("\n")) {
              term.writeln(`${typeTag}${color}${line}${ANSI.reset}`);
            }
          }

          const providerLabel = data.provider === "local" ? "local" : data.provider;
          term.writeln(`${ANSI.dim}  ok ${providerLabel} | ${data.durationMs ?? 0}ms${ANSI.reset}`);

          if (data.hint === "refresh_board") {
            term.writeln(`${ANSI.yellow}  sync board...${ANSI.reset}`);
            onRefresh?.();
          }

          setState({ status: "success", provider: data.provider });
        } else {
          const errMsg = data.error ?? "Sin respuesta del provider";
          term.writeln(`${ANSI.red}  x ${errMsg}${ANSI.reset}`);
          if (data.durationMs) {
            term.writeln(`${ANSI.dim}  ${data.durationMs}ms${ANSI.reset}`);
          }
          setState({ status: "error", provider: data.provider ?? null });
        }

        term.writeln("");
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : "Error de red";
        term.writeln(`${ANSI.red}  x ${message}${ANSI.reset}`);
        term.writeln("");
        setState({ status: "error", provider: null });
      });
  };

  const handle: TerminalHandle = { appendLog, clearTerminal, executeCommand };

  return { setTerminal, handle, state } as const;
}

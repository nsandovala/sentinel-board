"use client";

import { useCallback, useRef, useState } from "react";
import type { Terminal } from "@xterm/xterm";

export type TerminalStatus = "idle" | "running" | "success" | "error";
export type TerminalRuntimeMode = "local" | "agent";

export interface TerminalHandle {
  appendLog: (line: string) => void;
  clearTerminal: () => void;
  executeCommand: (input: string) => void;
}

export interface TerminalState {
  status: TerminalStatus;
  provider: string | null;
  mode: TerminalRuntimeMode;
  connected: boolean;
}

interface UseTerminalOptions {
  onRefresh?: () => void;
  onOpenCard?: (cardId: string, projectId?: string) => void;
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

export function useTerminal(options: UseTerminalOptions = {}) {
  const termRef = useRef<Terminal | null>(null);
  const [state, setState] = useState<TerminalState>({
    status: "idle",
    provider: "local",
    mode: "local",
    connected: true,
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

  const executeCommand = useCallback(
    (input: string) => {
      const term = termRef.current;
      if (!term) return;

      const command = input.trim();
      if (!command) return;

      if (command === "clear") {
        term.clear();
        return;
      }

      term.writeln(`${ANSI.cyan}${ANSI.bold}>${ANSI.reset} ${command}`);
      term.writeln(`${ANSI.dim}Resolviendo comando local...${ANSI.reset}`);
      setState((current) => ({ ...current, status: "running", provider: "local" }));

      fetch("/api/terminal/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command }),
      })
        .then(async (res) => {
          const data = await res.json();

          if (data.logs?.length) {
            for (const log of data.logs) {
              term.writeln(`${ANSI.dim}  ${log}${ANSI.reset}`);
            }
          }

          const mode = data.meta?.mode === "agent" ? "agent" : "local";

          if (data.ok && data.rawText) {
            for (const line of String(data.rawText).split("\n")) {
              const tag = mode === "agent" ? "[AGENT]" : "[LOCAL]";
              const color = mode === "agent" ? ANSI.yellow : ANSI.green;
              term.writeln(`${ANSI.magenta}${tag}${ANSI.reset} ${color}${line}${ANSI.reset}`);
            }

            term.writeln(`${ANSI.dim}  ok local | ${data.durationMs ?? 0}ms${ANSI.reset}`);

            if (data.hint === "refresh_board") {
              options.onRefresh?.();
            }

            if (data.meta?.affectedCardId) {
              options.onOpenCard?.(
                String(data.meta.affectedCardId),
                typeof data.meta.projectId === "string" ? data.meta.projectId : undefined,
              );
            }

            setState({
              status: "success",
              provider: "local",
              mode,
              connected: true,
            });
          } else {
            const message = data.rawText ?? data.error ?? "Sin respuesta del terminal";
            term.writeln(`${ANSI.red}  x ${message}${ANSI.reset}`);
            setState({
              status: "error",
              provider: "local",
              mode,
              connected: true,
            });
          }

          term.writeln("");
        })
        .catch((error) => {
          const message = error instanceof Error ? error.message : "Error de red";
          term.writeln(`${ANSI.red}  x ${message}${ANSI.reset}`);
          term.writeln("");
          setState({
            status: "error",
            provider: null,
            mode: "local",
            connected: false,
          });
        });
    },
    [options],
  );

  const handle: TerminalHandle = { appendLog, clearTerminal, executeCommand };
  return { setTerminal, handle, state } as const;
}

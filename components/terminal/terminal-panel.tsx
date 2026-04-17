"use client";

/**
 * terminal-panel.tsx
 *
 * Purpose: Visual terminal component backed by xterm.js. Renders the
 * terminal canvas, a command input line, and a status bar showing the
 * current execution state and active AI provider.
 *
 * Input:  onTerminalReady/onTerminalDispose callbacks, executeCommand fn,
 *         and terminal state (status + provider).
 * Output: xterm.js instance handed back to the parent via onTerminalReady.
 *
 * Dependency: @xterm/xterm, @xterm/addon-fit (lazy-loaded).
 *             Indirectly depends on /api/terminal/run via executeCommand.
 *
 * Risks:
 * - xterm.js is DOM-only; this component MUST be loaded with { ssr: false }.
 * - ResizeObserver drives fit-addon; rapid resizes can cause layout jitter.
 */

import { useEffect, useRef, useState } from "react";
import { Terminal as TermIcon, X, Minus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import "@xterm/xterm/css/xterm.css";

import type { Terminal } from "@xterm/xterm";
import type { FitAddon } from "@xterm/addon-fit";
import type { TerminalStatus } from "@/lib/terminal/use-terminal";

interface TerminalPanelProps {
  onTerminalReady?: (term: Terminal) => void;
  onTerminalDispose?: () => void;
  executeCommand?: (input: string) => void;
  status?: TerminalStatus;
  provider?: string | null;
}

const statusConfig: Record<TerminalStatus, { label: string; classes: string }> = {
  idle: { label: "Listo", classes: "text-muted-foreground/60" },
  running: { label: "Ejecutando", classes: "text-amber-400/90" },
  success: { label: "OK", classes: "text-emerald-400/90" },
  error: { label: "Error", classes: "text-red-400/90" },
};

export function TerminalPanel({
  onTerminalReady,
  onTerminalDispose,
  executeCommand,
  status = "idle",
  provider,
}: TerminalPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [minimized, setMinimized] = useState(false);
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    if (!containerRef.current || termRef.current) return;

    let term: Terminal;
    let fitAddon: FitAddon;
    let disposed = false;

    (async () => {
      const { Terminal } = await import("@xterm/xterm");
      const { FitAddon } = await import("@xterm/addon-fit");

      if (disposed) return;

      term = new Terminal({
        fontSize: 12,
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        theme: {
          background: "#0a0a0f",
          foreground: "#c8c8d0",
          cursor: "#c8c8d0",
          selectionBackground: "#ffffff20",
          black: "#0a0a0f",
          brightBlack: "#555570",
        },
        cursorBlink: false,
        disableStdin: true,
        scrollback: 1000,
        convertEol: true,
      });

      fitAddon = new FitAddon();
      term.loadAddon(fitAddon);

      termRef.current = term;
      fitRef.current = fitAddon;

      term.open(containerRef.current!);
      fitAddon.fit();

      term.writeln("\x1b[90m── Sentinel Terminal ──\x1b[0m");
      term.writeln("\x1b[90mEscribí un comando abajo. Conectado a ai-router.\x1b[0m");
      term.writeln("");

      onTerminalReady?.(term);
    })();

    const handleResize = () => fitRef.current?.fit();
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerRef.current);

    return () => {
      disposed = true;
      resizeObserver.disconnect();
      if (termRef.current) {
        onTerminalDispose?.();
        termRef.current.dispose();
        termRef.current = null;
        fitRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = () => {
    const cmd = inputValue.trim();
    if (!cmd || !executeCommand) return;
    executeCommand(cmd);
    setInputValue("");
  };

  const statusInfo = statusConfig[status];

  return (
    <div
      className={cn(
        "flex flex-col border-t border-sidebar-border bg-[#0a0a0f] transition-[height] duration-200",
        minimized ? "h-8" : "h-52",
      )}
    >
      {/* Header bar */}
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-border/15 px-3">
        <TermIcon className="h-3.5 w-3.5 text-muted-foreground/60" />
        <span className="text-[11px] font-medium tracking-wide text-muted-foreground/80">
          Terminal
        </span>

        <span className={cn("text-[10px] font-medium tracking-wide", statusInfo.classes)}>
          {status === "running" && <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />}
          {statusInfo.label}
        </span>

        {provider && provider !== "none" && (
          <span className="rounded border border-border/20 bg-muted/30 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            {provider}
          </span>
        )}

        <div className="ml-auto flex gap-1">
          <button
            type="button"
            onClick={() => setMinimized((v) => !v)}
            className="rounded p-0.5 text-muted-foreground/50 hover:text-muted-foreground"
          >
            <Minus className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => setMinimized(true)}
            className="rounded p-0.5 text-muted-foreground/50 hover:text-muted-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Terminal canvas */}
      <div
        ref={containerRef}
        className={cn("min-h-0 flex-1 overflow-hidden px-1", minimized && "hidden")}
      />

      {/* Command input */}
      {!minimized && (
        <div className="flex h-8 shrink-0 items-center gap-2 border-t border-border/15 bg-[#0c0c12] px-3">
          <span className="text-[12px] font-bold text-cyan-500/80">❯</span>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder={status === "running" ? "Esperando respuesta..." : "Escribí un comando..."}
            disabled={status === "running"}
            className="h-full flex-1 border-none bg-transparent text-[12px] text-foreground/90 placeholder:text-muted-foreground/40 focus:outline-none disabled:opacity-50"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
      )}
    </div>
  );
}

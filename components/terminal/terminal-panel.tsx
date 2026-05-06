"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Maximize2,
  Minimize2,
  SquareTerminal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import "@xterm/xterm/css/xterm.css";

import type { FitAddon } from "@xterm/addon-fit";
import type { Terminal } from "@xterm/xterm";
import type { TerminalRuntimeMode, TerminalStatus } from "@/lib/terminal/use-terminal";

interface TerminalPanelProps {
  onTerminalReady?: (term: Terminal) => void;
  onTerminalDispose?: () => void;
  executeCommand?: (input: string) => void;
  status?: TerminalStatus;
  provider?: string | null;
  mode?: TerminalRuntimeMode;
  connected?: boolean;
}

type TerminalSize = "collapsed" | "medium" | "large";

const statusConfig: Record<TerminalStatus, { label: string; classes: string }> = {
  idle: { label: "Ready", classes: "text-muted-foreground/70" },
  running: { label: "Running", classes: "text-amber-300" },
  success: { label: "Done", classes: "text-emerald-300" },
  error: { label: "Error", classes: "text-red-300" },
};

const sizeHeights: Record<TerminalSize, string> = {
  collapsed: "h-28",
  medium: "h-[20rem]",
  large: "h-[32rem]",
};

function StatusBadge({
  label,
  active,
  tone = "default",
}: {
  label: string;
  active: boolean;
  tone?: "default" | "agent" | "success";
}) {
  return (
    <span
      className={cn(
        "rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors",
        active
          ? tone === "agent"
            ? "border-amber-400/30 bg-amber-400/10 text-amber-200"
            : tone === "success"
              ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
              : "border-cyan-400/30 bg-cyan-400/10 text-cyan-200"
          : "border-border/30 bg-background/40 text-muted-foreground/60",
      )}
    >
      {label}
    </span>
  );
}

export function TerminalPanel({
  onTerminalReady,
  onTerminalDispose,
  executeCommand,
  status = "idle",
  provider,
  mode = "local",
  connected = true,
}: TerminalPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);

  const [size, setSize] = useState<TerminalSize>("medium");
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    if (!containerRef.current || termRef.current) return;

    let disposed = false;
    let terminal: Terminal;
    let fitAddon: FitAddon;

    void (async () => {
      const { Terminal } = await import("@xterm/xterm");
      const { FitAddon } = await import("@xterm/addon-fit");

      if (disposed) return;

      terminal = new Terminal({
        fontSize: 12,
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        theme: {
          background: "#05070b",
          foreground: "#d7dde7",
          cursor: "#cfe6ff",
          selectionBackground: "#7dd3fc33",
          black: "#05070b",
          brightBlack: "#64748b",
        },
        cursorBlink: false,
        disableStdin: true,
        scrollback: 1500,
        convertEol: true,
      });

      fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);

      const container = containerRef.current;
      if (!container) return;

      termRef.current = terminal;
      fitRef.current = fitAddon;

      terminal.open(container);
      fitAddon.fit();

      terminal.writeln("\x1b[90mSentinel Terminal\x1b[0m");
      terminal.writeln("\x1b[90mLocal-first. Board-aware. Comandos tipados.\x1b[0m");
      terminal.writeln("\x1b[90mPrueba: help | status | analyze backlog\x1b[0m");
      terminal.writeln("");

      onTerminalReady?.(terminal);
    })();

    const observer = new ResizeObserver(() => fitRef.current?.fit());
    observer.observe(containerRef.current);

    return () => {
      disposed = true;
      observer.disconnect();
      if (termRef.current) {
        onTerminalDispose?.();
        termRef.current.dispose();
        termRef.current = null;
        fitRef.current = null;
      }
    };
  }, [onTerminalDispose, onTerminalReady]);

  useEffect(() => {
    fitRef.current?.fit();
  }, [size]);

  const submit = () => {
    const command = inputValue.trim();
    if (!command || !executeCommand) return;

    if (historyRef.current[historyRef.current.length - 1] !== command) {
      historyRef.current.push(command);
    }
    historyIndexRef.current = historyRef.current.length;

    executeCommand(command);
    setInputValue("");
  };

  const statusInfo = statusConfig[status];

  return (
    <div
      className={cn(
        "sentinel-ide-terminal flex flex-col border-t border-sidebar-border bg-[#05070b] transition-[height] duration-200",
        sizeHeights[size],
      )}
    >
      <div className="flex h-10 shrink-0 items-center gap-3 border-b border-white/8 bg-[linear-gradient(180deg,#0a0f17,#070b11)] px-4">
        <SquareTerminal className="h-4 w-4 text-cyan-200/80" />
        <div className="min-w-0">
          <p className="text-[12px] font-semibold tracking-[0.08em] text-slate-100">
            Sentinel Terminal
          </p>
          <p className={cn("text-[10px] tracking-[0.08em]", statusInfo.classes)}>
            {status === "running" && <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />}
            {statusInfo.label}
            {provider ? ` · ${provider}` : ""}
          </p>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <StatusBadge label="LOCAL" active={mode === "local"} />
          <StatusBadge label="SB CONNECTED" active={connected} tone="success" />
          <StatusBadge label="AGENT MODE" active={mode === "agent"} tone="agent" />
        </div>

        <div className="ml-3 flex items-center gap-1">
          <button
            type="button"
            onClick={() => setSize("collapsed")}
            className="rounded-md p-1 text-slate-400 transition-colors hover:bg-white/6 hover:text-slate-200"
            title="Collapsed"
          >
            <Minimize2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setSize((current) => (current === "large" ? "medium" : "large"))}
            className="rounded-md p-1 text-slate-400 transition-colors hover:bg-white/6 hover:text-slate-200"
            title={size === "large" ? "Medium" : "Large"}
          >
            {size === "large" ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setSize((current) => (current === "collapsed" ? "medium" : "collapsed"))}
            className="rounded-md p-1 text-slate-400 transition-colors hover:bg-white/6 hover:text-slate-200"
            title={size === "collapsed" ? "Expand" : "Collapse"}
          >
            {size === "collapsed" ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      <div ref={containerRef} className="min-h-0 flex-1 overflow-hidden px-2 py-1" />

      <div className="flex h-11 shrink-0 items-center gap-3 border-t border-white/8 bg-[#070b11] px-4">
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-300/90">
          cmd
        </span>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submit();
              return;
            }

            if (event.key === "ArrowUp") {
              event.preventDefault();
              if (historyRef.current.length === 0) return;
              historyIndexRef.current = Math.max(0, historyIndexRef.current - 1);
              setInputValue(historyRef.current[historyIndexRef.current] ?? "");
              return;
            }

            if (event.key === "ArrowDown") {
              event.preventDefault();
              if (historyRef.current.length === 0) return;
              historyIndexRef.current = Math.min(
                historyRef.current.length,
                historyIndexRef.current + 1,
              );
              setInputValue(
                historyIndexRef.current >= historyRef.current.length
                  ? ""
                  : historyRef.current[historyIndexRef.current] ?? "",
              );
            }
          }}
          placeholder='Ej.: help, status, move "Card" to clarificando, focus "Card"'
          disabled={status === "running"}
          className="h-full flex-1 border-none bg-transparent text-[12px] text-slate-100 placeholder:text-slate-500 focus:outline-none disabled:opacity-50"
          autoComplete="off"
          spellCheck={false}
        />
      </div>
    </div>
  );
}

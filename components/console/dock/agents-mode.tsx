"use client";

import { useState } from "react";
import { Bot, Activity, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

export type AgentStatus = "idle" | "running" | "done" | "error";

interface AgentDef {
  key: string;
  name: string;
  role: string;
}

const AGENTS: AgentDef[] = [
  { key: "planner", name: "planner", role: "Descompone ideas en tareas accionables" },
  { key: "qa-reviewer", name: "qa-reviewer", role: "Revisa criterios de aceptación y huecos" },
  { key: "state-guardian", name: "state-guardian", role: "Vigila bloqueos y movimientos inválidos" },
  { key: "scorer", name: "scorer", role: "Asigna prioridad y código del dinero" },
];

const STATUS_LABEL: Record<AgentStatus, string> = {
  idle: "idle",
  running: "running",
  done: "done",
  error: "error",
};

const STATUS_DOT: Record<AgentStatus, string> = {
  idle: "bg-muted-foreground/40",
  running: "bg-amber-400/85 animate-pulse",
  done: "bg-emerald-400/80",
  error: "bg-red-400/85",
};

const STATUS_PILL: Record<AgentStatus, string> = {
  idle: "border-border/35 bg-muted/40 text-muted-foreground",
  running: "border-amber-500/25 bg-amber-500/10 text-amber-300",
  done: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
  error: "border-red-500/25 bg-red-500/10 text-red-300",
};

function nextStatus(current: AgentStatus): AgentStatus {
  const order: AgentStatus[] = ["idle", "running", "done", "error"];
  const idx = order.indexOf(current);
  return order[(idx + 1) % order.length] ?? "idle";
}

interface AgentsModeProps {
  expanded: boolean;
}

export function AgentsMode({ expanded }: AgentsModeProps) {
  const [statuses, setStatuses] = useState<Record<string, AgentStatus>>(
    () => Object.fromEntries(AGENTS.map((a) => [a.key, "idle" as AgentStatus])),
  );

  const cycle = (key: string) => {
    setStatuses((prev) => ({ ...prev, [key]: nextStatus(prev[key] ?? "idle") }));
  };

  const reset = () => {
    setStatuses(Object.fromEntries(AGENTS.map((a) => [a.key, "idle" as AgentStatus])));
  };

  return (
    <div className="flex flex-col gap-3 px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-muted-foreground/80" aria-hidden />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground/80">
            Agentes
          </span>
        </div>
        <div className="flex items-center gap-1.5 rounded-md border border-border/30 bg-background/40 px-2 py-0.5 text-[10px] text-muted-foreground">
          <Activity className="h-3 w-3" aria-hidden />
          Event stream no conectado todavía
        </div>
        <button
          type="button"
          onClick={reset}
          className="ml-auto inline-flex items-center gap-1 rounded-md border border-border/35 bg-muted/40 px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          title="Volver todos los agentes a idle"
        >
          <RotateCcw className="h-3 w-3" />
          Reset estados
        </button>
      </div>

      <div
        className={cn(
          "grid gap-2",
          expanded ? "grid-cols-1 md:grid-cols-2" : "grid-cols-2 md:grid-cols-4",
        )}
      >
        {AGENTS.map((agent) => {
          const status = statuses[agent.key] ?? "idle";
          return (
            <button
              key={agent.key}
              type="button"
              onClick={() => cycle(agent.key)}
              className="sentinel-glass-panel--subtle group flex flex-col gap-1.5 rounded-md p-2.5 text-left transition-colors hover:border-border/55"
              aria-label={`Simular siguiente estado para ${agent.name}`}
              title="Click para simular cambio de estado (mock local)"
            >
              <div className="flex items-center gap-2">
                <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", STATUS_DOT[status])} aria-hidden />
                <span className="font-mono text-[12px] font-medium text-foreground/90">
                  {agent.name}
                </span>
                <span
                  className={cn(
                    "ml-auto rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider",
                    STATUS_PILL[status],
                  )}
                >
                  {STATUS_LABEL[status]}
                </span>
              </div>
              {expanded && (
                <p className="text-[11px] leading-snug text-muted-foreground">{agent.role}</p>
              )}
            </button>
          );
        })}
      </div>

      {expanded && (
        <section className="rounded-md border border-dashed border-border/40 bg-background/30 p-3 text-[11px] leading-relaxed text-muted-foreground">
          <p>
            <span className="text-foreground/85">Roadmap:</span> este panel consumirá un event
            stream cuando exista (SSE / WebSocket en <code className="rounded bg-muted/60 px-1 text-[10px]">/api/stream</code>).
            Por ahora los estados son mock locales para validar layout, contraste y jerarquía
            sin generar registros falsos en el board.
          </p>
        </section>
      )}
    </div>
  );
}

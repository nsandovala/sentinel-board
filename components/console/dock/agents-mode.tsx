"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Activity } from "lucide-react";

export type AgentStatus = "idle" | "running" | "success" | "error";

const TRACKED_AGENTS = [
  "planner",
  "state-guardian",
  "qa-reviewer",
  "scorer",
] as const;

type TrackedAgent = (typeof TRACKED_AGENTS)[number];

interface AgentSnapshot {
  agent: TrackedAgent;
  state: AgentStatus;
  lastEventType: string | null;
  lastMessage: string | null;
  lastTs: string | null;
  runId: string | null;
  taskId: string | null;
}

interface RuntimeEventsResponse {
  ok: boolean;
  source: string;
  exists: boolean;
  events: Array<{
    id: string | null;
    ts: string | null;
    type: string | null;
    agent: string | null;
    message: string | null;
    runId: string | null;
    taskId: string | null;
  }>;
  agents: AgentSnapshot[];
}

interface AgentsModeProps {
  expanded?: boolean;
}

const POLL_INTERVAL_MS = 3000;
const EVENTS_LIMIT = 50;

const STATE_DOT_CLASS: Record<AgentStatus, string> = {
  idle: "bg-muted-foreground/35",
  running: "bg-amber-400/85 animate-pulse",
  success: "bg-emerald-400/80",
  error: "bg-red-400/85",
};

const STATE_LABEL_CLASS: Record<AgentStatus, string> = {
  idle: "text-muted-foreground/55",
  running: "text-amber-300",
  success: "text-emerald-300",
  error: "text-red-300",
};

function formatRelativeTs(ts: string | null): string | null {
  if (!ts) return null;
  const t = Date.parse(ts);
  if (!Number.isFinite(t)) return null;
  const diff = Date.now() - t;
  if (diff < 0) return "ahora";
  if (diff < 5_000) return "ahora";
  if (diff < 60_000) return `hace ${Math.round(diff / 1000)}s`;
  if (diff < 3_600_000) return `hace ${Math.round(diff / 60_000)}m`;
  if (diff < 86_400_000) return `hace ${Math.round(diff / 3_600_000)}h`;
  return `hace ${Math.round(diff / 86_400_000)}d`;
}

function emptySnapshots(): AgentSnapshot[] {
  return TRACKED_AGENTS.map((agent) => ({
    agent,
    state: "idle",
    lastEventType: null,
    lastMessage: null,
    lastTs: null,
    runId: null,
    taskId: null,
  }));
}

export function AgentsMode(_props: AgentsModeProps) {
  const [agents, setAgents] = useState<AgentSnapshot[]>(emptySnapshots);
  const [streamExists, setStreamExists] = useState<boolean | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchEvents = async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch(`/api/runtime/events?limit=${EVENTS_LIMIT}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as RuntimeEventsResponse;
        if (cancelled) return;
        setStreamExists(Boolean(json.exists));
        setAgents(json.agents?.length ? json.agents : emptySnapshots());
        setLastError(null);
      } catch (err) {
        if (cancelled) return;
        if ((err as { name?: string })?.name === "AbortError") return;
        setLastError(err instanceof Error ? err.message : "fetch error");
      }
    };

    fetchEvents();
    const interval = setInterval(fetchEvents, POLL_INTERVAL_MS);
    const tick = setInterval(() => setNow(Date.now()), 1000);

    return () => {
      cancelled = true;
      clearInterval(interval);
      clearInterval(tick);
      abortRef.current?.abort();
    };
  }, []);

  const badgeText =
    streamExists === null
      ? "Conectando con Event Stream..."
      : streamExists
        ? "Event Stream conectado"
        : "Event Stream pendiente";

  const badgeClass =
    streamExists === true
      ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
      : streamExists === false
        ? "border-border/30 bg-background/40 text-muted-foreground"
        : "border-border/30 bg-background/40 text-muted-foreground/75";

  return (
    <div className="flex flex-col gap-2.5 px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-muted-foreground/75" aria-hidden />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground/85">
            Runtime
          </span>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] ${badgeClass}`}
          title="Estado de lectura NDJSON · polling cada 3s"
        >
          <Activity className="h-3 w-3" aria-hidden />
          {badgeText}
        </span>
        {lastError && (
          <span className="text-[10px] text-red-300/80" title={lastError}>
            error de polling
          </span>
        )}
      </div>

      <ul className="flex flex-col divide-y divide-border/20 overflow-hidden rounded-md border border-border/30 bg-background/30">
        {agents.map((agent) => {
          const rel = formatRelativeTs(agent.lastTs);
          void now;
          const subtitleParts: string[] = [];
          if (agent.runId) subtitleParts.push(`run ${agent.runId}`);
          if (agent.taskId) subtitleParts.push(`task ${agent.taskId}`);
          const subtitle = subtitleParts.join(" · ");
          return (
            <li
              key={agent.agent}
              className="flex flex-col gap-0.5 px-3 py-1.5"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATE_DOT_CLASS[agent.state]}`}
                    aria-hidden
                  />
                  <span className="font-mono text-[12px] text-foreground/80">
                    {agent.agent}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {rel && (
                    <span className="font-mono text-[10px] text-muted-foreground/55">
                      {rel}
                    </span>
                  )}
                  <span
                    className={`font-mono text-[10px] uppercase tracking-wider ${STATE_LABEL_CLASS[agent.state]}`}
                  >
                    {agent.state}
                  </span>
                </div>
              </div>
              {(agent.lastMessage || subtitle) && (
                <div className="flex flex-col gap-0.5 pl-3.5">
                  {agent.lastMessage && (
                    <span className="truncate text-[10.5px] text-muted-foreground/70">
                      {agent.lastMessage}
                    </span>
                  )}
                  {subtitle && (
                    <span className="truncate font-mono text-[10px] text-muted-foreground/55">
                      {subtitle}
                    </span>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

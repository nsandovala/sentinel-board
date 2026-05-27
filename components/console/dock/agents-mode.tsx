"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, ChevronDown, ChevronRight, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

export type AgentStatus = "idle" | "running" | "success" | "error";
export type RunState = "running" | "done" | "error" | "unknown";

interface AgentSnapshot {
  agent: string;
  state: AgentStatus;
  lastEventType: string | null;
  lastMessage: string | null;
  lastTs: string | null;
  runId: string | null;
  taskId: string | null;
}

interface Finding {
  ts: string | null;
  level: "info" | "warn" | "error";
  message: string;
  category: string | null;
  findingId: string | null;
}

interface RunSnapshot {
  runId: string;
  command: string | null;
  agent: string | null;
  taskId: string | null;
  repo: string | null;
  startedAt: string | null;
  endedAt: string | null;
  state: RunState;
  level: "info" | "warn" | "error" | null;
  lastMessage: string | null;
  exitCode: number | null;
  eventCount: number;
  findings: {
    audit: Finding[];
    scan: Finding[];
    auditTotal: number;
    scanTotal: number;
  };
  push: { started: boolean; done: boolean; error: boolean };
}

interface RuntimeEventsResponse {
  ok: boolean;
  source: string;
  path?: string;
  configured?: boolean;
  exists: boolean;
  events: Array<unknown>;
  agents: AgentSnapshot[];
  runs: RunSnapshot[];
}

interface AgentsModeProps {
  expanded?: boolean;
}

const POLL_INTERVAL_MS = 3000;
const EVENTS_LIMIT = 200;

const RUN_DOT_CLASS: Record<RunState, string> = {
  running: "bg-amber-400/85 animate-pulse",
  done: "bg-emerald-400/80",
  error: "bg-red-400/85",
  unknown: "bg-muted-foreground/35",
};

const RUN_LABEL_CLASS: Record<RunState, string> = {
  running: "text-amber-300",
  done: "text-emerald-300/90",
  error: "text-red-300",
  unknown: "text-muted-foreground/55",
};

const LEVEL_TEXT_CLASS: Record<Finding["level"], string> = {
  info: "text-muted-foreground/75",
  warn: "text-amber-300/90",
  error: "text-red-300/90",
};

const KNOWN_COMMANDS = new Set([
  "doctor",
  "status",
  "audit",
  "scan",
  "run",
  "push",
  "watch",
]);

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

function shortRunId(runId: string): string {
  if (!runId) return "—";
  if (runId.length <= 12) return runId;
  // UUID-style → primeros 8, sino primeros 12.
  if (/^[0-9a-f-]{30,}$/i.test(runId)) return runId.slice(0, 8);
  return runId.slice(0, 12);
}

function commandLabel(run: RunSnapshot): string {
  if (run.command && KNOWN_COMMANDS.has(run.command)) return run.command;
  if (run.command) return run.command;
  if (run.agent) return "run";
  return "—";
}

function findingCount(run: RunSnapshot): number {
  return run.findings.auditTotal + run.findings.scanTotal;
}

export function AgentsMode(_props: AgentsModeProps) {
  const [runs, setRuns] = useState<RunSnapshot[]>([]);
  const [streamExists, setStreamExists] = useState<boolean | null>(null);
  const [streamPath, setStreamPath] = useState<string | null>(null);
  const [streamConfigured, setStreamConfigured] = useState<boolean | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [, setNow] = useState(Date.now());
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
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
        setStreamPath(typeof json.path === "string" ? json.path : null);
        setStreamConfigured(typeof json.configured === "boolean" ? json.configured : null);
        setRuns(Array.isArray(json.runs) ? json.runs : []);
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
      ? "conectando"
      : streamExists
        ? "event stream conectado"
        : "event stream pendiente";

  const badgeDotClass =
    streamExists === true
      ? "bg-emerald-400/80"
      : streamExists === false
        ? "bg-muted-foreground/40"
        : "bg-amber-400/70 animate-pulse";

  const showEmptyState = runs.length === 0;

  return (
    <div className="flex flex-col gap-2 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Bot className="h-3.5 w-3.5 text-muted-foreground/60" aria-hidden />
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70">
            agents runtime · últimas ejecuciones
          </span>
        </div>
        <span
          className="inline-flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground/55"
          title={streamPath ? `Origen NDJSON: ${streamPath}` : "Polling cada 3s"}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${badgeDotClass}`} aria-hidden />
          {badgeText}
          {lastError && <span className="text-red-300/70">· error</span>}
        </span>
      </div>

      {streamPath && (
        <p
          className="truncate font-mono text-[10px] text-muted-foreground/50"
          title={streamPath}
        >
          {streamConfigured === false && (
            <span className="text-amber-300/70">[fallback]</span>
          )}{" "}
          {streamPath}
        </p>
      )}

      {showEmptyState ? (
        <div className="rounded-md border border-white/[0.04] bg-[#151515] px-4 py-5">
          <p className="text-[12px] text-foreground/80">
            {streamExists === false
              ? "Aún no hay event stream de AMON Agents en disco."
              : "AMON Agents no ha emitido ejecuciones todavía."}
          </p>
          <p className="mt-1 text-[10.5px] leading-snug text-muted-foreground/65">
            Configura{" "}
            <code className="font-mono text-foreground/80">AMON_EVENTS_PATH</code>{" "}
            en{" "}
            <code className="font-mono text-foreground/80">.env.local</code> y
            ejecuta en AMON Agents:
          </p>
          <pre className="mt-2 rounded-sm bg-black/40 px-2 py-1.5 font-mono text-[11px] leading-snug text-foreground/85">
{`npm run amon -- scan --repo ../sentinel-board`}
          </pre>
          <p className="mt-1.5 text-[10px] leading-snug text-muted-foreground/55">
            Polling cada 3s — al detectar eventos, las ejecuciones aparecen aquí
            con su estado, runId, mensaje y findings.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col rounded-md border border-white/[0.04] bg-[#151515]">
          {runs.map((run, idx) => {
            const expanded = expandedRunId === run.runId;
            const rel = formatRelativeTs(run.endedAt ?? run.startedAt);
            const fcount = findingCount(run);
            const hasFindings = fcount > 0;

            return (
              <li
                key={run.runId}
                className={cn(
                  "flex flex-col",
                  idx > 0 && "border-t border-white/[0.03]",
                )}
              >
                <button
                  type="button"
                  onClick={() =>
                    setExpandedRunId(expanded ? null : run.runId)
                  }
                  disabled={!hasFindings && !run.agent}
                  className={cn(
                    "flex w-full items-center gap-3 px-3 py-2 text-left transition-colors",
                    (hasFindings || run.agent) && "hover:bg-white/[0.02]",
                    !(hasFindings || run.agent) && "cursor-default",
                  )}
                  aria-expanded={expanded}
                  aria-controls={`run-detail-${run.runId}`}
                >
                  {hasFindings || run.agent ? (
                    expanded ? (
                      <ChevronDown
                        className="h-3 w-3 shrink-0 text-muted-foreground/65"
                        aria-hidden
                      />
                    ) : (
                      <ChevronRight
                        className="h-3 w-3 shrink-0 text-muted-foreground/65"
                        aria-hidden
                      />
                    )
                  ) : (
                    <Activity
                      className="h-3 w-3 shrink-0 text-muted-foreground/40"
                      aria-hidden
                    />
                  )}

                  <span
                    className={cn(
                      "h-1.5 w-1.5 shrink-0 rounded-full",
                      RUN_DOT_CLASS[run.state],
                    )}
                    aria-hidden
                  />

                  <span className="font-mono text-[11.5px] uppercase tracking-wide text-foreground/85">
                    {commandLabel(run)}
                  </span>

                  <span className="font-mono text-[10px] text-muted-foreground/55">
                    {shortRunId(run.runId)}
                  </span>

                  <span className="mx-1 flex-1 self-center border-b border-dotted border-white/[0.06]" />

                  {hasFindings && (
                    <span
                      className="font-mono text-[10px] text-muted-foreground/65"
                      title={`${run.findings.auditTotal} audit · ${run.findings.scanTotal} scan`}
                    >
                      {fcount} finding{fcount === 1 ? "" : "s"}
                    </span>
                  )}

                  {rel && (
                    <span className="font-mono text-[10px] text-muted-foreground/50">
                      {rel}
                    </span>
                  )}

                  <span
                    className={cn(
                      "font-mono text-[10px] uppercase tracking-wider",
                      RUN_LABEL_CLASS[run.state],
                    )}
                  >
                    {run.state}
                  </span>
                </button>

                {run.lastMessage && (
                  <p className="truncate px-3 pb-1.5 pl-[3.25rem] text-[10.5px] text-muted-foreground/65">
                    {run.lastMessage}
                  </p>
                )}

                {expanded && (
                  <div
                    id={`run-detail-${run.runId}`}
                    className="border-t border-white/[0.03] bg-black/15 px-3 py-2"
                  >
                    <dl className="grid grid-cols-[6rem_1fr] gap-x-3 gap-y-0.5 font-mono text-[10px] text-muted-foreground/70">
                      <dt>runId</dt>
                      <dd
                        className="truncate text-foreground/80"
                        title={run.runId}
                      >
                        {run.runId}
                      </dd>
                      {run.taskId && (
                        <>
                          <dt>taskId</dt>
                          <dd className="truncate text-foreground/75">
                            {run.taskId}
                          </dd>
                        </>
                      )}
                      {run.repo && (
                        <>
                          <dt>repo</dt>
                          <dd className="truncate text-foreground/75">
                            {run.repo}
                          </dd>
                        </>
                      )}
                      {run.exitCode !== null && (
                        <>
                          <dt>exit</dt>
                          <dd className="text-foreground/75">{run.exitCode}</dd>
                        </>
                      )}
                      {run.startedAt && (
                        <>
                          <dt>started</dt>
                          <dd className="text-foreground/75">{run.startedAt}</dd>
                        </>
                      )}
                      {run.endedAt && run.endedAt !== run.startedAt && (
                        <>
                          <dt>last ts</dt>
                          <dd className="text-foreground/75">{run.endedAt}</dd>
                        </>
                      )}
                      <dt>events</dt>
                      <dd className="text-foreground/75">{run.eventCount}</dd>
                    </dl>

                    {run.findings.scanTotal > 0 && (
                      <details
                        open={run.findings.audit.length === 0}
                        className="mt-2"
                      >
                        <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-wide text-muted-foreground/75">
                          scan · {run.findings.scanTotal} finding
                          {run.findings.scanTotal === 1 ? "" : "s"}
                          {run.findings.scan.length < run.findings.scanTotal && (
                            <span className="ml-1 text-muted-foreground/45">
                              (mostrando {run.findings.scan.length})
                            </span>
                          )}
                        </summary>
                        <ul className="mt-1 space-y-0.5 pl-2">
                          {run.findings.scan.map((f, i) => (
                            <li
                              key={`${f.findingId}-${i}`}
                              className="flex items-baseline gap-2 text-[11px] leading-snug"
                            >
                              <span
                                className={cn(
                                  "shrink-0 font-mono text-[9px] uppercase",
                                  LEVEL_TEXT_CLASS[f.level],
                                )}
                              >
                                {f.level}
                              </span>
                              {f.category && (
                                <span className="shrink-0 font-mono text-[9px] text-muted-foreground/55">
                                  [{f.category}]
                                </span>
                              )}
                              <span className="text-foreground/80">
                                {f.message}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}

                    {run.findings.auditTotal > 0 && (
                      <details
                        open={run.findings.scanTotal === 0}
                        className="mt-2"
                      >
                        <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-wide text-muted-foreground/75">
                          audit · {run.findings.auditTotal} finding
                          {run.findings.auditTotal === 1 ? "" : "s"}
                          {run.findings.audit.length < run.findings.auditTotal && (
                            <span className="ml-1 text-muted-foreground/45">
                              (mostrando {run.findings.audit.length})
                            </span>
                          )}
                        </summary>
                        <ul className="mt-1 space-y-0.5 pl-2">
                          {run.findings.audit.map((f, i) => (
                            <li
                              key={`${f.findingId}-${i}`}
                              className="flex items-baseline gap-2 text-[11px] leading-snug"
                            >
                              <span
                                className={cn(
                                  "shrink-0 font-mono text-[9px] uppercase",
                                  LEVEL_TEXT_CLASS[f.level],
                                )}
                              >
                                {f.level}
                              </span>
                              {f.category && (
                                <span className="shrink-0 font-mono text-[9px] text-muted-foreground/55">
                                  [{f.category}]
                                </span>
                              )}
                              <span className="text-foreground/80">
                                {f.message}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}

                    {(run.push.started || run.push.done || run.push.error) && (
                      <div className="mt-2 font-mono text-[10px] text-muted-foreground/70">
                        sb.push:
                        {run.push.started && (
                          <span className="ml-1 text-amber-300/80">started</span>
                        )}
                        {run.push.done && (
                          <span className="ml-1 text-emerald-300/80">done</span>
                        )}
                        {run.push.error && (
                          <span className="ml-1 text-red-300/85">error</span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

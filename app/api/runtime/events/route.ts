/**
 * GET /api/runtime/events
 *
 * Lee `outputs/events.jsonl` de AMON Agents y devuelve:
 *   - events:  últimas N líneas normalizadas (newest-first)
 *   - runs:    agrupado por runId — un run por ejecución de comando (doctor /
 *              status / audit / scan / run / push) con su estado derivado y
 *              findings asociados (audit.finding / scan.finding).
 *   - agents:  snapshot del pipeline `run` (planner/state-guardian/qa/scorer).
 *
 * Solo lectura. No ejecuta comandos, no abre shell, no abre sockets.
 * Polling es la única integración soportada hoy.
 */
import { NextRequest, NextResponse } from "next/server";
import { open, stat } from "node:fs/promises";
import path from "node:path";

import { rejectIfUnauthorized } from "@/lib/server/request-guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;
const MIN_LIMIT = 1;
const TAIL_CHUNK_BYTES = 128 * 1024;
const MAX_TAIL_BYTES = 1024 * 1024;
const MAX_FINDINGS_PER_RUN = 30;
const MAX_RUNS = 40;

const TRACKED_AGENTS = [
  "planner",
  "state-guardian",
  "qa-reviewer",
  "scorer",
] as const;

type TrackedAgent = (typeof TRACKED_AGENTS)[number];
type AgentState = "idle" | "running" | "success" | "error";
export type RunState = "running" | "done" | "error" | "unknown";

interface RawPayload {
  command?: unknown;
  repo?: unknown;
  exitCode?: unknown;
  category?: unknown;
  findingId?: unknown;
  detail?: unknown;
}

interface RawEvent {
  id?: unknown;
  ts?: unknown;
  runId?: unknown;
  taskId?: unknown;
  agent?: unknown;
  type?: unknown;
  level?: unknown;
  message?: unknown;
  source?: unknown;
  consumer?: unknown;
  payload?: unknown;
}

interface NormalizedEvent {
  id: string | null;
  ts: string | null;
  runId: string | null;
  taskId: string | null;
  agent: string | null;
  type: string | null;
  level: string | null;
  message: string | null;
  source: string | null;
  consumer: string | null;
  payload: RawPayload | null;
}

interface AgentSnapshot {
  agent: TrackedAgent;
  state: AgentState;
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

function resolveEventsPath(): { path: string; configured: boolean } {
  const fromEnv = process.env.AMON_EVENTS_PATH?.trim();
  if (fromEnv) {
    return { path: path.resolve(fromEnv), configured: true };
  }
  const fallback = path.resolve(process.cwd(), "..", "amon-agents", "outputs", "events.jsonl");
  return { path: fallback, configured: false };
}

function asString(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

function asPayload(value: unknown): RawPayload | null {
  if (!value || typeof value !== "object") return null;
  return value as RawPayload;
}

function normalizeEvent(raw: RawEvent): NormalizedEvent {
  return {
    id: asString(raw.id),
    ts: asString(raw.ts),
    runId: asString(raw.runId),
    taskId: asString(raw.taskId),
    agent: asString(raw.agent),
    type: asString(raw.type),
    level: asString(raw.level),
    message: asString(raw.message),
    source: asString(raw.source),
    consumer: asString(raw.consumer),
    payload: asPayload(raw.payload),
  };
}

function isTrackedAgent(value: string | null): value is TrackedAgent {
  return value !== null && (TRACKED_AGENTS as readonly string[]).includes(value);
}

function deriveAgentState(eventType: string | null): AgentState | null {
  if (!eventType) return null;
  switch (eventType) {
    case "agent.started":
      return "running";
    case "agent.done":
      return "success";
    case "agent.error":
      return "error";
    default:
      return null;
  }
}

function clampLevel(value: string | null): "info" | "warn" | "error" {
  if (value === "warn" || value === "error") return value;
  return "info";
}

function buildAgentSnapshots(events: NormalizedEvent[]): AgentSnapshot[] {
  // events arrive newest-first; first match wins per agent.
  const byAgent = new Map<TrackedAgent, AgentSnapshot>();

  for (const ev of events) {
    if (!isTrackedAgent(ev.agent)) continue;
    const state = deriveAgentState(ev.type);
    if (state === null) continue;
    if (byAgent.has(ev.agent)) continue;
    byAgent.set(ev.agent, {
      agent: ev.agent,
      state,
      lastEventType: ev.type,
      lastMessage: ev.message,
      lastTs: ev.ts,
      runId: ev.runId,
      taskId: ev.taskId,
    });
  }

  return TRACKED_AGENTS.map((agent) => {
    const existing = byAgent.get(agent);
    if (existing) return existing;
    return {
      agent,
      state: "idle" as AgentState,
      lastEventType: null,
      lastMessage: null,
      lastTs: null,
      runId: null,
      taskId: null,
    };
  });
}

function tsCompareAsc(a: string | null, b: string | null): number {
  const av = a ? Date.parse(a) : 0;
  const bv = b ? Date.parse(b) : 0;
  return av - bv;
}

function ensureRun(map: Map<string, RunSnapshot>, runId: string): RunSnapshot {
  let run = map.get(runId);
  if (run) return run;
  run = {
    runId,
    command: null,
    agent: null,
    taskId: null,
    repo: null,
    startedAt: null,
    endedAt: null,
    state: "unknown",
    level: null,
    lastMessage: null,
    exitCode: null,
    eventCount: 0,
    findings: { audit: [], scan: [], auditTotal: 0, scanTotal: 0 },
    push: { started: false, done: false, error: false },
  };
  map.set(runId, run);
  return run;
}

function applyEventToRun(run: RunSnapshot, ev: NormalizedEvent): void {
  run.eventCount += 1;

  // taskId/agent/repo are sticky once observed.
  if (!run.taskId && ev.taskId) run.taskId = ev.taskId;
  if (!run.agent && ev.agent) run.agent = ev.agent;
  if (!run.repo && ev.payload?.repo && typeof ev.payload.repo === "string") {
    run.repo = ev.payload.repo;
  }
  if (!run.command && ev.payload?.command && typeof ev.payload.command === "string") {
    run.command = ev.payload.command;
  }
  // Derive command from event type when payload didn't carry it (older lines).
  if (!run.command) {
    if (ev.type === "run.started" || ev.type === "run.done") run.command = "run";
    else if (ev.type?.startsWith("sb.push.")) run.command = run.command ?? "push";
  }

  // Track latest message/ts.
  if (ev.ts) {
    if (!run.startedAt || tsCompareAsc(ev.ts, run.startedAt) < 0) run.startedAt = ev.ts;
  }
  // Always treat the most recent (by ts) as the run's surface state.
  if (!run.endedAt || tsCompareAsc(run.endedAt, ev.ts) <= 0) {
    run.endedAt = ev.ts;
    run.lastMessage = ev.message;
    run.level = clampLevel(ev.level);
  }

  // State transitions.
  switch (ev.type) {
    case "command.started":
    case "agent.started":
    case "run.started":
    case "sb.push.started":
      if (run.state === "unknown" || run.state === "running") {
        run.state = "running";
      }
      if (ev.type === "sb.push.started") run.push.started = true;
      break;
    case "command.done":
    case "run.done":
      if (run.state !== "error") run.state = "done";
      if (typeof ev.payload?.exitCode === "number") {
        run.exitCode = ev.payload.exitCode;
        if (ev.payload.exitCode !== 0) run.state = "error";
      }
      break;
    case "sb.push.done":
      run.push.done = true;
      break;
    case "command.error":
    case "agent.error":
    case "sb.push.error":
      run.state = "error";
      if (ev.type === "sb.push.error") run.push.error = true;
      break;
    case "audit.finding": {
      run.command = run.command ?? "audit";
      run.findings.auditTotal += 1;
      if (run.findings.audit.length < MAX_FINDINGS_PER_RUN) {
        run.findings.audit.push({
          ts: ev.ts,
          level: clampLevel(ev.level),
          message: ev.message ?? "",
          category: asString(ev.payload?.category) ?? null,
          findingId: asString(ev.payload?.findingId) ?? null,
        });
      }
      break;
    }
    case "scan.finding": {
      run.command = run.command ?? "scan";
      run.findings.scanTotal += 1;
      if (run.findings.scan.length < MAX_FINDINGS_PER_RUN) {
        run.findings.scan.push({
          ts: ev.ts,
          level: clampLevel(ev.level),
          message: ev.message ?? "",
          category: asString(ev.payload?.category) ?? null,
          findingId: asString(ev.payload?.findingId) ?? null,
        });
      }
      break;
    }
    default:
      break;
  }
}

function buildRunSnapshots(events: NormalizedEvent[]): RunSnapshot[] {
  // Process oldest-first so startedAt/endedAt are accurate.
  const ordered = [...events].sort((a, b) => tsCompareAsc(a.ts, b.ts));
  const byRun = new Map<string, RunSnapshot>();

  for (const ev of ordered) {
    if (!ev.runId) continue;
    const run = ensureRun(byRun, ev.runId);
    applyEventToRun(run, ev);
  }

  // Sort findings inside each run by ts asc (insertion order preserves this).
  for (const run of byRun.values()) {
    if (!run.command && run.agent) run.command = "run";

    // AMON Agents emits two runIds per `audit`/`scan`: the CLI envelope
    // (`command.*`) and the command-internal id that carries
    // `audit.finding` / `scan.finding`. The child run never receives a
    // `command.done` so it stays `unknown`. If findings exist and no error
    // was observed, derive `done` — the work completed by definition of
    // having emitted findings.
    if (
      run.state === "unknown" &&
      (run.findings.auditTotal > 0 || run.findings.scanTotal > 0)
    ) {
      run.state = "done";
    }
  }

  // Newest run on top.
  const runs = Array.from(byRun.values()).sort((a, b) => -tsCompareAsc(a.endedAt, b.endedAt));
  return runs.slice(0, MAX_RUNS);
}

async function tailNdjson(filePath: string, maxLines: number): Promise<NormalizedEvent[]> {
  const info = await stat(filePath);
  if (!info.isFile() || info.size === 0) return [];

  const targetBytes = Math.min(
    Math.max(TAIL_CHUNK_BYTES, maxLines * 2048),
    MAX_TAIL_BYTES,
    info.size,
  );

  const handle = await open(filePath, "r");
  try {
    const buf = Buffer.alloc(targetBytes);
    const start = info.size - targetBytes;
    await handle.read(buf, 0, targetBytes, start);
    const text = buf.toString("utf8");

    const rawLines = text.split(/\r?\n/);
    const lines = start > 0 && rawLines.length > 1 ? rawLines.slice(1) : rawLines;

    const events: NormalizedEvent[] = [];
    for (let i = lines.length - 1; i >= 0 && events.length < maxLines; i--) {
      const line = lines[i].trim();
      if (!line) continue;
      try {
        const parsed = JSON.parse(line) as RawEvent;
        if (parsed && typeof parsed === "object") {
          events.push(normalizeEvent(parsed));
        }
      } catch {
        // Ignore malformed NDJSON line.
      }
    }
    return events;
  } finally {
    await handle.close();
  }
}

function parseLimit(raw: string | null): number {
  if (!raw) return DEFAULT_LIMIT;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return DEFAULT_LIMIT;
  if (n < MIN_LIMIT) return MIN_LIMIT;
  if (n > MAX_LIMIT) return MAX_LIMIT;
  return n;
}

export async function GET(req: NextRequest) {
  const denied = rejectIfUnauthorized(req);
  if (denied) return denied;

  const limit = parseLimit(req.nextUrl.searchParams.get("limit"));
  const { path: filePath, configured } = resolveEventsPath();
  const pathLabel = configured ? path.basename(filePath) : "configured path";

  let exists = false;
  let events: NormalizedEvent[] = [];

  try {
    const info = await stat(filePath);
    exists = info.isFile();
    if (exists) {
      events = await tailNdjson(filePath, limit);
    }
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT") {
      exists = false;
    } else {
      return NextResponse.json(
        {
          ok: false,
          source: "ndjson",
          path: filePath,
          configured,
          exists: false,
          events: [],
          agents: buildAgentSnapshots([]),
          runs: [],
          error: `Cannot read ${pathLabel}`,
        },
        { status: 500 },
      );
    }
  }

  const agents = buildAgentSnapshots(events);
  const runs = buildRunSnapshots(events);

  return NextResponse.json({
    ok: true,
    source: "ndjson",
    path: filePath,
    configured,
    exists,
    events,
    agents,
    runs,
  });
}

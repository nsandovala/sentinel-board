import { NextRequest, NextResponse } from "next/server";
import { open, stat } from "node:fs/promises";
import path from "node:path";

import { rejectIfUnauthorized } from "@/lib/server/request-guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;
const MIN_LIMIT = 1;
const TAIL_CHUNK_BYTES = 64 * 1024;
const MAX_TAIL_BYTES = 512 * 1024;

const TRACKED_AGENTS = [
  "planner",
  "state-guardian",
  "qa-reviewer",
  "scorer",
] as const;

type TrackedAgent = (typeof TRACKED_AGENTS)[number];
type AgentState = "idle" | "running" | "success" | "error";

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

function buildAgentSnapshots(events: NormalizedEvent[]): AgentSnapshot[] {
  const byAgent = new Map<TrackedAgent, AgentSnapshot>();

  for (const ev of events) {
    if (!isTrackedAgent(ev.agent)) continue;
    const state = deriveAgentState(ev.type);
    if (state === null) continue;
    const prev = byAgent.get(ev.agent);
    if (prev) continue; // first match wins (events are newest-first)
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

    // If we did not read from the beginning, drop the first (likely partial) line.
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
          exists: false,
          events: [],
          agents: buildAgentSnapshots([]),
          error: `Cannot read ${pathLabel}`,
        },
        { status: 500 },
      );
    }
  }

  const agents = buildAgentSnapshots(events);

  return NextResponse.json({
    ok: true,
    source: "ndjson",
    exists,
    events,
    agents,
  });
}

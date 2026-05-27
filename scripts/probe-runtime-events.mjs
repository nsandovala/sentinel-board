/**
 * scripts/probe-runtime-events.mjs
 *
 * Smoke test ad-hoc: lee el events.jsonl real de AMON Agents y reproduce
 * el agrupado por runId del endpoint /api/runtime/events sin levantar el
 * server Next. Útil para verificar que la lógica de runs/findings coincide
 * con el stream emitido por AA hoy.
 *
 * Uso:
 *   node scripts/probe-runtime-events.mjs
 *   AMON_EVENTS_PATH=... node scripts/probe-runtime-events.mjs
 */
import { readFileSync, statSync } from "node:fs";
import path from "node:path";

const filePath =
  process.env.AMON_EVENTS_PATH?.trim() ||
  path.resolve(process.cwd(), "..", "amon-agents", "outputs", "events.jsonl");

const exists = (() => {
  try {
    return statSync(filePath).isFile();
  } catch {
    return false;
  }
})();

if (!exists) {
  console.log(JSON.stringify({ ok: true, exists: false, path: filePath, runs: [] }, null, 2));
  process.exit(0);
}

const text = readFileSync(filePath, "utf8");
const events = [];
for (const line of text.split(/\r?\n/)) {
  if (!line.trim()) continue;
  try { events.push(JSON.parse(line)); } catch { /* skip */ }
}

const KNOWN = new Set(["doctor", "status", "audit", "scan", "run", "push", "watch"]);
const runs = new Map();

const ordered = events.sort((a, b) => Date.parse(a.ts ?? 0) - Date.parse(b.ts ?? 0));

for (const ev of ordered) {
  if (!ev.runId) continue;
  let r = runs.get(ev.runId);
  if (!r) {
    r = {
      runId: ev.runId,
      command: null, agent: null, taskId: null, repo: null,
      startedAt: null, endedAt: null,
      state: "unknown", level: null, lastMessage: null, exitCode: null,
      eventCount: 0,
      findings: { audit: [], scan: [], auditTotal: 0, scanTotal: 0 },
      push: { started: false, done: false, error: false },
    };
    runs.set(ev.runId, r);
  }
  r.eventCount++;
  if (!r.command && ev.payload?.command) r.command = ev.payload.command;
  if (!r.command && (ev.type === "run.started" || ev.type === "run.done")) r.command = "run";
  if (!r.agent && ev.agent) r.agent = ev.agent;
  if (!r.taskId && ev.taskId) r.taskId = ev.taskId;
  if (!r.repo && ev.payload?.repo) r.repo = ev.payload.repo;
  if (!r.startedAt || (ev.ts && Date.parse(ev.ts) < Date.parse(r.startedAt))) r.startedAt = ev.ts;
  if (!r.endedAt || (ev.ts && Date.parse(ev.ts) >= Date.parse(r.endedAt))) {
    r.endedAt = ev.ts;
    r.lastMessage = ev.message ?? null;
    r.level = ev.level ?? null;
  }
  switch (ev.type) {
    case "command.started": case "agent.started": case "run.started": case "sb.push.started":
      if (r.state === "unknown" || r.state === "running") r.state = "running";
      if (ev.type === "sb.push.started") r.push.started = true;
      break;
    case "command.done": case "run.done":
      if (r.state !== "error") r.state = "done";
      if (typeof ev.payload?.exitCode === "number") {
        r.exitCode = ev.payload.exitCode;
        if (ev.payload.exitCode !== 0) r.state = "error";
      }
      break;
    case "sb.push.done": r.push.done = true; break;
    case "command.error": case "agent.error": case "sb.push.error":
      r.state = "error";
      if (ev.type === "sb.push.error") r.push.error = true;
      break;
    case "audit.finding":
      r.command = r.command ?? "audit";
      r.findings.auditTotal++;
      if (r.findings.audit.length < 30) r.findings.audit.push({
        ts: ev.ts, level: ev.level, message: ev.message,
        category: ev.payload?.category ?? null, findingId: ev.payload?.findingId ?? null,
      });
      break;
    case "scan.finding":
      r.command = r.command ?? "scan";
      r.findings.scanTotal++;
      if (r.findings.scan.length < 30) r.findings.scan.push({
        ts: ev.ts, level: ev.level, message: ev.message,
        category: ev.payload?.category ?? null, findingId: ev.payload?.findingId ?? null,
      });
      break;
  }
}

const runsArr = [...runs.values()].sort((a, b) => Date.parse(b.endedAt ?? 0) - Date.parse(a.endedAt ?? 0));
console.log(JSON.stringify({
  ok: true, exists: true, path: filePath, configured: !!process.env.AMON_EVENTS_PATH,
  totalEvents: events.length, totalRuns: runsArr.length,
  runs: runsArr.slice(0, 6),
}, null, 2));

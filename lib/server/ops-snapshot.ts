/** Safe, evidence-based projection of AMON's loopback operational snapshot. */
export type OpsState = "working" | "waiting_human" | "blocked" | "stale" | "offline" | "available";

export interface SafeOpsSnapshot {
  status: "connected" | "degraded" | "offline";
  observedAt: string | null;
  worker: { id: string; state: OpsState; heartbeat: string | null } | null;
  agents: Array<{ id: "jarvis" | "claudio" | "guardian"; state: OpsState }>;
  jobs: Array<{ id: string; action: string; status: string; startedAt: string | null; finishedAt: string | null; verdict: string | null; humanReview: boolean }>;
  reviews: Array<{ id: string; jobId: string; verdict: string; reviewedAt: string; findings: number }>;
}

const HEARTBEAT_STALE_MS = 20_000; // AA defaults to one heartbeat every 5 seconds.
const JOB_STALE_MS = 10 * 60_000;
const VERDICTS = new Set(["PASS", "WARN", "BLOCKED", "HUMAN_REVIEW"]);
const JOB_STATUSES = new Set(["queued", "running", "done", "failed"]);

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function safeId(value: unknown): string | null {
  return typeof value === "string" && /^[a-zA-Z0-9._:-]{1,100}$/.test(value) ? value : null;
}
function timestamp(value: unknown, now: number): string | null {
  if (typeof value !== "string") return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && parsed <= now + 5_000 ? new Date(parsed).toISOString() : null;
}
function age(value: string | null, now: number): number {
  return value ? Math.max(0, now - Date.parse(value)) : Infinity;
}

export function offlineSnapshot(): SafeOpsSnapshot {
  return { status: "offline", observedAt: null, worker: null,
    agents: ["jarvis", "claudio", "guardian"].map(id => ({ id: id as "jarvis" | "claudio" | "guardian", state: "offline" })),
    jobs: [], reviews: [] };
}

export function normalizeOpsSnapshot(input: unknown, now = Date.now()): SafeOpsSnapshot {
  const raw = record(input);
  if (!raw || !Array.isArray(raw.workers) || !Array.isArray(raw.jobs) || !Array.isArray(raw.guardianReviews) ||
      (raw.systemStatus !== "ok" && raw.systemStatus !== "degraded")) throw new Error("invalid_snapshot");

  const workerRaw = record(raw.workers[0]);
  const workerId = safeId(workerRaw?.workerId);
  const heartbeat = timestamp(workerRaw?.lastHeartbeat, now);
  const workerLive = Boolean(workerId && workerRaw?.status === "online" && age(heartbeat, now) <= HEARTBEAT_STALE_MS);
  const workerState: OpsState = !workerId || workerRaw?.status === "offline" ? "offline" : workerLive ? "available" : "stale";

  const reviews = raw.guardianReviews.flatMap(value => {
    const item = record(value);
    const id = safeId(item?.reviewId), jobId = safeId(item?.workerJobId);
    const reviewedAt = timestamp(item?.reviewedAt, now);
    if (!id || !jobId || !reviewedAt || !VERDICTS.has(item?.verdict as string)) return [];
    return [{ id, jobId, verdict: item!.verdict as string, reviewedAt,
      findings: Number.isSafeInteger(item?.findingsCount) && (item!.findingsCount as number) >= 0 ? item!.findingsCount as number : 0 }];
  }).sort((a, b) => b.reviewedAt.localeCompare(a.reviewedAt)).slice(0, 30);
  const latestReview = new Map<string, (typeof reviews)[number]>();
  for (const review of reviews) if (!latestReview.has(review.jobId)) latestReview.set(review.jobId, review);

  const jobs = raw.jobs.flatMap(value => {
    const item = record(value);
    const id = safeId(item?.jobId), action = safeId(item?.action);
    if (!id || !action || !JOB_STATUSES.has(item?.status as string)) return [];
    const startedAt = timestamp(item?.startedAt, now), finishedAt = timestamp(item?.finishedAt, now);
    const review = latestReview.get(id);
    return [{ id, action, status: item!.status as string, startedAt, finishedAt,
      verdict: review?.verdict ?? null, humanReview: review ? review.verdict === "HUMAN_REVIEW" : item?.requiresHumanReview === true }];
  }).sort((a, b) => (b.finishedAt ?? b.startedAt ?? "").localeCompare(a.finishedAt ?? a.startedAt ?? "")).slice(0, 30);

  const latest = jobs[0];
  const active = latest?.status === "running" || latest?.status === "queued";
  const jobStale = active && age(latest.startedAt, now) > JOB_STALE_MS;
  const current = latest && age(latest.finishedAt ?? latest.startedAt, now) <= JOB_STALE_MS;
  const claudio: OpsState = !latest ? "offline" : jobStale ? "stale" :
    current && latest.verdict === "BLOCKED" ? "blocked" :
    current && latest.humanReview ? "waiting_human" :
    active && workerLive ? "working" : workerLive ? "available" : "stale";
  const jarvis: OpsState = !workerId ? "offline" : !workerLive ? workerState : active && !jobStale ? "working" : "available";
  const guardian: OpsState = !workerId ? "offline" : !workerLive ? workerState :
    current && latest?.verdict === "BLOCKED" ? "blocked" : "available";
  return { status: raw.systemStatus === "degraded" ? "degraded" : workerLive ? "connected" : "offline",
    observedAt: timestamp(raw.generatedAt, now),
    worker: workerId ? { id: workerId, state: workerState === "available" && active && !jobStale ? "working" : workerState, heartbeat } : null,
    agents: [{ id: "jarvis", state: jarvis }, { id: "claudio", state: claudio }, { id: "guardian", state: guardian }], jobs, reviews };
}

export function opsUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" || !["127.0.0.1", "[::1]"].includes(url.hostname) ||
        url.username || url.password || url.pathname !== "/api/ops/snapshot" || url.search || url.hash || !url.port) return null;
    return url.toString();
  } catch { return null; }
}

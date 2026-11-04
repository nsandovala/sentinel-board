import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeOpsSnapshot, offlineSnapshot, opsUrl } from "./ops-snapshot";

const now = Date.parse("2026-10-10T00:00:10Z");
const sample = () => ({
  generatedAt: "2026-10-10T00:00:10Z", systemStatus: "ok",
  workers: [{ workerId: "worker-1", status: "online", lastHeartbeat: "2026-10-10T00:00:05Z", workspace: { root: "/secret/workspace" } }],
  jobs: [{ jobId: "JOB-1", action: "run_coding_tool", status: "running", startedAt: "2026-10-10T00:00:02Z", repo: "/secret/repo", worktreePath: "/secret/worktree", requiresHumanReview: false }],
  guardianReviews: [] as Array<{ reviewId: string; workerJobId: string; verdict: string; reviewedAt: string; findingsCount: number }>, agents: [],
});

test("normalizes current worker and running job without leaking paths", () => {
  const result = normalizeOpsSnapshot(sample(), now);
  assert.equal(result.status, "connected");
  assert.equal(result.worker?.state, "working");
  assert.equal(result.agents[0].state, "working");
  assert.equal(result.agents[1].state, "working");
  assert.doesNotMatch(JSON.stringify(result), /secret|repo|worktreePath|workspace/);
});

test("a missing, old, or future heartbeat never means online", () => {
  const missing = sample(); missing.workers = [];
  assert.equal(normalizeOpsSnapshot(missing, now).status, "offline");
  const old = sample(); old.workers[0].lastHeartbeat = "2026-10-09T23:59:00Z";
  assert.equal(normalizeOpsSnapshot(old, now).worker?.state, "stale");
  const future = sample(); future.workers[0].lastHeartbeat = "2026-10-11T00:00:00Z";
  assert.equal(normalizeOpsSnapshot(future, now).worker?.state, "stale");
});

test("latest job verdict decides; old blocked review does not poison a newer job", () => {
  const raw = sample();
  raw.jobs = [
    { ...raw.jobs[0], jobId: "JOB-OLD", status: "done", startedAt: "2026-10-10T00:00:01Z" },
    { ...raw.jobs[0], jobId: "JOB-NEW", status: "running", startedAt: "2026-10-10T00:00:08Z" },
  ];
  raw.guardianReviews = [{ reviewId: "REVIEW-OLD", workerJobId: "JOB-OLD", verdict: "BLOCKED", reviewedAt: "2026-10-10T00:00:09Z", findingsCount: 1 }];
  assert.equal(normalizeOpsSnapshot(raw, now).agents[1].state, "working");
  raw.guardianReviews.push({ reviewId: "REVIEW-NEW", workerJobId: "JOB-NEW", verdict: "HUMAN_REVIEW", reviewedAt: "2026-10-10T00:00:10Z", findingsCount: 0 });
  assert.equal(normalizeOpsSnapshot(raw, now).agents[1].state, "waiting_human");
  raw.guardianReviews[1].verdict = "BLOCKED";
  assert.equal(normalizeOpsSnapshot(raw, now).agents[1].state, "blocked");
  raw.jobs[1].requiresHumanReview = true;
  raw.guardianReviews[1].verdict = "PASS";
  assert.equal(normalizeOpsSnapshot(raw, now).jobs[0].humanReview, false);
});

test("stale running job and empty snapshot fail closed", () => {
  const raw = sample(); raw.jobs[0].startedAt = "2026-10-09T23:00:00Z";
  assert.equal(normalizeOpsSnapshot(raw, now).agents[1].state, "stale");
  raw.jobs = []; raw.guardianReviews = [];
  assert.equal(normalizeOpsSnapshot(raw, now).agents[1].state, "offline");
  assert.equal(offlineSnapshot().jobs.length, 0);
  assert.throws(() => normalizeOpsSnapshot({ jobs: [] }, now), /invalid_snapshot/);
});

test("only an exact loopback snapshot URL is accepted", () => {
  assert.equal(opsUrl("http://127.0.0.1:4785/api/ops/snapshot"), "http://127.0.0.1:4785/api/ops/snapshot");
  for (const value of ["http://localhost:4785/api/ops/snapshot", "http://example.com/api/ops/snapshot", "http://127.0.0.1:4785/evil", "http://127.0.0.1:4785/api/ops/snapshot?x=1", "http://user:pass@127.0.0.1:4785/api/ops/snapshot"]) assert.equal(opsUrl(value), null);
});

function reviewHistory(verdict: string) {
  const raw = sample();
  raw.guardianReviews = [
    { reviewId: "TARGET", workerJobId: "JOB-1", verdict,
      reviewedAt: new Date(now - 8_000).toISOString(), findingsCount: 1 },
    ...Array.from({ length: 31 }, (_, index) => ({
      reviewId: `OTHER-${index}`, workerJobId: `OTHER-JOB-${index}`, verdict: "PASS",
      reviewedAt: new Date(now - index * 100).toISOString(), findingsCount: 0,
    })),
  ];
  return raw;
}

for (const verdict of ["BLOCKED", "HUMAN_REVIEW"]) {
  test(`${verdict} survives 31 newer reviews of other jobs`, () => {
    const result = normalizeOpsSnapshot(reviewHistory(verdict), now);
    assert.equal(result.jobs[0].verdict, verdict);
    assert.equal(result.jobs[0].humanReview, verdict === "HUMAN_REVIEW");
    assert.equal(result.agents[1].state, verdict === "BLOCKED" ? "blocked" : "waiting_human");
    assert.equal(result.agents[2].state, verdict === "BLOCKED" ? "blocked" : "available");
    assert.equal(result.reviews.length, 30);
    assert.ok(result.reviews.every(review => review.jobId !== "JOB-1"));
    assert.equal(result.reviews[0].id, "OTHER-0");
    assert.equal(result.reviews[29].id, "OTHER-29");
  });

  test(`a later PASS replaces ${verdict} even outside visible history`, () => {
    const raw = reviewHistory(verdict);
    raw.jobs[0].requiresHumanReview = true;
    raw.guardianReviews.unshift({ reviewId: "LATER", workerJobId: "JOB-1", verdict: "PASS",
      reviewedAt: new Date(now - 7_000).toISOString(), findingsCount: 0 });
    const result = normalizeOpsSnapshot(raw, now);
    assert.equal(result.jobs[0].verdict, "PASS");
    assert.equal(result.jobs[0].humanReview, false);
    assert.equal(result.agents[1].state, "working");
    assert.equal(result.agents[2].state, "available");
    assert.equal(result.reviews.length, 30);
    assert.ok(result.reviews.every(review => review.jobId !== "JOB-1"));
  });
}

test("invalid reviews cannot replace a valid verdict outside visible history", () => {
  const raw = reviewHistory("BLOCKED");
  for (const [index, override] of [
    { reviewedAt: "invalid" },
    { reviewedAt: new Date(now + 5_001).toISOString() },
    { verdict: "UNRECOGNIZED" },
    { reviewId: "unsafe/id" },
  ].entries()) {
    raw.guardianReviews.push({ reviewId: `INVALID-${index}`, workerJobId: "JOB-1",
      verdict: "PASS", reviewedAt: new Date(now).toISOString(), findingsCount: 0, ...override });
  }
  assert.equal(normalizeOpsSnapshot(raw, now).jobs[0].verdict, "BLOCKED");
});

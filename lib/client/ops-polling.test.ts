import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import type { SafeOpsSnapshot } from "../server/ops-snapshot";
import { startOpsPolling } from "./ops-polling";

const epoch = Date.parse("2026-10-10T00:00:10Z");
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const snapshot = (): SafeOpsSnapshot => ({
  status: "connected", observedAt: new Date(Date.now()).toISOString(),
  worker: { id: "worker-1", state: "working", heartbeat: new Date(Date.now()).toISOString() },
  agents: [{ id: "jarvis", state: "working" }, { id: "claudio", state: "working" },
    { id: "guardian", state: "available" }], jobs: [], reviews: [],
});
const response = (data = snapshot()) => new Response(JSON.stringify(data));
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function harness(t: TestContext, fetcher: typeof fetch) {
  t.mock.timers.enable({ apis: ["Date", "setTimeout", "setInterval"], now: epoch });
  const updates: Array<SafeOpsSnapshot | null> = [];
  const signals: AbortSignal[] = [];
  const stop = startOpsPolling(value => updates.push(value), (url, init) => {
    assert.equal(url, "/api/runtime/ops");
    assert.equal(init?.cache, "no-store");
    signals.push(init!.signal as AbortSignal);
    return fetcher(url, init);
  });
  t.after(stop);
  return { updates, signals, stop };
}

for (const phase of ["fetch", "json"] as const) {
  test(`${phase} hang: connected -> offline within 5s -> recovery; late result ignored`, async t => {
    const headers = deferred<Response>();
    const body = deferred<SafeOpsSnapshot>();
    let calls = 0;
    const h = harness(t, async () => {
      calls++;
      if (calls !== 2) return response();
      if (phase === "fetch") return headers.promise;
      const result = response();
      result.json = () => body.promise;
      return result;
    });
    await flush();
    const old = snapshot();
    assert.equal(h.updates.at(-1)?.status, "connected");
    t.mock.timers.tick(3_000); await flush();
    assert.equal(calls, 2);
    t.mock.timers.tick(1_999); await flush();
    assert.equal(h.signals[1].aborted, false);
    t.mock.timers.tick(1); await flush();
    assert.equal(Date.now() - epoch, 5_000);
    assert.equal(h.signals[1].aborted, true);
    assert.equal(h.updates.at(-1), null);
    t.mock.timers.tick(1_000); await flush();
    assert.equal(calls, 3);
    assert.equal(h.updates.at(-1)?.status, "connected");
    const count = h.updates.length;
    headers.resolve(response(old)); body.resolve(old); await flush();
    assert.equal(h.updates.length, count);
    t.mock.timers.tick(3_000); await flush();
    assert.equal(calls, 4);
  });

  test(`unmount aborts active ${phase}, stops polling and ignores late completion`, async t => {
    const headers = deferred<Response>();
    const body = deferred<SafeOpsSnapshot>();
    let calls = 0;
    const h = harness(t, async () => {
      calls++;
      if (phase === "fetch") return headers.promise;
      const result = response(); result.json = () => body.promise; return result;
    });
    await flush(); h.stop();
    assert.equal(h.signals[0].aborted, true);
    headers.resolve(response()); body.resolve(snapshot()); await flush();
    t.mock.timers.tick(30_000); await flush();
    assert.equal(calls, 1);
    assert.deepEqual(h.updates, []);
  });
}

test("old rejection cannot clear a newer in-flight request or its timeout", async t => {
  const first = deferred<Response>(), second = deferred<Response>();
  let calls = 0;
  const h = harness(t, async () => ++calls === 1 ? first.promise : second.promise);
  t.mock.timers.tick(2_000); await flush();
  t.mock.timers.tick(1_000); await flush();
  const count = h.updates.length;
  first.reject(new Error("late failure")); await flush();
  assert.equal(h.updates.length, count);
  assert.equal(h.signals[1].aborted, false);
  t.mock.timers.tick(2_000); await flush();
  assert.equal(h.signals[1].aborted, true);
  assert.equal(h.updates.at(-1), null);
});

for (const field of ["observedAt", "heartbeat"] as const) {
  for (const value of [null, "invalid", new Date(epoch + 5_001).toISOString(),
    new Date(epoch - 20_000).toISOString()]) {
    test(`rejects ${field}=${value} without publishing live states`, async t => {
      const h = harness(t, async () => {
        const data = snapshot();
        if (field === "observedAt") data.observedAt = value;
        else data.worker!.heartbeat = value;
        return response(data);
      });
      await flush(); assert.deepEqual(h.updates, [null]);
    });
  }
}

for (const status of ["connected", "degraded"] as const) {
  test(`${status} live evidence expires before the next poll`, async t => {
    const h = harness(t, async () => {
      const data = snapshot(); data.status = status;
      data.worker!.heartbeat = new Date(epoch - 19_000).toISOString();
      return response(data);
    });
    await flush(); assert.equal(h.updates.at(-1)?.status, status);
    t.mock.timers.tick(999); assert.notEqual(h.updates.at(-1), null);
    t.mock.timers.tick(1); assert.equal(h.updates.at(-1), null);
  });
}

test("agents cannot be live without a valid worker heartbeat", async t => {
  const h = harness(t, async () => {
    const data = snapshot(); data.worker = null; return response(data);
  });
  await flush(); assert.deepEqual(h.updates, [null]);
});

for (const failure of ["network", "http", "json"] as const) {
  test(`${failure} failure clears data and the next poll recovers`, async t => {
    let calls = 0;
    const h = harness(t, async () => {
      if (++calls !== 2) return response();
      if (failure === "network") throw new Error("offline");
      return failure === "http" ? new Response("failed", { status: 500 }) : new Response("invalid json");
    });
    await flush();
    t.mock.timers.tick(3_000); await flush();
    assert.equal(h.updates.at(-1), null);
    t.mock.timers.tick(3_000); await flush();
    assert.equal(h.updates.at(-1)?.status, "connected");
  });
}

test("unmount clears the snapshot expiry timer too", async t => {
  let calls = 0;
  const h = harness(t, async () => { calls++; return response(); });
  await flush(); h.stop();
  const count = h.updates.length;
  t.mock.timers.tick(30_000); await flush();
  assert.equal(calls, 1); assert.equal(h.updates.length, count);
});

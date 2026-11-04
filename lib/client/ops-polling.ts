import type { SafeOpsSnapshot } from "../server/ops-snapshot";

const POLL_MS = 3_000;
const REQUEST_MS = 2_000;
const DISPLAY_MS = 5_000;
const EVIDENCE_MS = 20_000;

export function startOpsPolling(
  publish: (snapshot: SafeOpsSnapshot | null) => void,
  fetchSnapshot: typeof fetch = fetch,
): () => void {
  let stopped = false;
  let active: AbortController | null = null;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  let expiry: ReturnType<typeof setTimeout> | undefined;
  const clearSnapshot = () => {
    clearTimeout(expiry);
    if (!stopped) publish(null);
  };
  const load = async () => {
    if (stopped || active) return;
    const controller = new AbortController();
    active = controller;
    const startedAt = Date.now();
    deadline = setTimeout(() => {
      if (active !== controller) return;
      // Release the slot even if the transport never settles after abort.
      active = null;
      controller.abort();
      clearSnapshot();
    }, REQUEST_MS);
    try {
      const response = await fetchSnapshot("/api/runtime/ops", {
        cache: "no-store", signal: controller.signal,
      });
      if (stopped || active !== controller) return;
      if (!response.ok) throw new Error("offline");
      const data = await response.json() as SafeOpsSnapshot;
      if (stopped || active !== controller) return;
      const now = Date.now();
      const observedAt = Date.parse(data.observedAt ?? "");
      const live = (state: string | undefined) => state === "working" || state === "available";
      const needsHeartbeat = live(data.worker?.state) || data.agents.some(agent => live(agent.state));
      const heartbeat = needsHeartbeat ? Date.parse(data.worker?.heartbeat ?? "") : observedAt;
      const expiresAt = Math.min(now + DISPLAY_MS,
        observedAt + EVIDENCE_MS, heartbeat + EVIDENCE_MS);
      if (now - startedAt >= REQUEST_MS || !Number.isFinite(expiresAt) ||
          observedAt > now + 5_000 || heartbeat > now + 5_000 || expiresAt <= now) {
        throw new Error("stale_snapshot");
      }
      clearTimeout(expiry);
      publish(data);
      expiry = setTimeout(clearSnapshot, expiresAt - now);
    } catch {
      if (!stopped && active === controller) clearSnapshot();
    } finally {
      // An older request must not clear a newer request's deadline or slot.
      if (active === controller) {
        clearTimeout(deadline);
        active = null;
      }
    }
  };
  void load();
  const interval = setInterval(() => void load(), POLL_MS);
  return () => {
    stopped = true;
    clearInterval(interval);
    clearTimeout(deadline);
    clearTimeout(expiry);
    const controller = active;
    active = null;
    controller?.abort();
  };
}

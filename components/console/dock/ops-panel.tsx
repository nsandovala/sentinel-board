"use client";

import { useEffect, useState } from "react";
import { startOpsPolling } from "@/lib/client/ops-polling";
import type { SafeOpsSnapshot, OpsState } from "@/lib/server/ops-snapshot";

const labels: Record<OpsState, string> = {
  working: "trabajando", waiting_human: "revisión humana", blocked: "bloqueado",
  stale: "sin señal reciente", offline: "sin conexión", available: "disponible",
};
const colors: Record<OpsState, string> = {
  working: "text-amber-300", waiting_human: "text-sky-300", blocked: "text-red-300",
  stale: "text-amber-300/70", offline: "text-muted-foreground/60", available: "text-emerald-300/80",
};

export function OpsPanel() {
  const [snapshot, setSnapshot] = useState<SafeOpsSnapshot | null>(null);
  useEffect(() => startOpsPolling(setSnapshot), []);

  const worker = snapshot?.worker;
  return <section className="rounded-md border border-white/[0.06] bg-[#151515] p-3" aria-label="Estado operacional de AMON">
    <div className="mb-2 flex items-center justify-between gap-2">
      <h3 className="font-mono text-[10px] uppercase tracking-wide text-foreground/80">AMON Ops</h3>
      <span className="font-mono text-[10px] text-muted-foreground/65">
        {snapshot?.status === "connected" ? "snapshot conectado" : snapshot?.status === "degraded" ? "snapshot degradado" : "snapshot sin conexión"}
      </span>
    </div>
    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
      {(["Worker", "Jarvis", "Claudio", "Guardian"] as const).map((name, index) => {
        const state: OpsState = index === 0 ? worker?.state ?? "offline" : snapshot?.agents[index - 1]?.state ?? "offline";
        return <div key={name} className="rounded border border-white/[0.04] bg-black/20 px-2 py-1.5">
          <div className="text-[11px] text-foreground/80">{name}</div>
          <div className={`font-mono text-[10px] ${colors[state]}`}>{labels[state]}</div>
        </div>;
      })}
    </div>
    {!worker && <p className="mt-2 text-[10px] text-muted-foreground/60">Inicia el servidor Ops local de AMON Agents para ver evidencia operacional.</p>}
    {worker?.heartbeat && <p className="mt-2 font-mono text-[10px] text-muted-foreground/55">Último heartbeat: {new Date(worker.heartbeat).toLocaleString()}</p>}
    {snapshot && snapshot.jobs.length > 0 && <div className="mt-3">
      <h4 className="mb-1 font-mono text-[10px] uppercase text-muted-foreground/70">Trabajos</h4>
      <ul className="space-y-1">
        {snapshot.jobs.slice(0, 6).map(job => <li key={job.id} className="flex flex-wrap gap-x-2 rounded bg-black/20 px-2 py-1 font-mono text-[10px] text-foreground/75">
          <span>{job.id}</span><span>{job.action}</span><span>{job.status}</span>
          {job.verdict && <span>Guardian: {job.verdict}</span>}
          {job.humanReview && <span className="text-sky-300">revisión humana solicitada</span>}
        </li>)}
      </ul>
    </div>}
    {snapshot && snapshot.reviews.length > 0 && <div className="mt-3">
      <h4 className="mb-1 font-mono text-[10px] uppercase text-muted-foreground/70">Veredictos Guardian</h4>
      <ul className="space-y-1">{snapshot.reviews.slice(0, 4).map(review => <li key={review.id} className="font-mono text-[10px] text-foreground/70">
        {review.jobId}: {review.verdict} · {review.findings} hallazgo{review.findings === 1 ? "" : "s"}
      </li>)}</ul>
    </div>}
  </section>;
}

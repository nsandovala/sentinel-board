"use client";

import { useEffect, useState } from "react";
import { missionSnapshotSchema, snapshotFreshness, type MissionResponse, type MissionSnapshot } from "@/lib/mission/snapshot";

const emptyMessages = {
  unconfigured: "Aún no hay una fuente de misiones conectada.",
  unavailable: "El resumen de AA no está disponible.",
  invalid: "No se pudo validar el resumen. No se muestran datos de misión.",
};
const statusLabels: Record<string, string> = {approved: "Aprobada", revoked: "Revocada", expired: "Vencida", pending: "Pendiente", denied: "Denegada", invalid: "No válida"};
const date = (value: string) => new Date(value).toLocaleString("es-CL");
const yes = (value: boolean) => value ? "Sí" : "No";

export function MissionDetails({ snapshot }: { snapshot: MissionSnapshot }) {
  const m = snapshot.mission;
  return <div className="space-y-5">
    <section className="rounded-xl border border-border bg-card p-5" aria-labelledby="mission-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-xs font-medium text-muted-foreground">Repositorio de prueba aislado · {m.repositoryAlias}</p>
          <h2 id="mission-title" className="mt-1 text-lg font-semibold">Inspección supervisada</h2></div>
        <span className="rounded-full border px-3 py-1 text-xs">Solo lectura</span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">Lectura real de Git y README. No intervienen agentes LLM. El repositorio inspeccionado es de prueba.</p>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div><dt className="text-muted-foreground">Misión</dt><dd className="break-all font-mono text-xs">{m.id}</dd></div>
        <div><dt className="text-muted-foreground">Rama observada</dt><dd>{m.branch}</dd></div>
        <div><dt className="text-muted-foreground">Base del plan</dt><dd className="break-all font-mono text-xs">{m.baseSha}</dd></div>
        <div><dt className="text-muted-foreground">Huella del plan aprobado</dt><dd className="break-all font-mono text-xs">{m.planHash}</dd></div>
      </dl>
    </section>
    <section className="rounded-xl border border-border bg-card p-5" aria-labelledby="assignment-title">
      <h2 id="assignment-title" className="font-semibold">Asignación y capacidades</h2>
      <p className="mt-2 text-sm">{m.proposalStatus === "proposed" ? `Rol propuesto: ${m.proposedRole}.` : "Propuesta bloqueada."} Capacidad requerida: {m.requiredCapability}. Acción: {m.action}.</p>
      <p className="mt-1 text-xs text-muted-foreground">La propuesta exige un ejecutor disponible, una acción compatible y todas las capacidades requeridas. No constituye autorización.</p>
      <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm">
        <caption className="sr-only">Comparación de agentes para la inspección</caption>
        <thead className="text-xs text-muted-foreground"><tr><th className="p-2">Rol</th><th className="p-2">Ejecutor</th><th className="p-2">Acción compatible</th><th className="p-2">Resultado</th></tr></thead>
        <tbody>{m.candidates.map(c => <tr key={c.role} className="border-t border-border"><th scope="row" className="p-2 font-medium">{c.role}</th><td className="p-2">{c.available ? "Disponible" : "No disponible"}</td><td className="p-2">{yes(c.actionCompatible)}</td><td className="p-2">{c.matches ? "Cumple" : c.missingCapabilities.length ? `Falta: ${c.missingCapabilities.join(", ")}` : "No elegible"}</td></tr>)}</tbody>
      </table></div>
      <p className="mt-3 text-sm">Permiso del host: {yes(m.permissions.host)} · Misión: {yes(m.permissions.mission)} · Asignación: {yes(m.permissions.assignment)}</p>
    </section>
    <div className="grid items-start gap-5 xl:grid-cols-2">
      <section className="rounded-xl border border-border bg-card p-5" aria-labelledby="approval-title">
        <h2 id="approval-title" className="font-semibold">Aprobaciones al exportar</h2>
        <p className="mt-1 text-xs text-muted-foreground">Registro del host local de AA. Consulta histórica: SB no concede ni revoca permisos.</p>
        {!m.authorizations.length && <p className="mt-4 text-sm">Sin aprobaciones registradas. No hay autorización de ejecución.</p>}
        <ul className="mt-3 space-y-3">{m.authorizations.map(a => <li key={a.id} className="rounded-lg border p-3 text-sm">
          <p className="font-medium">{statusLabels[a.decision === "revoked" ? "revoked" : a.effectiveStatus]}</p>
          <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{a.id}</p>
          {a.approvedAt && <p className="mt-2 text-xs">Aprobada: {date(a.approvedAt)}</p>}
          <p className="text-xs">Vencimiento: {date(a.expiresAt)}</p>
        </li>)}</ul>
      </section>
      <section className="rounded-xl border border-border bg-card p-5" aria-labelledby="evidence-title">
        <h2 id="evidence-title" className="font-semibold">Evidencia de ejecución</h2>
        <p className="mt-1 text-xs text-muted-foreground">Una revocación posterior conserva el resultado histórico. Ningún recibo habilita otra ejecución.</p>
        {!m.observations.length && <p className="mt-4 text-sm">Sin intentos registrados. No se afirma trabajo realizado.</p>}
        <ul className="mt-3 space-y-3">{m.observations.map(o => <li key={o.authorizationId} className="rounded-lg border p-3 text-sm">
          <p className="font-medium">{o.status === "completed" ? "Inspección completada" : o.status === "blocked" ? "Inspección bloqueada" : "Intento sin resultado verificable"}</p>
          <p className="mt-1 text-xs">Inicio: {date(o.startedAt)}</p>
          {o.finishedAt && <p className="text-xs">Fin: {date(o.finishedAt)}</p>}
          {o.evidence && <details className="mt-3"><summary className="cursor-pointer text-xs">Ver evidencia de Git</summary><dl className="mt-2 space-y-2 break-all font-mono text-xs">
            <div><dt>Recibo</dt><dd>{o.evidence.reference}</dd></div><div><dt>HEAD observado</dt><dd>{o.evidence.headSha}</dd></div><div><dt>SHA-256 de README</dt><dd>{o.evidence.readmeSha256}</dd></div>
          </dl></details>}
        </li>)}</ul>
      </section>
    </div>
  </div>;
}

export function MissionsView() {
  const [result, setResult] = useState<MissionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController;
    async function poll() {
      controller = new AbortController();
      const deadline = setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetch("/api/missions", {cache: "no-store", signal: controller.signal});
        if (!response.ok) throw Error(response.status === 401 || response.status === 403 ? "La sesión no permite consultar misiones. Vuelve a iniciar sesión." : "No se pudo consultar AA. Reintenta la lectura.");
        const body = await response.json();
        let next: MissionResponse;
        if (["unconfigured", "unavailable", "invalid"].includes(body.status)) next = {status: body.status};
        else {
          const snapshot = missionSnapshotSchema.parse(body.snapshot);
          const status = snapshotFreshness(snapshot);
          next = status === "invalid" ? {status} : {status, snapshot};
        }
        if (!stopped) { setResult(next); setError(null); }
      } catch (e) {
        if (!stopped) { setResult(null); setError(e instanceof Error && e.message.startsWith("La sesión") ? e.message : "No se pudo validar la lectura. Reintenta o revisa la conexión con AA."); }
      } finally {
        clearTimeout(deadline);
        if (!stopped) timer = setTimeout(poll, 15_000);
      }
    }
    void poll();
    return () => { stopped = true; clearTimeout(timer); controller?.abort(); };
  }, [refresh]);
  return <main className="h-full overflow-y-auto p-4 sm:p-6" aria-label="Misiones">
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-xl font-semibold">Misiones</h1><p className="mt-1 text-sm text-muted-foreground">Resumen de AA · todos los proyectos · solo lectura</p></div>
        <button type="button" onClick={() => setRefresh(v => v + 1)} className="rounded-md border px-3 py-2 text-sm hover:bg-muted focus-visible:ring-2">Actualizar lectura</button></header>
      <div role="status" aria-live="polite" className="rounded-lg border p-3 text-sm">
        {error ?? (!result ? "Consultando misiones…" : "snapshot" in result ?
          `${result.status === "stale" ? "Resumen antiguo: puede haber cambios posteriores. " : ""}Observación exportada: ${date(result.snapshot.generatedAt)}. No es una autorización vigente para ejecutar.` : emptyMessages[result.status])}
      </div>
      {result && "snapshot" in result && <MissionDetails snapshot={result.snapshot} />}
    </div>
  </main>;
}

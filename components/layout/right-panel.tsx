"use client";

import { useSentinel } from "@/lib/state/sentinel-store";
import { generateCodexLoop } from "@/lib/console/codex-loop-generator";
import { generateMoneyCode } from "@/lib/console/money-code-generator";
import type { SentinelCard } from "@/types/card";

function CodexLoopSection({ card }: { card: SentinelCard }) {
  const loop = generateCodexLoop(card);
  const steps = [
    { label: "Problema", value: loop.problem },
    { label: "Objetivo", value: loop.objective },
    { label: "Hipótesis", value: loop.hypothesis },
    { label: "Solución", value: loop.solution },
    { label: "Validación", value: loop.validation },
    { label: "Siguiente paso", value: loop.nextStep },
  ];

  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-violet-400" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground/90">
          Codex Loop
        </h3>
      </div>
      <div className="rounded-lg border border-border bg-muted/30 p-3">
        <ol className="flex flex-col gap-2">
          {steps.map((s, i) => (
            <li key={s.label} className="flex gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-muted text-[10px] font-semibold tabular-nums text-muted-foreground">
                {i + 1}
              </span>
              <div className="flex-1">
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {s.label}
                </span>
                <p className="mt-0.5 text-[12px] leading-relaxed text-foreground/80">
                  {s.value ?? "—"}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function MoneyCodeSection({ card }: { card: SentinelCard }) {
  const mc = generateMoneyCode(card);
  const score = mc.score ?? 0;

  const dims = [
    { label: "Impacto", value: mc.impact },
    { label: "Urgencia", value: mc.urgency },
    { label: "Esfuerzo", value: mc.effort },
    { label: "Retorno", value: mc.returnValue },
    { label: "Estrategia", value: mc.strategyAlignment },
    { label: "Reuso", value: mc.reuseValue },
    { label: "Validación", value: mc.validationValue },
  ];

  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-emerald-400" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground/90">
          Código del Dinero
        </h3>
      </div>
      <div className="rounded-lg border border-border bg-muted/30 p-3">
        <div className="mb-3 flex items-baseline gap-1">
          <span className="text-2xl font-bold tabular-nums text-foreground">{score}</span>
          <span className="text-xs text-muted-foreground">/ 100</span>
        </div>
        <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${score}%` }}
          />
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
          {dims.map((d) => (
            <div key={d.label} className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">{d.label}</span>
              <span className="text-[11px] font-medium tabular-nums text-foreground/80">
                {d.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function EmptyState() {
  return (
    <>
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        <section>
          <div className="mb-2 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-violet-400" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground/90">
              Codex Loop
            </h3>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <ol className="flex flex-col gap-2">
              {["Problema", "Hipótesis", "Solución", "Validación"].map((s, i) => (
                <li key={s} className="flex items-center gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-muted text-[10px] font-semibold tabular-nums text-muted-foreground">
                    {i + 1}
                  </span>
                  <span className="text-[13px] text-foreground/70">{s}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground/90">
              Código del Dinero
            </h3>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold tabular-nums text-foreground/40">--</span>
              <span className="text-xs text-foreground/30">/ 100</span>
            </div>
            <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full w-0 rounded-full bg-emerald-500/50" />
            </div>
          </div>
        </section>
      </div>

      <div className="border-t border-border px-4 py-3">
        <p className="text-center text-xs text-muted-foreground">
          Selecciona una tarjeta para ver detalles
        </p>
      </div>
    </>
  );
}

export function RightPanel() {
  const { cards, selectedCardId } = useSentinel();
  const card = selectedCardId ? cards.find((c) => c.id === selectedCardId) : null;

  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-border bg-sidebar text-sidebar-foreground">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
        <span className="text-sm font-semibold">Detalle</span>
        <span className="text-xs text-muted-foreground">/ HEO</span>
      </div>

      {card ? (
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
          {/* Card title */}
          <div>
            <h2 className="text-[13px] font-semibold text-foreground">{card.title}</h2>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-[10px] uppercase text-muted-foreground">{card.status}</span>
              <span className="text-[10px] text-muted-foreground">·</span>
              <span className="text-[10px] uppercase text-muted-foreground">{card.priority}</span>
            </div>
          </div>
          <CodexLoopSection card={card} />
          <MoneyCodeSection card={card} />
        </div>
      ) : (
        <EmptyState />
      )}
    </aside>
  );
}

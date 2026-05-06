import { RotateCw } from "lucide-react";
import { deriveCodexLoop } from "@/lib/analysis/codex-loop";
import type { SentinelCard } from "@/types/card";

const steps = [
  ["problem", "Problema"],
  ["objective", "Objetivo"],
  ["hypothesis", "Hipotesis"],
  ["solution", "Solucion"],
  ["validation", "Validacion"],
  ["nextStep", "Siguiente paso"],
] as const;

export function CodexLoopPanel({ card }: { card: SentinelCard }) {
  const loop = deriveCodexLoop(card);

  return (
    <section>
      <div className="mb-2.5 flex items-center gap-2">
        <RotateCw className="h-3.5 w-3.5 text-primary/40" />
        <h3 className="sentinel-rail-section-label">Codex Loop</h3>
      </div>
      <div className="sentinel-glass-panel p-3.5">
        <ol className="flex flex-col gap-3">
          {steps.map(([key, label], index) => (
            <li
              key={key}
              className="flex gap-3 border-b border-border/25 pb-3 last:border-b-0 last:pb-0"
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-muted/80 text-[10px] font-semibold tabular-nums text-muted-foreground ring-1 ring-border/30">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <span className="sentinel-rail-meta block font-medium uppercase tracking-[0.06em]">
                  {label}
                </span>
                <p className="sentinel-rail-body mt-1">{loop[key]}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

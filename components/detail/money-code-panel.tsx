import { DollarSign } from "lucide-react";
import { calculateMoneyCode } from "@/lib/analysis/money-code";
import type { SentinelCard } from "@/types/card";
import { cn } from "@/lib/utils";

const dimensionLabels = [
  ["revenue", "Revenue"],
  ["savings", "Savings"],
  ["automation", "Automation"],
  ["reuse", "Reuse"],
  ["execution", "Execution"],
  ["validation", "Validation"],
  ["strategicFit", "Strategic Fit"],
  ["riskControl", "Risk Control"],
] as const;

function scoreTone(label: ReturnType<typeof calculateMoneyCode>["label"]) {
  if (label === "critical") return "border-red-500/25 bg-red-500/10 text-red-200";
  if (label === "high") return "border-amber-500/25 bg-amber-500/10 text-amber-200";
  if (label === "medium") return "border-blue-500/20 bg-blue-500/10 text-blue-200";
  return "border-border/30 bg-muted/50 text-muted-foreground";
}

export function MoneyCodePanel({ card }: { card: SentinelCard }) {
  const moneyCode = calculateMoneyCode(card);

  return (
    <section>
      <div className="mb-2.5 flex items-center gap-2">
        <DollarSign className="h-3.5 w-3.5 text-primary/40" />
        <h3 className="sentinel-rail-section-label">Codigo del Dinero</h3>
      </div>
      <div className="sentinel-glass-panel p-3.5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-semibold tabular-nums tracking-[-0.04em] text-foreground">
                {moneyCode.total}
              </span>
              <span className="sentinel-rail-meta">/ 100</span>
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
              {moneyCode.explanation}
            </p>
          </div>
          <span
            className={cn(
              "rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em]",
              scoreTone(moneyCode.label),
            )}
          >
            {moneyCode.label}
          </span>
        </div>

        <div className="mt-4 flex flex-col gap-2.5">
          {dimensionLabels.map(([key, label]) => {
            const value = moneyCode.dimensions[key];
            return (
              <div key={key} className="space-y-1">
                <div className="flex items-center justify-between gap-3">
                  <span className="sentinel-rail-meta text-[10px]">{label}</span>
                  <span className="text-[11px] font-medium tabular-nums text-foreground/82">
                    {value}/10
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted/80">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,oklch(0.54_0.07_168),oklch(0.58_0.08_287))]"
                    style={{ width: `${value * 10}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

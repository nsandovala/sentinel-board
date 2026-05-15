"use client";

import { AnalyzeDockInput } from "@/components/console/command-input";
import { CommandLog } from "@/components/console/command-log";
import { AnalysisPreview } from "./analysis-preview";
import type { LocalAnalysisResult } from "@/lib/console/local-analysis";
import type { SentinelCard } from "@/types/card";

const ANALYZE_EXAMPLES = [
  "Pegar bullet list de un correo",
  "Pegar párrafo de riesgos y próximos pasos",
] as const;

const ANALYZE_MODE_HINT =
  "Heurístico local (sin red): abajo podés crear tarjetas en backlog o copiar el informe.";

interface AnalyzeModeProps {
  expanded: boolean;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onFocus: () => void;
  analyzing: boolean;
  lastAnalysis: LocalAnalysisResult | null;
  lastWasAgent: boolean;
  cards: SentinelCard[];
  projectId: string | null;
  projectName?: string;
  onNotify: (message: string) => void;
}

export function AnalyzeMode({
  expanded,
  value,
  onChange,
  onSubmit,
  onFocus,
  analyzing,
  lastAnalysis,
  lastWasAgent,
  cards,
  projectId,
  projectName,
  onNotify,
}: AnalyzeModeProps) {
  return (
    <>
      <div className="flex min-h-[56px] items-stretch gap-2 px-1 py-1">
        <div className="min-w-0 flex-1">
          <AnalyzeDockInput
            value={value}
            onChange={onChange}
            onSubmit={onSubmit}
            onFocus={onFocus}
            analyzeHint={expanded ? ANALYZE_MODE_HINT : undefined}
            analyzeExamples={expanded ? [...ANALYZE_EXAMPLES] : []}
          />
        </div>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!value.trim() || analyzing}
          className="sentinel-dock-segment mr-2 shrink-0 self-center rounded-md px-2.5 py-1 text-[11px] font-medium text-foreground/88 transition-colors hover:border-[oklch(0.5_0.014_285/0.28)] hover:shadow-[inset_0_1px_0_oklch(0.58_0.014_285/0.07)] disabled:opacity-40"
        >
          {analyzing ? "Analizando…" : "Analizar"}
        </button>
      </div>

      {expanded && (
        <div className="grid grid-cols-[1fr_auto] gap-4 border-t border-border/30 px-4 pb-3 pt-2">
          <div className="flex max-h-72 min-h-0 flex-col gap-2 overflow-hidden">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
              Registro del dock
            </p>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <CommandLog />
            </div>
            {analyzing && (
              <div className="flex items-center gap-2 border-t border-border/30 px-1 py-3">
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground/70" />
                <span className="text-[11px] text-muted-foreground">
                  Consultando agente planner…
                </span>
              </div>
            )}
            {lastAnalysis && !analyzing && (
              <div className="max-h-[min(22rem,55vh)] shrink-0 overflow-y-auto border-t border-border/30 pt-2">
                <AnalysisPreview
                  data={lastAnalysis}
                  cards={cards}
                  projectId={projectId}
                  projectName={projectName}
                  onNotify={onNotify}
                  isAgentResult={lastWasAgent}
                />
              </div>
            )}
          </div>

          <aside className="flex w-56 flex-col gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
              Cómo usar
            </p>
            <div className="sentinel-glass-panel--subtle flex flex-col gap-1.5 rounded-md p-2 text-[11px] text-muted-foreground">
              <p>1. Pegá texto largo (correo, bullets, notas).</p>
              <p>2. Apretá <span className="text-foreground/80">Analizar</span> o <span className="text-foreground/80">⌘/Ctrl + Enter</span>.</p>
              <p>3. Convertí tareas sugeridas en cards con <span className="text-foreground/80">Crear en board</span>.</p>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

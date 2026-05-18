"use client";

import { AnalysisPreview } from "./analysis-preview";
import type { LocalAnalysisResult } from "@/lib/console/local-analysis";
import type { SentinelCard } from "@/types/card";

interface AnalyzeModeProps {
  analyzing: boolean;
  lastAnalysis: LocalAnalysisResult | null;
  lastWasAgent: boolean;
  cards: SentinelCard[];
  projectId: string | null;
  projectName?: string;
  onNotify: (message: string) => void;
}

export function AnalyzeMode({
  analyzing,
  lastAnalysis,
  lastWasAgent,
  cards,
  projectId,
  projectName,
  onNotify,
}: AnalyzeModeProps) {
  return (
    <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_14rem] gap-4 px-4 py-3">
      <div className="flex min-h-0 flex-col gap-2 overflow-hidden">
        {analyzing ? (
          <div className="flex items-center gap-2 px-1 py-3">
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground/70" />
            <span className="text-[11px] text-muted-foreground">Consultando agente planner...</span>
          </div>
        ) : lastAnalysis ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <AnalysisPreview
              data={lastAnalysis}
              cards={cards}
              projectId={projectId}
              projectName={projectName}
              onNotify={onNotify}
              isAgentResult={lastWasAgent}
            />
          </div>
        ) : (
          <div className="flex h-full items-center justify-center px-2 py-6 text-center text-[11px] leading-snug text-muted-foreground/55">
            Aún no hay análisis. Pega contexto abajo y presiona Analizar.
          </div>
        )}
      </div>

      <aside className="flex w-56 flex-col gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
          Cómo usar
        </p>
        <div className="sentinel-glass-panel--subtle flex flex-col gap-1.5 rounded-md p-2 text-[11px] text-muted-foreground">
          <p>1. Pega texto largo: correo, bullets o notas.</p>
          <p>
            2. Presiona <span className="text-foreground/80">Analizar</span> o{" "}
            <span className="text-foreground/80">Ctrl + Enter</span>.
          </p>
          <p>
            3. Convierte tareas sugeridas en cards con{" "}
            <span className="text-foreground/80">Crear en board</span>.
          </p>
        </div>
        <p className="text-[10px] leading-snug text-muted-foreground/75">
          El historial de comandos vive en el Timeline.
        </p>
      </aside>
    </div>
  );
}

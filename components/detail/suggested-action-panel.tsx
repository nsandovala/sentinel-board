"use client";

import { useMemo, useState, type MouseEvent } from "react";
import { Play, Sparkles } from "lucide-react";
import { suggestNextAction } from "@/lib/analysis/suggest-next-action";
import type { SentinelCard } from "@/types/card";
import { Button } from "@/components/ui/button";
import { CommandSnippetBlock } from "./command-snippet-block";
import { useToast } from "@/components/ui/toast";

interface SuggestedActionPanelProps {
  card: SentinelCard;
  onRefresh?: () => void;
  onOpenCard?: (cardId: string, projectId?: string) => void;
}

export function SuggestedActionPanel({
  card,
  onRefresh,
  onOpenCard,
}: SuggestedActionPanelProps) {
  const suggestion = useMemo(() => suggestNextAction(card), [card]);
  const { toast } = useToast();
  const [running, setRunning] = useState(false);

  const executeSuggestion = async (event: MouseEvent<HTMLButtonElement>) => {
    setRunning(true);
    try {
      const res = await fetch("/api/terminal/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: suggestion.command }),
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        toast(data.error ?? "No se pudo ejecutar la accion sugerida", "error", event);
        return;
      }

      if (data.hint === "refresh_board") {
        onRefresh?.();
      }

      if (data.meta?.affectedCardId) {
        onOpenCard?.(String(data.meta.affectedCardId), card.projectId);
      }

      toast(data.rawText ?? "Accion ejecutada", "success", event);
    } catch {
      toast("No se pudo ejecutar la accion sugerida", "error", event);
    } finally {
      setRunning(false);
    }
  };

  return (
    <section>
      <div className="mb-2.5 flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 text-primary/40" />
        <h3 className="sentinel-rail-section-label">Siguiente accion sugerida</h3>
      </div>
      <div className="sentinel-glass-panel p-3.5">
        <p className="text-[13px] font-medium tracking-[-0.01em] text-foreground/88">
          {suggestion.label}
        </p>
        <p className="sentinel-rail-body mt-2">{suggestion.reason}</p>

        <div className="sentinel-command-snippet-wrap">
          <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
            Comando sugerido
          </p>
          <CommandSnippetBlock command={suggestion.command} />
        </div>

        <div className="mt-3 flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={executeSuggestion}
            disabled={running}
            className="border-border/35 bg-background/60 text-foreground/85 hover:bg-primary/10"
          >
            <Play className="h-3.5 w-3.5" />
            {running ? "Ejecutando..." : "Ejecutar"}
          </Button>
        </div>
      </div>
    </section>
  );
}

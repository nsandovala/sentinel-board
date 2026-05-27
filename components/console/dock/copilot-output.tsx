"use client";

import { Bot, CornerDownRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type CopilotPhase =
  | "idle"
  | "thinking"
  | "consulting"
  | "done"
  | "error";

export interface CopilotOutputState {
  phase: CopilotPhase;
  provider: string | null;
  text: string;
  suggestedCommand: string | null;
  errorMessage: string | null;
  /** Echo of the user's message that triggered this turn (for context). */
  question: string | null;
}

interface CopilotOutputProps {
  state: CopilotOutputState;
  onApplySuggestion: (command: string) => void;
  onDismiss: () => void;
}

const PROVIDER_LABEL: Record<string, string> = {
  ollama: "Ollama",
  openrouter: "OpenRouter",
  anthropic: "Anthropic",
  heuristic: "heurístico",
  none: "sin provider",
};

function providerLabel(p: string | null): string {
  if (!p) return "—";
  return PROVIDER_LABEL[p] ?? p;
}

function PhaseDot({ phase }: { phase: CopilotPhase }) {
  const cls =
    phase === "thinking" || phase === "consulting"
      ? "bg-amber-400/85 animate-pulse"
      : phase === "done"
        ? "bg-emerald-400/80"
        : phase === "error"
          ? "bg-red-400/85"
          : "bg-muted-foreground/40";
  return <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", cls)} aria-hidden />;
}

function statusText(state: CopilotOutputState): string {
  switch (state.phase) {
    case "thinking":
      return "HEO pensando…";
    case "consulting":
      return state.provider
        ? `Consultando ${providerLabel(state.provider)}…`
        : "Consultando provider…";
    case "done":
      return state.provider
        ? `Respuesta · ${providerLabel(state.provider)}`
        : "Respuesta recibida";
    case "error":
      return state.provider && state.provider !== "none"
        ? `Error · ${providerLabel(state.provider)}`
        : "Error · sin provider disponible";
    default:
      return "";
  }
}

export function CopilotOutput({
  state,
  onApplySuggestion,
  onDismiss,
}: CopilotOutputProps) {
  if (state.phase === "idle") return null;

  const busy = state.phase === "thinking" || state.phase === "consulting";
  const isError = state.phase === "error";

  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 rounded-md border border-white/[0.05] bg-[#151515] px-3 py-2",
        isError && "border-red-500/20",
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2">
        <Bot className="h-3.5 w-3.5 text-violet-400/85" aria-hidden />
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
          HEO Copilot
        </span>
        <PhaseDot phase={state.phase} />
        <span
          className={cn(
            "text-[10px] font-mono uppercase tracking-wider",
            busy
              ? "text-amber-300"
              : state.phase === "done"
                ? "text-emerald-300/90"
                : isError
                  ? "text-red-300"
                  : "text-muted-foreground/70",
          )}
        >
          {statusText(state)}
        </span>
        <button
          type="button"
          onClick={onDismiss}
          className="ml-auto inline-flex h-5 w-5 items-center justify-center rounded-sm text-muted-foreground/60 transition-colors hover:bg-white/[0.04] hover:text-foreground/90"
          aria-label="Cerrar respuesta de HEO"
          title="Cerrar"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {state.question && (
        <p className="text-[10.5px] leading-snug text-muted-foreground/60">
          <span className="font-mono text-muted-foreground/55">›</span>{" "}
          {state.question.length > 200
            ? `${state.question.slice(0, 200)}…`
            : state.question}
        </p>
      )}

      {state.phase === "done" && state.text && (
        <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-foreground/90">
          {state.text}
        </p>
      )}

      {isError && (
        <p className="text-[11.5px] leading-snug text-red-300/90">
          {state.errorMessage ??
            "No fue posible obtener respuesta. Revisa providers IA o vuelve a intentarlo."}
        </p>
      )}

      {state.phase === "done" && state.suggestedCommand && (
        <div className="mt-1 flex items-center gap-2 rounded-sm border border-violet-500/20 bg-violet-500/[0.06] px-2 py-1.5">
          <CornerDownRight className="h-3 w-3 text-violet-300/85" aria-hidden />
          <code className="flex-1 truncate font-mono text-[11px] text-foreground/90">
            {state.suggestedCommand}
          </code>
          <button
            type="button"
            onClick={() => onApplySuggestion(state.suggestedCommand!)}
            className="shrink-0 rounded-sm border border-violet-500/25 bg-violet-500/[0.08] px-2 py-0.5 text-[10.5px] font-medium text-violet-200 transition-colors hover:bg-violet-500/[0.14]"
          >
            Aplicar
          </button>
        </div>
      )}
    </div>
  );
}

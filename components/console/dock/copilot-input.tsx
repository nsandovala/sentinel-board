"use client";

import { useCallback, useId, type KeyboardEvent } from "react";
import { Terminal, Sparkles, Clock, Bot, CornerDownLeft } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { DockMode } from "./dock-mode-tabs";

export type CopilotInputTone = "ready" | "warning" | "muted";

export interface CopilotInputAssist {
  tone: CopilotInputTone;
  lines: string[];
}

const PLACEHOLDERS: Record<DockMode, string> = {
  command: "Ejecuta una acción: mover card, crear tarea, iniciar foco...",
  analyze: "Pega una idea, contexto o problema para convertirlo en backlog...",
  focus: "Define el foco actual o vincula una tarea...",
  agents: "Runtime se conectará al Event Stream de AMON Agents en una fase posterior.",
};

const ICONS: Record<DockMode, LucideIcon> = {
  command: Terminal,
  analyze: Sparkles,
  focus: Clock,
  agents: Bot,
};

const ACCENT: Record<DockMode, string> = {
  command: "text-violet-400",
  analyze: "text-violet-400",
  focus: "text-amber-400",
  agents: "text-muted-foreground/60",
};

const TONE_CLASS: Record<CopilotInputTone, string> = {
  ready: "text-emerald-500/85",
  warning: "text-amber-500/90",
  muted: "text-muted-foreground/60",
};

interface CopilotInputProps {
  mode: DockMode;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onFocus?: () => void;
  running?: boolean;
  assist?: CopilotInputAssist | null;
  /** Sugerencia que se completa al pulsar Tab cuando el campo está vacío. */
  tabSuggestion?: string;
  /** Pista corta de formato/uso debajo del campo. */
  footerHint?: string;
}

export function CopilotInput({
  mode,
  value,
  onChange,
  onSubmit,
  onFocus,
  running,
  assist,
  tabSuggestion,
  footerHint,
}: CopilotInputProps) {
  const assistId = `${useId().replace(/:/g, "")}-copilot`;
  const Icon = ICONS[mode];
  const placeholder = PLACEHOLDERS[mode];
  const accentClass = ACCENT[mode];
  const disabled = mode === "agents";
  const isAnalyze = mode === "analyze";

  const handleSingleLineKey = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Tab" && tabSuggestion && !value.trim()) {
        e.preventDefault();
        onChange(tabSuggestion);
        return;
      }
      if (e.key === "Enter" && !e.shiftKey && value.trim() && !running) {
        e.preventDefault();
        onSubmit();
      }
    },
    [tabSuggestion, value, onSubmit, onChange, running],
  );

  const handleMultilineKey = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && value.trim() && !running) {
        e.preventDefault();
        onSubmit();
      }
    },
    [value, onSubmit, running],
  );

  const hasAssist = Boolean(assist?.lines.length || footerHint);
  const submitDisabled = disabled || running || !value.trim();

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-0.5 border-t border-border/35 bg-background/35 px-2 py-1.5",
        disabled && "opacity-70",
      )}
    >
      <div className="flex items-start gap-2 px-2">
        <Icon
          className={cn(
            "h-3.5 w-3.5 shrink-0",
            isAnalyze ? "mt-2" : "mt-2.5",
            accentClass,
          )}
          aria-hidden
        />

        {isAnalyze ? (
          <Textarea
            id={`${assistId}-field`}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleMultilineKey}
            onFocus={onFocus}
            placeholder={placeholder}
            rows={2}
            disabled={disabled}
            aria-describedby={hasAssist ? `${assistId}-assist` : undefined}
            className="min-h-[52px] flex-1 resize-none rounded-sm text-[13px] ring-offset-background focus-visible:ring-1 focus-visible:ring-violet-500/35"
          />
        ) : (
          <input
            type="text"
            id={`${assistId}-field`}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleSingleLineKey}
            onFocus={onFocus}
            placeholder={placeholder}
            disabled={disabled}
            autoComplete="off"
            aria-invalid={assist?.tone === "warning"}
            aria-describedby={hasAssist ? `${assistId}-assist` : undefined}
            className="h-9 flex-1 rounded-sm bg-transparent text-[13px] text-foreground ring-offset-background placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-500/35 disabled:cursor-not-allowed disabled:placeholder:text-muted-foreground/45"
          />
        )}

        <button
          type="button"
          onClick={onSubmit}
          disabled={submitDisabled}
          className={cn(
            "sentinel-dock-segment mt-1 inline-flex shrink-0 items-center gap-1 self-start rounded-md px-2 py-1 text-[11px] font-medium transition-colors disabled:opacity-40",
            running && "opacity-70",
          )}
          aria-label={running ? "Procesando" : `Enviar al HEO Copilot (${mode})`}
          title={
            disabled
              ? "Runtime aún no recibe comandos"
              : isAnalyze
                ? "Analizar (Ctrl + Enter)"
                : "Ejecutar (Enter)"
          }
        >
          {running ? (
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground/70" />
          ) : (
            <CornerDownLeft className="h-3 w-3" />
          )}
          <span>{running ? "..." : isAnalyze ? "Analizar" : "Ejecutar"}</span>
        </button>
      </div>

      {hasAssist && (
        <div id={`${assistId}-assist`} className="space-y-0.5 pl-[2.25rem] pr-2">
          {assist?.lines.length ? (
            <div className={cn("space-y-0.5 text-[10px] leading-snug", TONE_CLASS[assist.tone])}>
              {assist.lines.map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          ) : null}
          {footerHint ? (
            <p className="text-[10px] leading-snug text-muted-foreground/55">{footerHint}</p>
          ) : null}
        </div>
      )}
    </div>
  );
}

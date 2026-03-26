"use client";

import { useCallback, useId, type KeyboardEvent } from "react";
import { Terminal, Sparkles } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type DockInputMode = "command" | "analyze";

/** Retroalimentación en vivo desde el parser (sin ejecutar). */
export interface LiveCommandFeedback {
  tone: "ready" | "warning" | "muted";
  /** Líneas cortas bajo el campo */
  lines: string[];
}

interface CommandInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onFocus?: () => void;
  className?: string;
  suggestions?: string[];
  formatHint?: string;
  liveFeedback?: LiveCommandFeedback | null;
}

export function CommandInput({
  value,
  onChange,
  onSubmit,
  onFocus,
  className,
  suggestions = [],
  formatHint,
  liveFeedback,
}: CommandInputProps) {
  const assistId = `${useId().replace(/:/g, "")}-assist`;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Tab" && suggestions.length > 0 && !value.trim()) {
        e.preventDefault();
        onChange(suggestions[0] ?? "");
        return;
      }
      if (e.key === "Enter" && !e.shiftKey && value.trim()) {
        e.preventDefault();
        onSubmit();
      }
    },
    [value, onSubmit, onChange, suggestions],
  );

  const toneClass =
    liveFeedback?.tone === "warning"
      ? "text-amber-500/90"
      : liveFeedback?.tone === "ready"
        ? "text-emerald-500/85"
        : "text-muted-foreground/55";

  const hasAssist = Boolean(liveFeedback?.lines.length || formatHint);

  return (
    <div className={cn("flex min-w-0 flex-1 flex-col gap-0.5", className)}>
      <div className="flex items-center gap-2.5 px-4">
        <Terminal className="h-3.5 w-3.5 shrink-0 text-violet-400" aria-hidden />
        <input
          type="text"
          id={`${assistId}-cmd`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={onFocus}
          placeholder="Comando · crear / mover / foco / registrar tiempo…"
          autoComplete="off"
          aria-invalid={liveFeedback?.tone === "warning"}
          aria-describedby={hasAssist ? `${assistId}-assist` : undefined}
          className="h-9 flex-1 rounded-sm bg-transparent text-[13px] text-foreground ring-offset-background placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-500/35"
        />
      </div>
      <div id={`${assistId}-assist`} className="space-y-0.5">
        {liveFeedback?.lines.length ? (
          <div className={cn("space-y-0.5 px-4 pl-[2.25rem] text-[10px] leading-snug", toneClass)}>
            {liveFeedback.lines.map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        ) : null}
        {formatHint ? (
          <p className="px-4 pl-[2.25rem] text-[10px] leading-snug text-muted-foreground/65">
            {formatHint}{" "}
            <span className="text-muted-foreground/45">· Tab vacío: 1.ª sugerencia</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}

interface AnalyzeDockInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onFocus?: () => void;
  className?: string;
  analyzeHint?: string;
  analyzeExamples?: string[];
}

export function AnalyzeDockInput({
  value,
  onChange,
  onSubmit,
  onFocus,
  className,
  analyzeHint,
  analyzeExamples = [],
}: AnalyzeDockInputProps) {
  const assistId = `${useId().replace(/:/g, "")}-an`;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && value.trim()) {
        e.preventDefault();
        onSubmit();
      }
    },
    [value, onSubmit],
  );

  const hintParts = [analyzeHint, analyzeExamples.length ? `Ej.: ${analyzeExamples.slice(0, 2).join(" · ")}` : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cn("flex min-w-0 flex-1 flex-col gap-0.5", className)}>
      <div className="flex items-start gap-2.5 px-4 py-1.5">
        <Sparkles className="mt-2 h-3.5 w-3.5 shrink-0 text-violet-400" aria-hidden />
        <Textarea
          id={`${assistId}-ta`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={onFocus}
          placeholder="Contexto largo · luego revisá acciones en el panel de resultado"
          rows={2}
          aria-describedby={hintParts ? `${assistId}-hint` : undefined}
          className="min-h-[52px] flex-1 resize-none rounded-sm text-[13px] ring-offset-background focus-visible:ring-1 focus-visible:ring-violet-500/35"
        />
      </div>
      {hintParts ? (
        <p id={`${assistId}-hint`} className="px-4 pb-0.5 pl-[2.25rem] text-[10px] leading-snug text-muted-foreground/65">
          {hintParts}
        </p>
      ) : null}
    </div>
  );
}

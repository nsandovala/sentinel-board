"use client";

import { useState, useCallback, useRef } from "react";
import { Sparkles, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HeoSuggestion } from "@/types/event";

interface CommandSuggestionsProps {
  suggestions: HeoSuggestion[];
  onSelect: (command: string) => void;
}

export function CommandSuggestions({
  suggestions,
  onSelect,
}: CommandSuggestionsProps) {
  const [confirmedId, setConfirmedId] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClick = useCallback(
    (s: HeoSuggestion) => {
      onSelect(s.command);
      setConfirmedId(s.id);

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setConfirmedId(null), 1800);
    },
    [onSelect],
  );

  if (suggestions.length === 0) return null;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 px-1">
        <Sparkles className="h-3 w-3 text-violet-400" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-violet-400/80">
          HEO sugiere
        </span>
      </div>
      <div className="flex flex-col gap-0.5">
        {suggestions.map((s) => {
          const isConfirmed = confirmedId === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => handleClick(s)}
              disabled={isConfirmed}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] transition-all",
                isConfirmed
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "text-foreground/70 hover:bg-violet-500/10 hover:text-violet-300",
              )}
            >
              {isConfirmed ? (
                <Check className="h-3 w-3 shrink-0" />
              ) : (
                <span className="h-3 w-3 shrink-0" />
              )}
              <span className="flex-1">
                {isConfirmed ? "Ejecutado" : s.text}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

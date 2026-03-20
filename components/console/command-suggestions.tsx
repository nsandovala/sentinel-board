"use client";

import { Sparkles } from "lucide-react";
import type { HeoSuggestion } from "@/types/event";

interface CommandSuggestionsProps {
  suggestions: HeoSuggestion[];
  onSelect: (command: string) => void;
}

export function CommandSuggestions({
  suggestions,
  onSelect,
}: CommandSuggestionsProps) {
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
        {suggestions.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(s.command)}
            className="rounded-md px-2 py-1.5 text-left text-[12px] text-foreground/70 transition-colors hover:bg-violet-500/10 hover:text-violet-300"
          >
            {s.text}
          </button>
        ))}
      </div>
    </div>
  );
}

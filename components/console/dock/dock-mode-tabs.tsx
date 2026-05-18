"use client";

import { Terminal, Sparkles, Clock, Bot } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type DockMode = "command" | "analyze" | "focus" | "agents";

interface ModeDef {
  key: DockMode;
  label: string;
  icon: LucideIcon;
}

const MODES: ModeDef[] = [
  { key: "command", label: "Execute", icon: Terminal },
  { key: "analyze", label: "Analyze", icon: Sparkles },
  { key: "focus", label: "Focus", icon: Clock },
  { key: "agents", label: "Runtime", icon: Bot },
];

interface DockModeTabsProps {
  active: DockMode;
  onChange: (mode: DockMode) => void;
}

export function DockModeTabs({ active, onChange }: DockModeTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Modos del Workspace Panel"
      className="sentinel-dock-segment flex shrink-0 self-center rounded-md p-0.5"
    >
      {MODES.map(({ key, label, icon: Icon }) => {
        const selected = active === key;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`sentinel-dock-panel-${key}`}
            id={`sentinel-dock-tab-${key}`}
            onClick={() => onChange(key)}
            className={cn(
              "inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/30",
              selected
                ? "sentinel-dock-segment-active text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-3 w-3" aria-hidden />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

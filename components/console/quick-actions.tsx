"use client";

import {
  Play,
  Square,
  Plus,
  ArrowRightLeft,
} from "lucide-react";

interface QuickAction {
  id: string;
  label: string;
  icon: typeof Play;
  command: string;
  variant?: "default" | "danger";
}

const actions: QuickAction[] = [
  { id: "qa-1", label: "Iniciar foco", icon: Play, command: "iniciar foco" },
  { id: "qa-2", label: "Terminar foco", icon: Square, command: "terminar foco", variant: "danger" },
  { id: "qa-3", label: "Nueva tarea", icon: Plus, command: "crear tarea " },
  { id: "qa-4", label: "Mover estado", icon: ArrowRightLeft, command: "mover " },
];

interface QuickActionsProps {
  onAction: (command: string) => void;
}

export function QuickActions({ onAction }: QuickActionsProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
        Acciones rápidas
      </span>
      <div className="flex flex-wrap gap-1.5">
        {actions.map((a) => {
          const Icon = a.icon;
          const isDanger = a.variant === "danger";
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => onAction(a.command)}
              className={`flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-medium transition-colors ${
                isDanger
                  ? "border-red-500/20 text-red-400/80 hover:bg-red-500/10 hover:text-red-300"
                  : "border-border text-foreground/60 hover:bg-muted/50 hover:text-foreground/90"
              }`}
            >
              <Icon className="h-3 w-3" />
              {a.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

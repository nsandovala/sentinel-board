"use client";

import { X, Terminal } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSentinel, useSentinelDispatch } from "@/lib/state/sentinel-store";

const viewLabels: Record<string, string> = {
  board: "Board",
  timeline: "Timeline",
  backlog: "Backlog",
};

interface TopBarProps {
  showTerminal?: boolean;
  onToggleTerminal?: () => void;
}

export function TopBar({ showTerminal, onToggleTerminal }: TopBarProps) {
  const { activeView, selectedProjectId, projects } = useSentinel();
  const dispatch = useSentinelDispatch();

  const project =
    selectedProjectId != null
      ? projects.find((p) => p.id === selectedProjectId)
      : undefined;

  const goGlobalBoard = () => {
    dispatch({ type: "SELECT_PROJECT", projectId: null });
    dispatch({ type: "SET_VIEW", view: "board" });
  };

  const clearProjectOnly = () => {
    dispatch({ type: "SELECT_PROJECT", projectId: null });
  };

  return (
    <header className="sentinel-topbar flex h-12 shrink-0 items-center gap-2 border-b border-border/40 bg-background px-6">
      <nav
        className="flex min-w-0 flex-1 items-center gap-2 text-sm"
        aria-label="Ubicación en el workspace"
      >
        <span className="shrink-0 text-[15px] font-semibold tracking-[-0.02em] text-foreground">
          {viewLabels[activeView] ?? "Board"}
        </span>
        <span className="shrink-0 text-[13px] text-muted-foreground/55">/</span>
        <button
          type="button"
          onClick={goGlobalBoard}
          className="sentinel-breadcrumb-root shrink-0 rounded-md px-1.5 py-0.5 text-[13px] font-medium tracking-[-0.01em] text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/35"
          title="Vista global: todos los proyectos y board"
        >
          Sentinel Board
        </button>

        {project && (
          <>
            <span className="shrink-0 text-[13px] text-muted-foreground/55">/</span>
            <span
              className="sentinel-filter-chip inline-flex min-w-0 max-w-[min(100%,14rem)] items-center gap-1.5 rounded-lg border border-border/35 py-0.5 pl-2.5 pr-1 text-[13px] tracking-[-0.01em]"
              title="Filtrado por proyecto"
            >
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full ring-1 ring-border/30"
                style={{ backgroundColor: project.color }}
              />
              <span className="truncate font-medium text-foreground">{project.name}</span>
              <button
                type="button"
                onClick={clearProjectOnly}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/40"
                aria-label="Quitar filtro de proyecto"
                title="Mostrar todos los proyectos"
              >
                <X className="h-3 w-3" strokeWidth={2.5} />
              </button>
            </span>
          </>
        )}
      </nav>

      <div className={cn("ml-auto flex shrink-0 items-center gap-2")}>
        <div className="flex h-7 w-48 items-center gap-2 rounded-lg border border-border/40 bg-muted/70 px-2.5">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-muted-foreground"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <span className="text-[13px] text-muted-foreground">Buscar...</span>
        </div>

        <div className="flex h-7 cursor-pointer items-center gap-1.5 rounded-lg border border-border/40 bg-card px-2.5 text-[13px] text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
          Filtrar
        </div>

        {onToggleTerminal && (
          <button
            type="button"
            onClick={onToggleTerminal}
            className={cn(
              "flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border border-border/40 transition-colors",
              showTerminal
                ? "bg-primary/15 text-foreground ring-1 ring-primary/25"
                : "bg-muted text-foreground/60 hover:bg-muted/90 hover:text-foreground",
            )}
            title={showTerminal ? "Ocultar terminal" : "Mostrar terminal"}
          >
            <Terminal className="h-3.5 w-3.5" />
          </button>
        )}

        <div className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border border-border/40 bg-muted text-foreground/80 transition-colors hover:bg-muted/90 hover:text-foreground">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 5v14" />
            <path d="M5 12h14" />
          </svg>
        </div>
      </div>
    </header>
  );
}

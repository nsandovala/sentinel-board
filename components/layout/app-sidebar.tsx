"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useSentinel, useSentinelDispatch } from "@/lib/state/sentinel-store";
import type { ActiveView } from "@/lib/state/sentinel-reducer";

const views: { key: ActiveView; label: string }[] = [
  { key: "board", label: "Board" },
  { key: "timeline", label: "Timeline" },
  { key: "backlog", label: "Backlog" },
];

export function AppSidebar() {
  const { projects, cards, activeView, selectedProjectId } = useSentinel();
  const dispatch = useSentinelDispatch();

  const scopeCards = selectedProjectId
    ? cards.filter((c) => c.projectId === selectedProjectId)
    : cards;

  const active = scopeCards.filter(
    (c) => !["listo", "produccion", "archivado"].includes(c.status),
  ).length;
  const review = scopeCards.filter((c) => c.status === "qa" || c.status === "validando").length;
  const done = scopeCards.filter(
    (c) => c.status === "listo" || c.status === "produccion",
  ).length;

  const stats = [
    { label: "Activas", value: active },
    { label: "Revisión", value: review },
    { label: "Hechas", value: done },
  ];

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      {/* Branding: reset a vista global del board */}
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-sidebar-border px-3">
        <button
          type="button"
          onClick={() => {
            dispatch({ type: "SELECT_PROJECT", projectId: null });
            dispatch({ type: "SET_VIEW", view: "board" });
          }}
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-1 py-1 text-left transition-colors hover:bg-sidebar-accent/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sidebar-ring/40"
          title="Vista global: quitar filtro de proyecto y abrir Board"
        >
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border/40 bg-muted/90">
            <span className="text-xs font-bold text-foreground/80">S</span>
          </div>
          <span className="truncate text-[15px] font-semibold tracking-[-0.02em] text-foreground">
            Sentinel Board
          </span>
        </button>
        <span className="shrink-0 rounded border border-border/35 bg-muted/90 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          alpha
        </span>
      </div>

      {/* Workspace */}
      <div className="border-b border-sidebar-border px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full border border-border/35 bg-muted/80 text-[11px] font-semibold text-foreground/90">
            NS
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[13px] font-semibold leading-none tracking-[-0.01em] text-foreground">
              Néstor Sandoval
            </span>
            <span className="text-[11px] leading-none text-muted-foreground">
              Workspace personal
            </span>
          </div>
        </div>
      </div>

      {/* Live stats */}
      <div className="border-b border-sidebar-border px-4 py-3.5">
        <p className="sentinel-rail-section-label mb-2.5">
          Resumen{selectedProjectId ? " (proyecto)" : ""}
        </p>
        <div className="grid grid-cols-3 gap-2">
          {stats.map((s) => (
            <div
              key={s.label}
              className="flex flex-col items-center gap-0.5 rounded-md border border-border/35 bg-muted/90 py-1.5 shadow-[inset_0_1px_0_oklch(0.65_0.015_285/0.05)]"
            >
              <span className="text-sm font-semibold tabular-nums text-foreground">
                {s.value}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {s.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="border-b border-sidebar-border px-3 py-2.5">
        <nav className="flex flex-col gap-0.5">
          {views.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => dispatch({ type: "SET_VIEW", view: v.key })}
              className={cn(
                "relative flex w-full cursor-pointer items-center rounded-lg px-2.5 py-2 text-left text-[13px] font-medium tracking-[-0.01em] transition-colors",
                activeView === v.key
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
              )}
            >
              {activeView === v.key && (
                <span className="sentinel-nav-pip absolute left-0 top-1/2 h-3 w-[2px] -translate-y-1/2 rounded-r-full" />
              )}
              {v.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Projects */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between px-4 pb-1 pt-3.5">
          <p className="sentinel-rail-section-label">Proyectos</p>
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {projects.length}
          </span>
        </div>

        <ScrollArea className="flex-1">
          <nav className="flex flex-col gap-0.5 px-3 pb-3">
            {projects.map((project) => {
              const count = cards.filter((c) => c.projectId === project.id).length;
              const isSelected = selectedProjectId === project.id;
              return (
                <button
                  key={project.id}
                  type="button"
                  onClick={() =>
                    dispatch({
                      type: "SELECT_PROJECT",
                      projectId: isSelected ? null : project.id,
                    })
                  }
                  className={cn(
                    "relative flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] tracking-[-0.01em] transition-colors",
                    isSelected
                      ? "border border-primary/15 bg-muted/95 text-foreground shadow-[inset_0_1px_0_oklch(0.62_0.02_283/0.08)]"
                      : "border border-transparent text-muted-foreground hover:border-border/35 hover:bg-muted/70 hover:text-foreground",
                  )}
                >
                  {isSelected && (
                    <span className="sentinel-nav-pip absolute left-0 top-1/2 h-3 w-[2px] -translate-y-1/2 rounded-r-full" />
                  )}
                  <span
                    className="h-2 w-2 shrink-0 rounded-full ring-1 ring-border/30"
                    style={{ backgroundColor: project.color }}
                  />
                  <span className="flex-1 truncate">{project.name}</span>
                  {count > 0 && (
                    <span
                      className={cn(
                        "text-[10px] tabular-nums",
                        isSelected ? "text-muted-foreground" : "text-muted-foreground/60",
                      )}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </ScrollArea>
      </div>

      {/* Footer */}
      <div className="border-t border-sidebar-border px-4 py-2.5">
        <span className="text-[11px] text-muted-foreground">v0.1.0</span>
      </div>
    </aside>
  );
}

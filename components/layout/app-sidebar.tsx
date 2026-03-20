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
  const { projects, cards, activeView } = useSentinel();
  const dispatch = useSentinelDispatch();

  const active = cards.filter(
    (c) => !["listo", "produccion", "archivado"].includes(c.status),
  ).length;
  const review = cards.filter((c) => c.status === "qa" || c.status === "validando").length;
  const done = cards.filter(
    (c) => c.status === "listo" || c.status === "produccion",
  ).length;

  const stats = [
    { label: "Activas", value: active },
    { label: "Revisión", value: review },
    { label: "Hechas", value: done },
  ];

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-sidebar text-sidebar-foreground">
      {/* Branding */}
      <div className="flex h-12 shrink-0 items-center gap-2.5 border-b border-border px-4">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-violet-500/20">
          <span className="text-xs font-bold text-violet-400">S</span>
        </div>
        <span className="text-sm font-semibold tracking-tight text-foreground">
          Sentinel Board
        </span>
        <span className="ml-auto rounded bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-medium text-violet-400">
          alpha
        </span>
      </div>

      {/* Workspace */}
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-[11px] font-bold text-white">
            NS
          </div>
          <div className="flex flex-col">
            <span className="text-[13px] font-medium leading-none text-foreground">
              Néstor Sandoval
            </span>
            <span className="mt-0.5 text-[11px] text-muted-foreground">
              Workspace personal
            </span>
          </div>
        </div>
      </div>

      {/* Live stats */}
      <div className="border-b border-border px-4 py-3">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Resumen
        </p>
        <div className="grid grid-cols-3 gap-2">
          {stats.map((s) => (
            <div key={s.label} className="flex flex-col items-center gap-0.5 rounded-md bg-muted/50 py-1.5">
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
      <div className="border-b border-border px-3 py-2">
        <nav className="flex flex-col gap-0.5">
          {views.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => dispatch({ type: "SET_VIEW", view: v.key })}
              className={cn(
                "relative flex w-full cursor-pointer items-center rounded-md px-2.5 py-1.5 text-left text-[13px] font-medium transition-colors",
                activeView === v.key
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
              )}
            >
              {activeView === v.key && (
                <span className="absolute left-0 top-1/2 h-3 w-[2px] -translate-y-1/2 rounded-r-full bg-violet-400" />
              )}
              {v.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Projects */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between px-4 pb-1 pt-3">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Proyectos
          </p>
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {projects.length}
          </span>
        </div>

        <ScrollArea className="flex-1">
          <nav className="flex flex-col gap-0.5 px-3 pb-3">
            {projects.map((project) => {
              const count = cards.filter((c) => c.projectId === project.id).length;
              return (
                <div
                  key={project.id}
                  className="flex cursor-default items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: project.color }}
                  />
                  <span className="flex-1 truncate">{project.name}</span>
                  {count > 0 && (
                    <span className="text-[10px] tabular-nums text-muted-foreground/60">
                      {count}
                    </span>
                  )}
                </div>
              );
            })}
          </nav>
        </ScrollArea>
      </div>

      {/* Footer */}
      <div className="border-t border-border px-4 py-2.5">
        <span className="text-[11px] text-muted-foreground">v0.1.0</span>
      </div>
    </aside>
  );
}

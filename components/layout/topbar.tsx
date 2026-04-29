"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Terminal, Search, Filter, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSentinel, useSentinelDispatch } from "@/lib/state/sentinel-store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { SearchResponse } from "@/types/knowledge";

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
  const {
    activeView,
    selectedProjectId,
    projects,
    searchQuery,
    statusFilter,
    priorityFilter,
    tagFilter,
  } = useSentinel();
  const dispatch = useSentinelDispatch();
  const [filterOpen, setFilterOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResponse | null>(null);

  const project =
    selectedProjectId != null
      ? projects.find((p) => p.id === selectedProjectId)
      : undefined;

  const hasActiveSearch = Boolean(searchQuery.trim() || statusFilter || priorityFilter || tagFilter);
  const activeFilterCount = [statusFilter, priorityFilter, tagFilter].filter(Boolean).length;

  useEffect(() => {
    if (!hasActiveSearch) {
      setResults(null);
      setSearching(false);
      return;
    }

    const ctrl = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        setSearching(true);
        const params = new URLSearchParams();
        if (searchQuery.trim()) params.set("q", searchQuery.trim());
        if (selectedProjectId) params.set("projectId", selectedProjectId);
        if (statusFilter) params.set("status", statusFilter);
        if (priorityFilter) params.set("priority", priorityFilter);
        if (tagFilter) params.set("tag", tagFilter);
        params.set("limit", "8");

        const res = await fetch(`/api/search?${params.toString()}`, {
          signal: ctrl.signal,
        }).then((r) => r.json());

        if (res.ok) {
          setResults(res);
        } else {
          setResults({ ok: false, cards: [], knowledge: [], total: { cards: 0, knowledge: 0 } });
        }
      } catch {
        if (!ctrl.signal.aborted) {
          setResults({ ok: false, cards: [], knowledge: [], total: { cards: 0, knowledge: 0 } });
        }
      } finally {
        if (!ctrl.signal.aborted) {
          setSearching(false);
        }
      }
    }, 250);

    return () => {
      ctrl.abort();
      clearTimeout(timeout);
    };
  }, [hasActiveSearch, priorityFilter, searchQuery, selectedProjectId, statusFilter, tagFilter]);

  const flatCount = useMemo(
    () => (results ? results.total.cards + results.total.knowledge : 0),
    [results],
  );

  const goGlobalBoard = () => {
    dispatch({ type: "SELECT_PROJECT", projectId: null });
    dispatch({ type: "SET_VIEW", view: "board" });
  };

  const clearProjectOnly = () => {
    dispatch({ type: "SELECT_PROJECT", projectId: null });
  };

  const clearSearch = () => {
    dispatch({ type: "CLEAR_SEARCH_FILTERS" });
    setResults(null);
  };

  const openCard = (cardId: string, projectId: string) => {
    dispatch({ type: "SELECT_PROJECT", projectId });
    dispatch({ type: "SET_VIEW", view: "board" });
    dispatch({ type: "SELECT_CARD", cardId });
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
        <div className="relative w-80">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => dispatch({ type: "SET_SEARCH_QUERY", query: e.target.value })}
            placeholder="Buscar tareas y documentación..."
            className="h-8 rounded-lg border-border/40 bg-muted/70 pl-8 pr-8 text-[13px]"
          />
          {(searchQuery || hasActiveSearch) && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Limpiar búsqueda"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}

          {(hasActiveSearch || searching) && (
            <div className="absolute right-0 top-[calc(100%+0.5rem)] z-40 w-[28rem] rounded-xl border border-border/50 bg-popover p-2 shadow-xl">
              <div className="mb-2 flex items-center justify-between px-2 pt-1 text-[11px] text-muted-foreground">
                <span>
                  {searching ? "Buscando..." : `${flatCount} resultado(s)`}
                </span>
                {activeFilterCount > 0 && (
                  <span>{activeFilterCount} filtro(s)</span>
                )}
              </div>

              {results && results.cards.length > 0 && (
                <div className="mb-2">
                  <p className="px-2 pb-1 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                    Tareas
                  </p>
                  <div className="flex max-h-56 flex-col gap-1 overflow-y-auto">
                    {results.cards.map((card) => (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => openCard(card.id, card.projectId)}
                        className="rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted/70"
                      >
                        <div className="flex items-center gap-2">
                          <span className="truncate text-[13px] font-medium text-foreground">
                            {card.title}
                          </span>
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                            {card.status}
                          </span>
                        </div>
                        <p className="truncate text-[12px] text-muted-foreground">
                          {card.description ?? card.tags.join(" · ")}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {results && results.knowledge.length > 0 && (
                <div>
                  <p className="px-2 pb-1 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                    Documentación
                  </p>
                  <div className="flex max-h-56 flex-col gap-1 overflow-y-auto">
                    {results.knowledge.map((entry) => (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => {
                          if (entry.projectId && entry.sourceTaskId) {
                            openCard(entry.sourceTaskId, entry.projectId);
                          }
                        }}
                        className="rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted/70"
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="truncate text-[13px] font-medium text-foreground">
                            {entry.title}
                          </span>
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                            {entry.category}
                          </span>
                        </div>
                        <p className="line-clamp-2 text-[12px] text-muted-foreground">
                          {entry.summary ?? entry.body}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {results && results.cards.length === 0 && results.knowledge.length === 0 && !searching && (
                <div className="px-2 py-6 text-center text-[12px] text-muted-foreground">
                  Sin resultados en Postgres.
                </div>
              )}
            </div>
          )}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setFilterOpen(true)}
          className="gap-1.5 border-border/40 bg-card text-[13px] text-muted-foreground hover:bg-muted/80 hover:text-foreground"
        >
          <Filter className="h-3.5 w-3.5" />
          Filtrar
          {activeFilterCount > 0 && (
            <span className="rounded bg-muted px-1 text-[10px] text-foreground">
              {activeFilterCount}
            </span>
          )}
        </Button>

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
            title={showTerminal ? "Ocultar HEO Copilot" : "HEO Copilot"}
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

      <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
        <SheetContent side="right" className="w-[24rem] sm:max-w-[24rem]">
          <SheetHeader>
            <SheetTitle>Filtros backend-first</SheetTitle>
            <SheetDescription>
              Consulta real contra Postgres para tareas y documentación.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 px-4">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Tag</label>
              <Input
                value={tagFilter}
                onChange={(e) => dispatch({ type: "SET_TAG_FILTER", value: e.target.value })}
                placeholder="backend, neon, migracion..."
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Estado</label>
              <select
                value={statusFilter}
                onChange={(e) => dispatch({ type: "SET_STATUS_FILTER", value: e.target.value })}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                <option value="">Todos</option>
                <option value="idea_bruta">Idea bruta</option>
                <option value="clarificando">Clarificando</option>
                <option value="validando">Validando</option>
                <option value="en_proceso">En proceso</option>
                <option value="desarrollo">Desarrollo</option>
                <option value="qa">QA</option>
                <option value="listo">Listo</option>
                <option value="produccion">Producción</option>
                <option value="archivado">Archivado</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Prioridad</label>
              <select
                value={priorityFilter}
                onChange={(e) => dispatch({ type: "SET_PRIORITY_FILTER", value: e.target.value })}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                <option value="">Todas</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            {selectedProjectId && (
              <div className="rounded-lg border border-border/40 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                Scope actual: {project?.name ?? selectedProjectId}
              </div>
            )}
          </div>

          <SheetFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                dispatch({ type: "CLEAR_SEARCH_FILTERS" });
              }}
            >
              Limpiar filtros
            </Button>
            <Button type="button" onClick={() => setFilterOpen(false)}>
              Aplicar
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </header>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X, Terminal, Search, Filter, FileText, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSentinel, useSentinelDispatch } from "@/lib/state/sentinel-store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CreateTaskModal } from "@/components/modals/create-task-modal";
import { focusCardById } from "@/lib/board/focus-card";
import type { SearchResponse, KnowledgeEntry, SearchCardResult } from "@/types/knowledge";

type SearchEntry =
  | { kind: "card"; key: string; cardId: string; projectId: string; item: SearchCardResult }
  | {
      kind: "knowledge";
      key: string;
      cardId: string | null;
      projectId: string | null;
      item: KnowledgeEntry;
    };

const viewLabels: Record<string, string> = {
  board: "Board",
  timeline: "Timeline",
  backlog: "Backlog",
};

const statusOptions = [
  { value: "", label: "Todos" },
  { value: "idea_bruta", label: "Idea bruta" },
  { value: "clarificando", label: "Clarificando" },
  { value: "validando", label: "Validando" },
  { value: "en_proceso", label: "En proceso" },
  { value: "desarrollo", label: "Desarrollo" },
  { value: "qa", label: "QA" },
  { value: "listo", label: "Listo" },
  { value: "produccion", label: "Produccion" },
  { value: "archivado", label: "Archivado" },
];

const priorityOptions = [
  { value: "", label: "Todas" },
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

interface TopBarProps {
  showTerminal?: boolean;
  onToggleTerminal?: () => void;
}

interface ActiveFilterChip {
  key: "tag" | "status" | "priority";
  label: string;
  value: string;
  clear: () => void;
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const filterButtonRef = useRef<HTMLButtonElement | null>(null);
  const filterPopoverRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchPopoverRef = useRef<HTMLDivElement | null>(null);
  const searchWrapperRef = useRef<HTMLDivElement | null>(null);

  const project =
    selectedProjectId != null
      ? projects.find((p) => p.id === selectedProjectId)
      : undefined;

  const hasActiveSearch = Boolean(searchQuery.trim() || statusFilter || priorityFilter || tagFilter);
  const activeFilterCount = [statusFilter, priorityFilter, tagFilter].filter(Boolean).length;

  const activeFilters = useMemo(
    () =>
      [
        tagFilter
          ? {
              key: "tag",
              label: "Tag",
              value: tagFilter,
              clear: () => dispatch({ type: "SET_TAG_FILTER", value: "" }),
            }
          : null,
        statusFilter
          ? {
              key: "status",
              label: "Estado",
              value:
                statusOptions.find((option) => option.value === statusFilter)?.label ?? statusFilter,
              clear: () => dispatch({ type: "SET_STATUS_FILTER", value: "" }),
            }
          : null,
        priorityFilter
          ? {
              key: "priority",
              label: "Prioridad",
              value:
                priorityOptions.find((option) => option.value === priorityFilter)?.label ??
                priorityFilter,
              clear: () => dispatch({ type: "SET_PRIORITY_FILTER", value: "" }),
            }
          : null,
      ].filter((value): value is ActiveFilterChip => value !== null),
    [dispatch, priorityFilter, statusFilter, tagFilter],
  );

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

  useEffect(() => {
    if (!filterOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (filterPopoverRef.current?.contains(target) || filterButtonRef.current?.contains(target)) {
        return;
      }
      setFilterOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setFilterOpen(false);
      filterButtonRef.current?.focus();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [filterOpen]);

  const flatResults = useMemo<SearchEntry[]>(() => {
    if (!results) return [];
    const cardEntries: SearchEntry[] = results.cards.map((card) => ({
      kind: "card",
      key: `card:${card.id}`,
      cardId: card.id,
      projectId: card.projectId,
      item: card,
    }));
    const knowledgeEntries: SearchEntry[] = results.knowledge.map((entry) => ({
      kind: "knowledge",
      key: `knowledge:${entry.id}`,
      cardId: entry.sourceTaskId ?? null,
      projectId: entry.projectId ?? null,
      item: entry,
    }));
    return [...cardEntries, ...knowledgeEntries];
  }, [results]);

  const flatCount = flatResults.length;

  // Sincroniza el índice activo con el set actual de resultados
  useEffect(() => {
    setActiveIndex((current) =>
      flatResults.length === 0 ? 0 : Math.min(current, flatResults.length - 1),
    );
  }, [flatResults]);

  // Abre el popover automáticamente cuando hay búsqueda activa o estamos cargando.
  useEffect(() => {
    if (hasActiveSearch || searching) {
      setSearchOpen(true);
    }
  }, [hasActiveSearch, searching]);

  // Cierra al hacer click fuera del wrapper de búsqueda
  useEffect(() => {
    if (!searchOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (searchWrapperRef.current?.contains(target)) return;
      if (searchPopoverRef.current?.contains(target)) return;
      setSearchOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [searchOpen]);

  const goGlobalBoard = () => {
    dispatch({ type: "SELECT_PROJECT", projectId: null });
    dispatch({ type: "SET_VIEW", view: "board" });
  };

  const clearProjectOnly = () => {
    dispatch({ type: "SELECT_PROJECT", projectId: null });
  };

  const clearSearchQuery = () => {
    dispatch({ type: "SET_SEARCH_QUERY", query: "" });
  };

  const clearFiltersOnly = () => {
    dispatch({ type: "SET_TAG_FILTER", value: "" });
    dispatch({ type: "SET_STATUS_FILTER", value: "" });
    dispatch({ type: "SET_PRIORITY_FILTER", value: "" });
    setFilterOpen(false);
    filterButtonRef.current?.focus();
  };

  const closeSearch = useCallback(
    (options: { clearQuery?: boolean; blur?: boolean } = {}) => {
      const { clearQuery = false, blur = false } = options;
      setSearchOpen(false);
      if (clearQuery) {
        dispatch({ type: "SET_SEARCH_QUERY", query: "" });
      }
      if (blur) {
        searchInputRef.current?.blur();
      }
    },
    [dispatch],
  );

  const navigateToCard = useCallback(
    (cardId: string, projectId: string) => {
      // Mantener proyecto actual si aplica:
      // - Global (null): permanecer en global, la card aparece sin re-filtrar.
      // - Filtrado y la card pertenece a otro proyecto: cambiar al proyecto del card
      //   (necesario para que el deep-link de board lo encuentre tras filtrar).
      if (selectedProjectId !== null && selectedProjectId !== projectId) {
        dispatch({ type: "SELECT_PROJECT", projectId });
      }
      // El provider escucha FOCUS_CARD_EVENT y dispatcha SET_VIEW("board") + SELECT_CARD
      // (ver lib/state/sentinel-store.tsx). Reusamos la única fuente de verdad de focus.
      dispatch({ type: "SET_VIEW", view: "board" });
      focusCardById(cardId);
      closeSearch({ clearQuery: true, blur: true });
    },
    [closeSearch, dispatch, selectedProjectId],
  );

  const navigateToResult = useCallback(
    (entry: SearchEntry) => {
      if (entry.kind === "card") {
        navigateToCard(entry.cardId, entry.projectId);
        return;
      }
      // Documentación: si está vinculada a una tarea, abrir esa tarea reutilizando
      // el deep-link. Si no, cerrar el popover sin alterar el board (no hay panel
      // de detalle de knowledge todavía y rompería UX abrir una vista vacía).
      if (entry.cardId && entry.projectId) {
        navigateToCard(entry.cardId, entry.projectId);
        return;
      }
      closeSearch({ blur: true });
    },
    [closeSearch, navigateToCard],
  );

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeSearch({ clearQuery: true, blur: true });
      return;
    }
    if (!searchOpen || flatResults.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % flatResults.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => (i - 1 + flatResults.length) % flatResults.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const target = flatResults[activeIndex] ?? flatResults[0];
      if (target) navigateToResult(target);
    }
  };

  return (
    <>
      <header className="sentinel-topbar flex h-12 shrink-0 items-center gap-2 border-b border-border/40 bg-background px-6">
      <nav
        className="flex min-w-0 flex-1 items-center gap-2 text-sm"
        aria-label="Ubicacion en el workspace"
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
        <div ref={searchWrapperRef} className="relative w-80">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(e) => dispatch({ type: "SET_SEARCH_QUERY", query: e.target.value })}
            onFocus={() => {
              if (hasActiveSearch || searching) setSearchOpen(true);
            }}
            onKeyDown={handleSearchKeyDown}
            placeholder="Buscar tareas y documentacion del workspace..."
            className="h-8 rounded-lg border-border/40 bg-muted/70 pl-8 pr-8 text-[13px]"
            aria-label="Buscar tareas y documentacion del workspace"
            aria-autocomplete="list"
            aria-expanded={searchOpen && (hasActiveSearch || searching)}
            aria-controls="sentinel-search-popover"
            aria-activedescendant={
              searchOpen && flatResults.length > 0
                ? `sentinel-search-result-${activeIndex}`
                : undefined
            }
            role="combobox"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={clearSearchQuery}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Limpiar busqueda"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}

          {searchOpen && (hasActiveSearch || searching) && (
            <div
              ref={searchPopoverRef}
              id="sentinel-search-popover"
              role="listbox"
              aria-label="Resultados de busqueda"
              className="absolute right-0 top-[calc(100%+0.5rem)] z-40 w-[28rem] rounded-xl border border-border/50 bg-popover p-2 shadow-xl"
            >
              <div className="mb-2 flex items-center justify-between px-2 pt-1 text-[11px] text-muted-foreground">
                <span>{searching ? "Buscando..." : `${flatCount} resultado(s)`}</span>
                {activeFilterCount > 0 && <span>{activeFilterCount} filtro(s)</span>}
              </div>

              {results && flatResults.length > 0 && (
                <div className="flex max-h-[28rem] flex-col gap-2 overflow-y-auto">
                  {results.cards.length > 0 && (
                    <div>
                      <p className="px-2 pb-1 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                        Tareas
                      </p>
                      <div className="flex flex-col gap-1">
                        {results.cards.map((card, idx) => {
                          const flatIdx = idx;
                          const selected = activeIndex === flatIdx;
                          return (
                            <button
                              key={card.id}
                              id={`sentinel-search-result-${flatIdx}`}
                              type="button"
                              role="option"
                              aria-selected={selected}
                              onMouseEnter={() => setActiveIndex(flatIdx)}
                              onClick={() => navigateToCard(card.id, card.projectId)}
                              className={cn(
                                "rounded-lg px-2 py-2 text-left transition-colors",
                                selected ? "bg-muted/80" : "hover:bg-muted/70",
                              )}
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
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {results.knowledge.length > 0 && (
                    <div>
                      <p className="px-2 pb-1 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                        Documentacion
                      </p>
                      <div className="flex flex-col gap-1">
                        {results.knowledge.map((entry, idx) => {
                          const flatIdx = results.cards.length + idx;
                          const selected = activeIndex === flatIdx;
                          const linked = Boolean(entry.projectId && entry.sourceTaskId);
                          return (
                            <button
                              key={entry.id}
                              id={`sentinel-search-result-${flatIdx}`}
                              type="button"
                              role="option"
                              aria-selected={selected}
                              onMouseEnter={() => setActiveIndex(flatIdx)}
                              onClick={() => {
                                if (entry.projectId && entry.sourceTaskId) {
                                  navigateToCard(entry.sourceTaskId, entry.projectId);
                                } else {
                                  closeSearch({ blur: true });
                                }
                              }}
                              className={cn(
                                "rounded-lg px-2 py-2 text-left transition-colors",
                                selected ? "bg-muted/80" : "hover:bg-muted/70",
                                !linked && "cursor-default opacity-80",
                              )}
                              title={
                                linked
                                  ? "Abrir tarea origen"
                                  : "Sin tarea origen vinculada"
                              }
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
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {results && results.cards.length === 0 && results.knowledge.length === 0 && !searching && (
                <div className="px-2 py-5 text-center text-[12px] text-muted-foreground">
                  Sin resultados.
                </div>
              )}
            </div>
          )}
        </div>

        <div className="relative">
          <Button
            ref={filterButtonRef}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setFilterOpen((prev) => !prev)}
            className={cn(
              "gap-1.5 border-border/45 bg-card text-[13px] text-muted-foreground hover:bg-muted/80 hover:text-foreground",
              filterOpen && "border-border/70 bg-muted/80 text-foreground",
            )}
            aria-label={`Abrir filtros. ${activeFilterCount} activo(s)`}
            aria-expanded={filterOpen}
            aria-controls="sentinel-filter-popover"
            aria-haspopup="dialog"
          >
            <Filter className="h-3.5 w-3.5" />
            Filtrar
            {activeFilterCount > 0 && (
              <span className="rounded bg-muted px-1 text-[10px] text-foreground">
                {activeFilterCount}
              </span>
            )}
          </Button>

          {filterOpen && (
            <div
              id="sentinel-filter-popover"
              ref={filterPopoverRef}
              role="dialog"
              aria-modal="false"
              aria-label="Filtros del board"
              className="sentinel-glass-panel absolute right-0 top-[calc(100%+0.55rem)] z-50 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-border/60 bg-popover/98 p-3 shadow-[0_20px_55px_rgba(0,0,0,0.45)]"
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">
                    Filtros
                  </p>
                  <h3 className="mt-1 text-[13px] font-semibold tracking-[-0.02em] text-foreground">
                    Filtros del workspace
                  </h3>
                  <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                    Se aplican al instante sin salir del board.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFilterOpen(false);
                    filterButtonRef.current?.focus();
                  }}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border/40 bg-background/70 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/40"
                  aria-label="Cerrar filtros"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {selectedProjectId && (
                <div className="mb-3 rounded-xl border border-border/35 bg-black/15 px-2.5 py-2 text-[11px] text-muted-foreground">
                  Proyecto activo: <span className="font-medium text-foreground/90">{project?.name ?? selectedProjectId}</span>
                </div>
              )}

              {activeFilters.length > 0 && (
                <div className="mb-3">
                  <div className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/75">
                    Activos
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {activeFilters.map((filter) => (
                      <span
                        key={filter.key}
                        className="sentinel-filter-chip inline-flex items-center gap-1 rounded-lg border border-border/35 px-2 py-1 text-[11px] text-foreground"
                      >
                        <span className="text-muted-foreground/80">{filter.label}</span>
                        <span>{filter.value}</span>
                        <button
                          type="button"
                          onClick={filter.clear}
                          className="rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/40"
                          aria-label={`Quitar filtro de ${filter.label.toLowerCase()}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label htmlFor="sentinel-filter-tag" className="text-[11px] font-medium text-muted-foreground">
                    Tag
                  </label>
                  <Input
                    id="sentinel-filter-tag"
                    value={tagFilter}
                    onChange={(e) => dispatch({ type: "SET_TAG_FILTER", value: e.target.value })}
                    placeholder="backend, neon, migracion..."
                    className="h-8 border-border/45 bg-black/20 text-[12px] shadow-none"
                    aria-label="Filtrar por tag"
                    autoFocus
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="sentinel-filter-status"
                      className="text-[11px] font-medium text-muted-foreground"
                    >
                      Estado
                    </label>
                    <select
                      id="sentinel-filter-status"
                      value={statusFilter}
                      onChange={(e) => dispatch({ type: "SET_STATUS_FILTER", value: e.target.value })}
                      className="h-8 w-full rounded-lg border border-border/45 bg-black/20 px-2.5 text-[12px] text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/40"
                      aria-label="Filtrar por estado"
                    >
                      {statusOptions.map((option) => (
                        <option key={option.value || "all-status"} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="sentinel-filter-priority"
                      className="text-[11px] font-medium text-muted-foreground"
                    >
                      Prioridad
                    </label>
                    <select
                      id="sentinel-filter-priority"
                      value={priorityFilter}
                      onChange={(e) => dispatch({ type: "SET_PRIORITY_FILTER", value: e.target.value })}
                      className="h-8 w-full rounded-lg border border-border/45 bg-black/20 px-2.5 text-[12px] text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/40"
                      aria-label="Filtrar por prioridad"
                    >
                      {priorityOptions.map((option) => (
                        <option key={option.value || "all-priority"} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/35 pt-3">
                <span className="text-[11px] text-muted-foreground">
                  {activeFilterCount > 0 ? `${activeFilterCount} filtro(s) activo(s)` : "Sin filtros activos"}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearFiltersOnly}
                  className="h-7 px-2.5 text-[12px]"
                  aria-label="Limpiar filtros"
                >
                  Limpiar filtros
                </Button>
              </div>
            </div>
          )}
        </div>

        {onToggleTerminal && (
          <button
            type="button"
            onClick={onToggleTerminal}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-lg border border-border/40 px-2.5 text-[12px] font-medium transition-colors",
              showTerminal
                ? "bg-primary/15 text-foreground ring-1 ring-primary/25"
                : "bg-muted text-foreground/70 hover:bg-muted/90 hover:text-foreground",
            )}
            title={showTerminal ? "Ocultar terminal local" : "Abrir terminal local"}
            aria-label={showTerminal ? "Ocultar terminal local" : "Abrir terminal local"}
          >
            <Terminal className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Terminal</span>
          </button>
        )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setCreateTaskOpen(true)}
          className="h-8 gap-1.5 border-border/45 bg-card px-2.5 text-[12px] text-foreground/85 hover:bg-muted/80"
          title="Crear una nueva tarea en el board"
          aria-label="Crear una nueva tarea en el board"
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Nueva tarea</span>
        </Button>
      </div>
    </header>

      <CreateTaskModal
        open={createTaskOpen}
        onOpenChange={setCreateTaskOpen}
        defaultProjectId={selectedProjectId}
      />
    </>
  );
}

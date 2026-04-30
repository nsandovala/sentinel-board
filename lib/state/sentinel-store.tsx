"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
  type Dispatch,
  type ReactNode,
} from "react";

import {
  sentinelReducer,
  type SentinelState,
  type SentinelAction,
} from "./sentinel-reducer";
import type { SentinelCard } from "@/types/card";
import type { CardComment } from "@/types/comment";
import type { DockEvent } from "@/types/event";
import type { Project } from "@/types/project";
import type { CardStatus } from "@/types/enums";
import type { KnowledgeEntry } from "@/types/knowledge";

const initialState: SentinelState = {
  projects: [],
  cards: [],
  events: [],
  knowledgeEntries: [],
  cardComments: [],
  cardCommentsFor: null,
  selectedCardId: null,
  selectedProjectId: null,
  searchQuery: "",
  statusFilter: "",
  priorityFilter: "",
  tagFilter: "",
  activeView: "board",
  focusSession: { state: "idle", elapsed: 0 },
};

const StateCtx = createContext<SentinelState>(initialState);
const DispatchCtx = createContext<Dispatch<SentinelAction>>(() => {});
const RefreshCtx = createContext<() => void>(() => {});

async function hydrateFromDB(
  dispatch: Dispatch<SentinelAction>,
  state: Pick<
    SentinelState,
    "selectedProjectId" | "searchQuery" | "statusFilter" | "priorityFilter" | "tagFilter"
  >,
) {
  try {
    const params = new URLSearchParams();
    if (state.selectedProjectId) params.set("projectId", state.selectedProjectId);
    if (state.searchQuery.trim()) params.set("q", state.searchQuery.trim());
    if (state.statusFilter) params.set("status", state.statusFilter);
    if (state.priorityFilter) params.set("priority", state.priorityFilter);
    if (state.tagFilter) params.set("tag", state.tagFilter);

    const taskUrl = params.toString() ? `/api/tasks?${params.toString()}` : "/api/tasks";
    const knowledgeUrl = params.toString()
      ? `/api/knowledge?${params.toString()}`
      : "/api/knowledge";

    const [tasksRes, projectsRes, eventsRes, knowledgeRes] = await Promise.allSettled([
      fetch(taskUrl).then((r) => r.json()),
      fetch("/api/projects").then((r) => r.json()),
      fetch("/api/events").then((r) => r.json()),
      fetch(knowledgeUrl).then((r) => r.json()),
    ]);

    const cards: SentinelCard[] =
      tasksRes.status === "fulfilled" && tasksRes.value.ok && Array.isArray(tasksRes.value.tasks)
        ? tasksRes.value.tasks
        : [];

    const projects: Project[] | undefined =
      projectsRes.status === "fulfilled" &&
        projectsRes.value.ok &&
        Array.isArray(projectsRes.value.projects)
        ? projectsRes.value.projects
        : undefined;

    const events: DockEvent[] | undefined =
      eventsRes.status === "fulfilled" &&
        eventsRes.value.ok &&
        Array.isArray(eventsRes.value.events)
        ? eventsRes.value.events.map((e: DockEvent & { timestamp?: string }) => ({
            ...e,
            timestamp: new Date(e.timestamp),
          }))
        : undefined;

    const knowledgeEntries: KnowledgeEntry[] =
      knowledgeRes.status === "fulfilled" &&
        knowledgeRes.value.ok &&
        Array.isArray(knowledgeRes.value.knowledge)
        ? knowledgeRes.value.knowledge
        : [];

    dispatch({
      type: "HYDRATE",
      cards,
      projects,
      events,
      knowledgeEntries,
    });
  } catch {
    // Keep current UI state if hydration fails completely.
  }
}

function persistMoveCard(cardId: string, status: CardStatus) {
  fetch(`/api/tasks/${cardId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  }).catch(() => {});
}

function persistCreateCard(card: SentinelCard) {
  fetch("/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(card),
  }).catch(() => {});
}

function persistDeleteCard(cardId: string) {
  fetch(`/api/tasks/${cardId}`, { method: "DELETE" }).catch(() => {});
}

function persistUpdateCard(cardId: string, updates: Partial<Omit<SentinelCard, "id">>) {
  fetch(`/api/tasks/${cardId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  }).catch(() => {});
}

function persistComment(comment: CardComment) {
  fetch(`/api/tasks/${comment.cardId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(comment),
  }).catch(() => {});
}

function persistFocusAction(
  action: "start" | "end" | "pause" | "resume",
  project?: string,
  elapsedSeconds?: number,
) {
  const body: Record<string, unknown> = { action };
  if (project) body.project = project;
  if (elapsedSeconds != null) body.elapsedSeconds = elapsedSeconds;
  fetch("/api/focus-sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {});
}

async function loadCardComments(
  cardId: string,
  dispatch: Dispatch<SentinelAction>,
) {
  try {
    const res = await fetch(`/api/tasks/${cardId}/comments`).then((r) => r.json());
    if (res.ok && Array.isArray(res.comments)) {
      dispatch({ type: "SET_CARD_COMMENTS", cardId, comments: res.comments });
    }
  } catch {
    dispatch({ type: "SET_CARD_COMMENTS", cardId, comments: [] });
  }
}

export function SentinelProvider({ children }: { children: ReactNode }) {
  const [state, rawDispatch] = useReducer(sentinelReducer, initialState);
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const dispatch: Dispatch<SentinelAction> = useCallback(
    (action: SentinelAction) => {
      rawDispatch(action);

      if (action.type === "MOVE_CARD") {
        persistMoveCard(action.cardId, action.status);
      }
      if (action.type === "CREATE_CARD") {
        persistCreateCard(action.card);
      }
      if (action.type === "DELETE_CARD") {
        persistDeleteCard(action.cardId);
      }
      if (action.type === "UPDATE_CARD") {
        persistUpdateCard(action.cardId, action.updates);
      }
      if (action.type === "ADD_COMMENT") {
        persistComment(action.comment);
      }
      if (action.type === "START_FOCUS") {
        persistFocusAction("start", action.project);
      }
      if (action.type === "END_FOCUS") {
        persistFocusAction("end", undefined, stateRef.current.focusSession.elapsed);
      }
      if (action.type === "SELECT_CARD" && action.cardId) {
        loadCardComments(action.cardId, rawDispatch);
      }
    },
    [],
  );

  const refresh = useCallback(() => {
    hydrateFromDB(rawDispatch, {
      selectedProjectId: stateRef.current.selectedProjectId,
      searchQuery: stateRef.current.searchQuery,
      statusFilter: stateRef.current.statusFilter,
      priorityFilter: stateRef.current.priorityFilter,
      tagFilter: stateRef.current.tagFilter,
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [
    refresh,
    state.selectedProjectId,
    state.searchQuery,
    state.statusFilter,
    state.priorityFilter,
    state.tagFilter,
  ]);

  return (
    <StateCtx.Provider value={state}>
      <DispatchCtx.Provider value={dispatch}>
        <RefreshCtx.Provider value={refresh}>{children}</RefreshCtx.Provider>
      </DispatchCtx.Provider>
    </StateCtx.Provider>
  );
}

export function useSentinel() {
  return useContext(StateCtx);
}

export function useSentinelDispatch() {
  return useContext(DispatchCtx);
}

export function useSentinelRefresh() {
  return useContext(RefreshCtx);
}

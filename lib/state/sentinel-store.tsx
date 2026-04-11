"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react";

import { cards as mockCards } from "@/lib/mock/cards";
import { projects as mockProjects } from "@/lib/mock/projects";
import { initialEvents } from "@/lib/console/mock-events";

import {
  sentinelReducer,
  type SentinelState,
  type SentinelAction,
} from "./sentinel-reducer";
import type { SentinelCard } from "@/types/card";
import type { DockEvent } from "@/types/event";
import type { Project } from "@/types/project";
import type { CardStatus } from "@/types/enums";

const initialState: SentinelState = {
  projects: mockProjects,
  cards: mockCards,
  events: initialEvents,
  selectedCardId: null,
  selectedProjectId: null,
  activeView: "board",
  focusSession: { state: "idle", elapsed: 0 },
};

const StateCtx = createContext<SentinelState>(initialState);
const DispatchCtx = createContext<Dispatch<SentinelAction>>(() => {});

async function hydrateFromDB(dispatch: Dispatch<SentinelAction>) {
  try {
    const [tasksRes, projectsRes, eventsRes] = await Promise.all([
      fetch("/api/tasks").then((r) => r.json()),
      fetch("/api/projects").then((r) => r.json()),
      fetch("/api/events").then((r) => r.json()),
    ]);

    const cards: SentinelCard[] | undefined =
      tasksRes.ok && Array.isArray(tasksRes.tasks) && tasksRes.tasks.length > 0
        ? tasksRes.tasks
        : undefined;

    const projects: Project[] | undefined =
      projectsRes.ok && Array.isArray(projectsRes.projects) && projectsRes.projects.length > 0
        ? projectsRes.projects
        : undefined;

    const events: DockEvent[] | undefined =
      eventsRes.ok && Array.isArray(eventsRes.events) && eventsRes.events.length > 0
        ? eventsRes.events.map((e: DockEvent & { timestamp?: string }) => ({
            ...e,
            timestamp: new Date(e.timestamp),
          }))
        : undefined;

    if (cards) {
      dispatch({ type: "HYDRATE", cards, projects, events });
    }
  } catch {
    // DB unavailable — keep mocks
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

export function SentinelProvider({ children }: { children: ReactNode }) {
  const [state, rawDispatch] = useReducer(sentinelReducer, initialState);

  const dispatch: Dispatch<SentinelAction> = useCallback(
    (action: SentinelAction) => {
      rawDispatch(action);

      if (action.type === "MOVE_CARD") {
        persistMoveCard(action.cardId, action.status);
      }
      if (action.type === "CREATE_CARD") {
        persistCreateCard(action.card);
      }
    },
    [],
  );

  useEffect(() => {
    hydrateFromDB(rawDispatch);
  }, []);

  return (
    <StateCtx.Provider value={state}>
      <DispatchCtx.Provider value={dispatch}>{children}</DispatchCtx.Provider>
    </StateCtx.Provider>
  );
}

export function useSentinel() {
  return useContext(StateCtx);
}

export function useSentinelDispatch() {
  return useContext(DispatchCtx);
}

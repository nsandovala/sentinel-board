"use client";

import {
  createContext,
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

export function SentinelProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(sentinelReducer, initialState);

  useEffect(() => {
    fetch("/api/tasks")
      .then((res) => res.json())
      .then((json) => {
        if (json.ok && Array.isArray(json.tasks) && json.tasks.length > 0) {
          dispatch({ type: "LOAD_AGENT_CARDS", cards: json.tasks });
        }
      })
      .catch(() => {
        // silently fall back to mock data
      });
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

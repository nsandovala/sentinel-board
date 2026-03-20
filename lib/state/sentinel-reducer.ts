import type { SentinelCard } from "@/types/card";
import type { Project } from "@/types/project";
import type { DockEvent } from "@/types/event";
import type { FocusSession } from "@/types/timer";
import type { CardStatus } from "@/types/enums";

export type ActiveView = "board" | "timeline" | "backlog";

export interface SentinelState {
  projects: Project[];
  cards: SentinelCard[];
  events: DockEvent[];
  selectedCardId: string | null;
  activeView: ActiveView;
  focusSession: FocusSession;
}

export type SentinelAction =
  | { type: "SELECT_CARD"; cardId: string | null }
  | { type: "SET_VIEW"; view: ActiveView }
  | { type: "MOVE_CARD"; cardId: string; status: CardStatus }
  | { type: "CREATE_CARD"; card: SentinelCard }
  | { type: "ADD_EVENT"; event: DockEvent }
  | { type: "START_FOCUS"; project?: string }
  | { type: "END_FOCUS" }
  | { type: "TICK_FOCUS" };

let eventSeq = 100;

export function createEvent(
  eventType: DockEvent["type"],
  message: string,
): DockEvent {
  eventSeq++;
  return { id: `ev-${eventSeq}`, type: eventType, message, timestamp: new Date() };
}

export function sentinelReducer(
  state: SentinelState,
  action: SentinelAction,
): SentinelState {
  switch (action.type) {
    case "SELECT_CARD":
      return { ...state, selectedCardId: action.cardId };

    case "SET_VIEW":
      return { ...state, activeView: action.view };

    case "MOVE_CARD": {
      const cards = state.cards.map((c) =>
        c.id === action.cardId ? { ...c, status: action.status } : c,
      );
      const card = state.cards.find((c) => c.id === action.cardId);
      const evt = createEvent(
        "command",
        `"${card?.title ?? action.cardId}" → ${action.status}`,
      );
      return { ...state, cards, events: [...state.events, evt] };
    }

    case "CREATE_CARD":
      return {
        ...state,
        cards: [...state.cards, action.card],
        events: [
          ...state.events,
          createEvent("command", `Tarea creada: "${action.card.title}"`),
        ],
      };

    case "ADD_EVENT":
      return { ...state, events: [...state.events, action.event] };

    case "START_FOCUS": {
      const label = action.project ? `Foco iniciado en ${action.project}` : "Foco iniciado";
      return {
        ...state,
        focusSession: {
          state: "running",
          project: action.project,
          startedAt: new Date(),
          elapsed: 0,
        },
        events: [...state.events, createEvent("focus", label)],
      };
    }

    case "END_FOCUS": {
      const mins = Math.floor(state.focusSession.elapsed / 60);
      const proj = state.focusSession.project;
      const label = proj
        ? `Foco terminado — ${mins} min en ${proj}`
        : `Foco terminado — ${mins} min`;
      return {
        ...state,
        focusSession: { state: "idle", elapsed: 0 },
        events: [...state.events, createEvent("focus", label)],
      };
    }

    case "TICK_FOCUS":
      if (state.focusSession.state !== "running") return state;
      return {
        ...state,
        focusSession: {
          ...state.focusSession,
          elapsed: state.focusSession.elapsed + 1,
        },
      };

    default:
      return state;
  }
}

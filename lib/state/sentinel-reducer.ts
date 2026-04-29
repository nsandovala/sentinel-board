import type { SentinelCard } from "@/types/card";
import type { Project } from "@/types/project";
import type { DockEvent } from "@/types/event";
import type { CardComment } from "@/types/comment";
import type { FocusSession } from "@/types/timer";
import type { CardStatus } from "@/types/enums";
import type { KnowledgeEntry } from "@/types/knowledge";
import { STATUS_LABELS } from "@/lib/console/status-labels";

export type ActiveView = "board" | "timeline" | "backlog";

export interface SentinelState {
  projects: Project[];
  cards: SentinelCard[];
  events: DockEvent[];
  knowledgeEntries: KnowledgeEntry[];
  cardComments: CardComment[];
  cardCommentsFor: string | null;
  selectedCardId: string | null;
  /** null = sin filtro (comportamiento previo del board y vistas) */
  selectedProjectId: string | null;
  searchQuery: string;
  statusFilter: string;
  priorityFilter: string;
  tagFilter: string;
  activeView: ActiveView;
  focusSession: FocusSession;
}

export type SentinelAction =
  | { type: "SELECT_CARD"; cardId: string | null }
  | { type: "SELECT_PROJECT"; projectId: string | null }
  | { type: "SET_SEARCH_QUERY"; query: string }
  | { type: "SET_STATUS_FILTER"; value: string }
  | { type: "SET_PRIORITY_FILTER"; value: string }
  | { type: "SET_TAG_FILTER"; value: string }
  | { type: "CLEAR_SEARCH_FILTERS" }
  | { type: "SET_VIEW"; view: ActiveView }
  | { type: "MOVE_CARD"; cardId: string; status: CardStatus }
  | { type: "DELETE_CARD"; cardId: string }
  | { type: "CREATE_CARD"; card: SentinelCard }
  | { type: "UPDATE_CARD"; cardId: string; updates: Partial<Omit<SentinelCard, "id">> }
  | { type: "LOAD_AGENT_CARDS"; cards: SentinelCard[] }
  | {
      type: "HYDRATE";
      cards: SentinelCard[];
      projects?: Project[];
      events?: DockEvent[];
      knowledgeEntries?: KnowledgeEntry[];
    }
  | { type: "ADD_EVENT"; event: DockEvent }
  | { type: "SET_CARD_COMMENTS"; cardId: string; comments: CardComment[] }
  | { type: "ADD_COMMENT"; comment: CardComment }
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

    case "SELECT_PROJECT": {
      const projectId = action.projectId;
      let selectedCardId = state.selectedCardId;
      if (projectId && selectedCardId) {
        const c = state.cards.find((x) => x.id === selectedCardId);
        if (c && c.projectId !== projectId) selectedCardId = null;
      }
      return {
        ...state,
        selectedProjectId: projectId,
        selectedCardId,
      };
    }

    case "SET_SEARCH_QUERY":
      return { ...state, searchQuery: action.query };

    case "SET_STATUS_FILTER":
      return { ...state, statusFilter: action.value };

    case "SET_PRIORITY_FILTER":
      return { ...state, priorityFilter: action.value };

    case "SET_TAG_FILTER":
      return { ...state, tagFilter: action.value };

    case "CLEAR_SEARCH_FILTERS":
      return {
        ...state,
        searchQuery: "",
        statusFilter: "",
        priorityFilter: "",
        tagFilter: "",
      };

    case "SET_VIEW":
      return { ...state, activeView: action.view };

    case "MOVE_CARD": {
      const cards = state.cards.map((c) =>
        c.id === action.cardId ? { ...c, status: action.status } : c,
      );
      const card = state.cards.find((c) => c.id === action.cardId);
      const statusLabel = STATUS_LABELS[action.status] ?? action.status;
      const evt = createEvent(
        "command",
        `"${card?.title ?? action.cardId}" → ${statusLabel}`,
      );
      return { ...state, cards, events: [...state.events, evt] };
    }

    case "DELETE_CARD": {
      const card = state.cards.find((c) => c.id === action.cardId);
      if (!card) return state;
      const cards = state.cards.filter((c) => c.id !== action.cardId);
      const evt = createEvent("command", `Tarea eliminada: "${card.title}"`);
      return {
        ...state,
        cards,
        selectedCardId: state.selectedCardId === action.cardId ? null : state.selectedCardId,
        events: [...state.events, evt],
      };
    }

    case "CREATE_CARD": {
      const proj = state.projects.find((p) => p.id === action.card.projectId);
      const projLabel = proj?.name ?? "sin proyecto";
      return {
        ...state,
        cards: [...state.cards, action.card],
        events: [
          ...state.events,
          createEvent(
            "command",
            `Tarea creada: "${action.card.title}" · ${projLabel}`,
          ),
        ],
      };
    }

    case "UPDATE_CARD": {
      const cardExists = state.cards.some((c) => c.id === action.cardId);
      if (!cardExists) return state;
      const cards = state.cards.map((c) =>
        c.id === action.cardId ? { ...c, ...action.updates } : c,
      );
      return { ...state, cards };
    }

    case "HYDRATE": {
      return {
        ...state,
        cards: action.cards,
        ...(action.projects ? { projects: action.projects } : {}),
        ...(action.events ? { events: action.events } : {}),
        ...(action.knowledgeEntries ? { knowledgeEntries: action.knowledgeEntries } : {}),
      };
    }

    case "LOAD_AGENT_CARDS": {
      const existingIds = new Set(state.cards.map((c) => c.id));
      const newCards = action.cards.filter((c) => !existingIds.has(c.id));
      if (newCards.length === 0) return state;
      return {
        ...state,
        cards: [...state.cards, ...newCards],
        events: [
          ...state.events,
          createEvent("system", `${newCards.length} tarea(s) cargadas desde amon-agents`),
        ],
      };
    }

    case "ADD_EVENT":
      return { ...state, events: [...state.events, action.event] };

    case "SET_CARD_COMMENTS":
      return {
        ...state,
        cardComments: action.comments,
        cardCommentsFor: action.cardId,
      };

    case "ADD_COMMENT": {
      const comments =
        state.cardCommentsFor === action.comment.cardId
          ? [action.comment, ...state.cardComments]
          : state.cardComments;
      return {
        ...state,
        cardComments: comments,
        events: [
          ...state.events,
          createEvent("system", `Comentario en "${state.cards.find((c) => c.id === action.comment.cardId)?.title ?? action.comment.cardId}"`),
        ],
      };
    }

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

/** Determina si un mensaje de timeline se asocia a un proyecto (nombre, slug o tarjetas citadas). */
export function eventRelatesToProject(
  message: string,
  project: Project,
  allCards: SentinelCard[],
): boolean {
  const lower = message.toLowerCase();
  if (lower.includes(project.name.toLowerCase())) return true;
  const slugPhrase = project.slug.replace(/_/g, " ").toLowerCase();
  if (slugPhrase && lower.includes(slugPhrase)) return true;

  const titles = new Set(
    allCards.filter((c) => c.projectId === project.id).map((c) => c.title),
  );
  for (const m of message.matchAll(/"([^"]{1,200})"/g)) {
    const t = (m[1] ?? "").trim();
    if (titles.has(t)) return true;
  }
  const created = message.match(/Tarea creada:\s*"([^"]+)"/i);
  if (created?.[1]?.trim() && titles.has(created[1].trim())) return true;
  return false;
}

export function filterCardsByProjectId(
  cards: SentinelCard[],
  projectId: string | null,
): SentinelCard[] {
  if (!projectId) return cards;
  return cards.filter((c) => c.projectId === projectId);
}

export function filterEventsByProjectId(
  events: DockEvent[],
  projectId: string | null,
  projects: Project[],
  cards: SentinelCard[],
): DockEvent[] {
  if (!projectId) return events;
  const project = projects.find((p) => p.id === projectId);
  if (!project) return events;
  return events.filter((e) => eventRelatesToProject(e.message, project, cards));
}

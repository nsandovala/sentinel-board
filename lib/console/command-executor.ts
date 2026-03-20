import type { Dispatch } from "react";
import type { ParsedCommand } from "@/types/command";
import type { SentinelCard } from "@/types/card";
import type { Project } from "@/types/project";
import type { CardStatus } from "@/types/enums";
import type { SentinelAction } from "@/lib/state/sentinel-reducer";
import { createEvent } from "@/lib/state/sentinel-reducer";

const STATUS_ALIASES: Record<string, CardStatus> = {
  "idea bruta": "idea_bruta",
  idea: "idea_bruta",
  clarificando: "clarificando",
  validando: "validando",
  "en proceso": "en_proceso",
  proceso: "en_proceso",
  desarrollo: "desarrollo",
  dev: "desarrollo",
  qa: "qa",
  listo: "listo",
  done: "listo",
  produccion: "produccion",
  "producción": "produccion",
  prod: "produccion",
  production: "produccion",
  archivado: "archivado",
  "prototipo funcional": "desarrollo",
};

function fuzzyMatch(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

function findCard(cards: SentinelCard[], query: string): SentinelCard | undefined {
  const q = query.toLowerCase();
  return (
    cards.find((c) => c.title.toLowerCase() === q) ??
    cards.find((c) => fuzzyMatch(c.title, q))
  );
}

function findProject(projects: Project[], query: string): Project | undefined {
  const q = query.toLowerCase();
  return (
    projects.find((p) => p.name.toLowerCase() === q) ??
    projects.find((p) => fuzzyMatch(p.name, q) || fuzzyMatch(p.slug, q))
  );
}

function resolveStatus(raw: string): CardStatus | null {
  const key = raw.toLowerCase().trim();
  return STATUS_ALIASES[key] ?? null;
}

let cardSeq = 100;

export function executeCommandWithDispatch(
  parsed: ParsedCommand,
  cards: SentinelCard[],
  projects: Project[],
  dispatch: Dispatch<SentinelAction>,
): { success: boolean; message: string } {
  switch (parsed.action) {
    case "move_status": {
      const card = findCard(cards, parsed.target ?? "");
      if (!card) return { success: false, message: `No encontré tarjeta: "${parsed.target}"` };

      const status = resolveStatus(parsed.value ?? "");
      if (!status) return { success: false, message: `Estado no reconocido: "${parsed.value}"` };

      dispatch({ type: "MOVE_CARD", cardId: card.id, status });
      return { success: true, message: `"${card.title}" → ${status}` };
    }

    case "create_task": {
      const project = parsed.project ? findProject(projects, parsed.project) : projects[0];
      if (!project) return { success: false, message: `Proyecto no encontrado: "${parsed.project}"` };

      cardSeq++;
      const newCard: SentinelCard = {
        id: `c-new-${cardSeq}`,
        title: parsed.target ?? "Nueva tarea",
        status: "idea_bruta",
        type: "task",
        priority: "medium",
        tags: [],
        projectId: project.id,
        checklist: [],
        blocked: false,
      };
      dispatch({ type: "CREATE_CARD", card: newCard });
      return { success: true, message: `Tarea creada: "${newCard.title}" en ${project.name}` };
    }

    case "log_time": {
      const project = parsed.project ? findProject(projects, parsed.project) : null;
      const hours = parsed.value ?? "0";
      const label = project
        ? `${hours}h registradas en ${project.name}`
        : `${hours}h registradas`;
      dispatch({ type: "ADD_EVENT", event: createEvent("command", label) });
      return { success: true, message: label };
    }

    case "start_focus": {
      const project = parsed.project ? findProject(projects, parsed.project) : null;
      dispatch({ type: "START_FOCUS", project: project?.name ?? parsed.project });
      return { success: true, message: project ? `Foco iniciado en ${project.name}` : "Foco iniciado" };
    }

    case "end_focus": {
      dispatch({ type: "END_FOCUS" });
      return { success: true, message: "Foco terminado" };
    }

    default:
      return { success: false, message: `Comando no reconocido: "${parsed.raw}"` };
  }
}

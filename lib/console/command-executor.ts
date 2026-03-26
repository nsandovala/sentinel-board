import type { Dispatch } from "react";
import type { ParsedCommand } from "@/types/command";
import type { SentinelCard } from "@/types/card";
import type { Project } from "@/types/project";
import type { CardStatus } from "@/types/enums";
import type { SentinelAction } from "@/lib/state/sentinel-reducer";
import { STATUS_LABELS } from "@/lib/console/status-labels";
import type { CommandIntent } from "@/lib/console/command-parser";
import { areTaskTitlesDuplicateOrSimilar } from "@/lib/console/local-analysis";

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

const FORMAT_CHEATSHEET = [
  "crear tarea [título] en [proyecto]",
  'mover "[título]" a desarrollo',
  "iniciar foco en [proyecto]",
  "terminar foco",
  "registrar [n] horas en [proyecto]",
] as const;

const INTENT_LABEL: Record<CommandIntent, string> = {
  create_task: "Crear tarea",
  move_status: "Mover tarjeta",
  start_focus: "Iniciar foco",
  end_focus: "Terminar foco",
  log_time: "Registrar tiempo",
  analyze: "Analizar (otra pestaña)",
  unknown: "Sin clasificar",
};

export interface CommandDispatchResult {
  success: boolean;
  message: string;
  hints?: string[];
}

export interface CommandExecuteContext {
  /** Intención heurística cuando el parseo devolvió `unknown` pero hay pistas */
  intentGuess?: CommandIntent;
}

function fuzzyMatch(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

function normalizeCardQuery(query: string): string {
  return query
    .trim()
    .replace(/^["'«]|["'»]$/g, "")
    .trim()
    .toLowerCase();
}

function findCard(cards: SentinelCard[], query: string): SentinelCard | undefined {
  const q = normalizeCardQuery(query);
  if (!q) return undefined;
  return (
    cards.find((c) => c.title.toLowerCase() === q) ??
    cards.find((c) => fuzzyMatch(c.title, q))
  );
}

/** Títulos parecidos o, si no hay coincidencia, una muestra del tablero (para ayuda). */
export function suggestCardTitlesForMove(cards: SentinelCard[], query: string, limit = 5): string[] {
  const raw = query.trim().replace(/^["'«]|["'»]$/g, "").trim();
  const q = raw.toLowerCase();
  const words = q.split(/\s+/).filter((w) => w.length > 1);

  const scored = cards
    .map((c) => {
      const t = c.title.toLowerCase();
      let score = 0;
      if (t === q) score += 50;
      if (q.length >= 2 && t.includes(q)) score += 20;
      for (const w of words) {
        if (w.length > 2 && t.includes(w)) score += 4;
      }
      return { title: c.title, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.title);

  if (scored.length > 0) return scored;
  return cards.slice(0, limit).map((c) => c.title);
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
  if (STATUS_ALIASES[key]) return STATUS_ALIASES[key];
  const fromLabel = (Object.entries(STATUS_LABELS) as [CardStatus, string][]).find(
    ([, label]) => label.toLowerCase() === key,
  );
  return fromLabel?.[0] ?? null;
}

function statusHintList(): string {
  const labels = [...new Set(Object.values(STATUS_LABELS))];
  return labels.slice(0, 10).join(", ");
}

function suggestCardsForQuery(cards: SentinelCard[], query: string): string[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const words = q.split(/\s+/).filter((w) => w.length > 1);
  const scored = cards
    .map((c) => {
      const t = c.title.toLowerCase();
      let score = 0;
      if (t === q) score += 20;
      if (t.includes(q)) score += 10;
      for (const w of words) {
        if (t.includes(w)) score += 3;
      }
      return { c, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  return scored.map(({ c }) => `mover "${c.title}" a [estado] — ejemplo: mover "${c.title}" a desarrollo`);
}

function hintsForIntent(intent: CommandIntent, projects: Project[]): string[] {
  switch (intent) {
    case "create_task":
      return [
        "crear tarea [título] en [proyecto]",
        ...projects.slice(0, 3).map((p) => `crear tarea ejemplo en ${p.name}`),
      ];
    case "move_status":
      return ['mover "título de tarjeta" a qa', "cambiar mi tarea a listo"];
    case "start_focus":
      return projects.slice(0, 3).map((p) => `iniciar foco en ${p.name}`).concat(["terminar foco"]);
    case "log_time":
      return projects.slice(0, 3).map((p) => `registrar 1 horas en ${p.name}`);
    case "end_focus":
      return ["terminar foco", "detener foco"];
    case "analyze":
      return ["Usá la pestaña «Analizar» para texto largo."];
    default:
      return FORMAT_CHEATSHEET.map((h) => `Ej.: ${h}`);
  }
}

function unknownCommandHints(
  raw: string,
  cards: SentinelCard[],
  projects: Project[],
  intentGuess?: CommandIntent,
): string[] {
  const fromCards = suggestCardsForQuery(cards, raw);
  const intentHints =
    intentGuess && intentGuess !== "unknown"
      ? [`Pista: parecía «${INTENT_LABEL[intentGuess]}» — ajustá el formato.`, ...hintsForIntent(intentGuess, projects)]
      : [...FORMAT_CHEATSHEET.map((h) => `Formato válido: ${h}`)];
  return [...fromCards, ...intentHints];
}

let cardSeq = 100;

export function nextCardId(): string {
  cardSeq++;
  return `c-new-${cardSeq}`;
}

/** Tarjeta existente en el mismo proyecto con título igual o muy parecido (p. ej. desde Analizar). */
export function findExistingAnalysisDuplicate(
  cards: SentinelCard[],
  candidateTitle: string,
  projectId: string,
): SentinelCard | undefined {
  const trimmed = candidateTitle.replace(/\s+/g, " ").trim();
  if (!trimmed) return undefined;
  return cards.find(
    (c) => c.projectId === projectId && areTaskTitlesDuplicateOrSimilar(c.title, trimmed),
  );
}

export function executeCommandWithDispatch(
  parsed: ParsedCommand,
  cards: SentinelCard[],
  projects: Project[],
  dispatch: Dispatch<SentinelAction>,
  context?: CommandExecuteContext,
): CommandDispatchResult {
  switch (parsed.action) {
    case "move_status": {
      const targetQ = (parsed.target ?? "").trim();
      if (!targetQ) {
        return {
          success: false,
          message: "Mover: falta el nombre de la tarjeta.",
          hints: hintsForIntent("move_status", projects),
        };
      }

      const card = findCard(cards, targetQ);
      if (!card) {
        const samples = suggestCardTitlesForMove(cards, targetQ, 6);
        const sampleBlock =
          samples.length > 0
            ? [
                "En el tablero ahora (o más parecidas a lo que escribiste):",
                ...samples.map((t) => `· ${t}`),
              ]
            : ["No hay tarjetas en el tablero todavía."];
        return {
          success: false,
          message: `No encontré tarjeta para «${parsed.target}». Revisá el título completo o usá comillas si tiene varias palabras.`,
          hints: [
            ...sampleBlock,
            "",
            "Pasos: 1) Mirá el título exacto en una columna 2) Copiá o escribí una parte única 3) Luego « a [estado] »",
            ...suggestCardsForQuery(cards, targetQ),
            ...hintsForIntent("move_status", projects),
          ],
        };
      }

      const statusRaw = (parsed.value ?? "").trim();
      if (!statusRaw) {
        return {
          success: false,
          message: "Mover: falta el estado destino (después de « a » o « → »).",
          hints: [`mover "${card.title}" a desarrollo`, `Estados frecuentes: ${statusHintList()}`],
        };
      }

      const status = resolveStatus(statusRaw);
      if (!status) {
        return {
          success: false,
          message: `El estado «${parsed.value}» no es válido o no lo reconozco.`,
          hints: [
            `Estados reconocidos (ejemplos): ${statusHintList()}`,
            `Prueba: mover "${card.title}" a desarrollo`,
          ],
        };
      }

      dispatch({ type: "MOVE_CARD", cardId: card.id, status });
      return { success: true, message: `"${card.title}" → ${STATUS_LABELS[status] ?? status}` };
    }

    case "create_task": {
      const title = (parsed.target ?? "").trim();
      if (!title) {
        return {
          success: false,
          message: "Crear tarea: falta el título.",
          hints: hintsForIntent("create_task", projects),
        };
      }

      if (projects.length === 0) {
        return {
          success: false,
          message: "No hay proyectos en el tablero; no se puede asignar la tarea.",
          hints: [],
        };
      }

      if (projects.length > 1 && !(parsed.project ?? "").trim()) {
        return {
          success: false,
          message: "Hay más de un proyecto: indicá cuál con « en NombreProyecto » al final.",
          hints: projects.map((p) => `crear tarea ${title} en ${p.name}`),
        };
      }

      const project = parsed.project ? findProject(projects, parsed.project) : projects[0];
      if (!project) {
        return {
          success: false,
          message: `No encontré el proyecto «${parsed.project}».`,
          hints: projects.map((p) => `crear tarea ${title} en ${p.name}`),
        };
      }

      const newCard: SentinelCard = {
        id: nextCardId(),
        title,
        status: "idea_bruta",
        type: "task",
        priority: "medium",
        tags: [],
        projectId: project.id,
        checklist: [],
        blocked: false,
      };
      dispatch({ type: "CREATE_CARD", card: newCard });
      return {
        success: true,
        message: `Tarea creada: "${newCard.title}" en ${project.name}`,
      };
    }

    case "log_time": {
      const hours = (parsed.value ?? "").trim();
      if (!hours || Number.isNaN(Number(hours))) {
        return {
          success: false,
          message: "Registrar tiempo: cantidad de horas no válida.",
          hints: hintsForIntent("log_time", projects),
        };
      }

      const projQ = (parsed.project ?? "").trim();
      if (!projQ) {
        return {
          success: false,
          message: "Registrar tiempo: falta el proyecto (« en … »).",
          hints: projects.map((p) => `registrar ${hours} horas en ${p.name}`),
        };
      }

      const project = findProject(projects, projQ);
      if (!project) {
        return {
          success: false,
          message: `Proyecto no encontrado para el registro: «${parsed.project}».`,
          hints: projects.map((p) => `registrar ${hours} horas en ${p.name}`),
        };
      }

      const label = `${hours}h registradas en ${project.name}`;
      return { success: true, message: label };
    }

    case "start_focus": {
      const project = parsed.project ? findProject(projects, parsed.project) : null;
      if (parsed.project && !project) {
        return {
          success: false,
          message: `No encontré el proyecto «${parsed.project}» para iniciar foco.`,
          hints: projects.map((p) => `iniciar foco en ${p.name}`),
        };
      }
      dispatch({ type: "START_FOCUS", project: project?.name ?? parsed.project });
      return {
        success: true,
        message: project
          ? `Foco iniciado en «${project.name}»`
          : "Foco iniciado sin proyecto concreto (podés añadir « en … » la próxima vez).",
      };
    }

    case "end_focus": {
      dispatch({ type: "END_FOCUS" });
      return { success: true, message: "Foco terminado." };
    }

    default: {
      const raw = parsed.raw.trim() || "(vacío)";
      const ig = context?.intentGuess;
      return {
        success: false,
        message:
          ig && ig !== "unknown"
            ? `No pude interpretar el comando (parecía «${INTENT_LABEL[ig]}»): «${raw}»`
            : `Comando no reconocido: «${raw}»`,
        hints: unknownCommandHints(parsed.raw, cards, projects, ig),
      };
    }
  }
}

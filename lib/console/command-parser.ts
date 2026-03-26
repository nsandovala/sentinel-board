import type { CommandAction, ParsedCommand } from "@/types/command";

function collapseSpaces(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

/** Intención detectada (incl. analizar en pestaña equivocada). */
export type CommandIntent =
  | "create_task"
  | "move_status"
  | "start_focus"
  | "end_focus"
  | "log_time"
  | "analyze"
  | "unknown";

export interface ParseCommandLineResult {
  parsed: ParsedCommand;
  intent: CommandIntent;
  /** Si es false, no ejecutar el executor: solo mostrar ayuda en log / UI */
  readyToExecute: boolean;
  helpLines: string[];
  /** Plantillas útiles para autocompletado contextual o mensajes */
  exampleSnippets: string[];
}

const DEFAULT_EXAMPLES = [
  'crear tarea revisar informe en Sentinel',
  'mover "Título de tarjeta" a desarrollo',
  "iniciar foco en Sentinel",
  "terminar foco",
  "registrar 1.5 horas en Sentinel",
] as const;

function actionToIntent(action: CommandAction): CommandIntent {
  if (action === "unknown") return "unknown";
  return action;
}

/** Split "target … a|→|->|to … status" from the right. */
function splitTargetAndStatus(rest: string): { target: string; value: string } | null {
  const lower = rest.toLowerCase();
  const seps: { s: string; len: number }[] = [
    { s: " a ", len: 3 },
    { s: " hacia ", len: 7 },
    { s: " hasta ", len: 7 },
    { s: " → ", len: 3 },
    { s: " -> ", len: 4 },
    { s: " to ", len: 4 },
  ];
  let best = -1;
  let sepLen = 0;
  for (const { s, len } of seps) {
    const i = lower.lastIndexOf(s);
    if (i > best) {
      best = i;
      sepLen = len;
    }
  }
  if (best < 0) return null;
  let target = rest.slice(0, best).trim();
  const value = rest.slice(best + sepLen).trim();
  target = target.replace(/^["'«]|["'»]$/g, "").trim();
  if (!target || !value) return null;
  return { target, value };
}

function tryParseMove(trimmed: string): ParsedCommand | null {
  const prefixes = [
    /^mover\s+(.+)$/i,
    /^cambiar\s+(.+)$/i,
    /^pasar\s+(.+)$/i,
    /^llevar\s+(.+)$/i,
    /^pon(?:er)?\s+(.+)$/i,
    /^mv\s+(.+)$/i,
    /^m\s+(.+)$/i,
  ];
  for (const re of prefixes) {
    const m = trimmed.match(re);
    if (!m?.[1]) continue;
    const split = splitTargetAndStatus(m[1].trim());
    if (split) {
      return {
        action: "move_status",
        raw: trimmed,
        target: split.target,
        value: split.value,
      };
    }
  }
  return null;
}

function tryParseCreateTask(trimmed: string): ParsedCommand | null {
  const patterns = [
    /^(?:crear|agregar|add)(?:\s+una)?\s+tarea\s*:?\s*(.+)$/i,
    /^(?:nueva|nuevo)\s+tarea\s+(.+)$/i,
    /^(?:añadir|añade)(?:\s+una)?\s+tarea\s+(.+)$/i,
    /^recordar\s*:\s*(.+)$/i,
    /^todo\s*:\s*(.+)$/i,
    /^(?:pendiente|pend)\s*:\s*(.+)$/i,
    /^necesito\s+(?:una\s+)?tarea\s+(.+)$/i,
  ];
  let m: RegExpMatchArray | null = null;
  for (const re of patterns) {
    m = trimmed.match(re);
    if (m?.[1]) break;
  }
  if (!m?.[1]) return null;
  const rest = m[1].trim();
  const lower = rest.toLowerCase();
  const enIdx = lower.lastIndexOf(" en ");
  let target: string;
  let project: string | undefined;
  if (enIdx >= 0) {
    target = rest.slice(0, enIdx).trim();
    project = rest.slice(enIdx + 4).trim();
  } else {
    target = rest;
  }
  target = target.replace(/^["'«]|["'»]$/g, "").trim();
  if (!target) return null;
  return { action: "create_task", raw: trimmed, target, project };
}

function tryParseLogTime(trimmed: string): ParsedCommand | null {
  const patterns = [
    /^(?:registrar|registra|anotar|loguear|log)\s+(\d+(?:[.,]\d+)?)\s*(?:h|horas?)?\s+(?:en\s+)?(.+)$/i,
    /^(?:registrar|registra)\s+(\d+(?:[.,]\d+)?)\s*(?:hora|horas)\s+(?:en\s+)?(.+)$/i,
    /^(?:met[ií]|ech[eé]|puse)\s+(\d+(?:[.,]\d+)?)\s*(?:h|horas?)?\s+(?:en\s+)?(.+)$/i,
    /^(\d+(?:[.,]\d+)?)\s*(?:h|horas)\s+en\s+(.+)$/i,
  ];
  for (const re of patterns) {
    const m = trimmed.match(re);
    if (m?.[1] && m[2]) {
      const proj = m[2].trim();
      if (!proj) return null;
      return {
        action: "log_time",
        raw: trimmed,
        value: m[1].replace(",", "."),
        project: proj,
      };
    }
  }
  return null;
}

function tryParseStartFocus(trimmed: string): ParsedCommand | null {
  const patterns = [
    /^(?:iniciar|empezar|comenzar)\s+foco(?:\s+en\s+(.+))?$/i,
    /^(?:activar|poner)\s+foco(?:\s+en\s+(.+))?$/i,
    /^foco\s+(?:en\s+)?(.+)$/i,
    /^trabajar\s+(?:en|foco\s+en)\s+(.+)$/i,
    /^enfocar(?:me)?\s+en\s+(.+)$/i,
    /^concentrar(?:me)?\s+en\s+(.+)$/i,
    /^sesi[oó]n\s+(?:de\s+)?foco\s+(?:en\s+)?(.+)$/i,
  ];
  for (const re of patterns) {
    const m = trimmed.match(re);
    if (m) {
      const project = m[1]?.trim();
      return { action: "start_focus", raw: trimmed, project: project || undefined };
    }
  }
  return null;
}

function tryParseEndFocus(trimmed: string): ParsedCommand | null {
  if (
    /^(?:terminar|detener|parar|fin|stop|cancelar)\s+foco/i.test(trimmed) ||
    /^foco\s+(?:off|stop|fin)/i.test(trimmed) ||
    /^salir\s+de\s+foco/i.test(trimmed) ||
    /^acabar\s+foco/i.test(trimmed)
  ) {
    return { action: "end_focus", raw: trimmed };
  }
  return null;
}

interface PatternRule {
  action: CommandAction;
  patterns: RegExp[];
  extract: (match: RegExpMatchArray, raw: string) => Partial<ParsedCommand>;
}

const rules: PatternRule[] = [
  {
    action: "move_status",
    patterns: [
      /mover\s+["'](.+?)["']\s+(?:a|→|->|to)\s+(.+)/i,
      /mover\s+(.+?)\s+(?:a|→|->)\s+(.+)/i,
    ],
    extract: (match) => ({
      target: match[1]?.trim(),
      value: match[2]?.trim(),
    }),
  },
  {
    action: "create_task",
    patterns: [
      /^tarea\s*:\s*(.+?)(?:\s+@\s+(.+))?$/i,
      /^\[\s*\]\s*(.+)$/i,
    ],
    extract: (match) => ({
      target: match[1]?.trim(),
      project: match[2]?.trim(),
    }),
  },
  {
    action: "log_time",
    patterns: [/^(\d+)\s*h\s+en\s+(.+)$/i],
    extract: (match) => ({
      value: match[1]?.trim(),
      project: match[2]?.trim(),
    }),
  },
];

function parseCommandCore(trimmed: string): ParsedCommand {
  if (!trimmed) return { action: "unknown", raw: "" };

  const structural =
    tryParseEndFocus(trimmed) ??
    tryParseMove(trimmed) ??
    tryParseCreateTask(trimmed) ??
    tryParseLogTime(trimmed) ??
    tryParseStartFocus(trimmed);

  if (structural) return structural;

  for (const rule of rules) {
    for (const pattern of rule.patterns) {
      const match = trimmed.match(pattern);
      if (match) {
        return {
          action: rule.action,
          raw: trimmed,
          ...rule.extract(match, trimmed),
        };
      }
    }
  }

  return { action: "unknown", raw: trimmed };
}

function detectAnalyzeWrongTab(trimmed: string): ParseCommandLineResult | null {
  if (trimmed.length > 120) return null;
  if (!/^(analizar|análisis|analiza)(\s+|$)/i.test(trimmed)) return null;
  return {
    parsed: { action: "unknown", raw: trimmed },
    intent: "analyze",
    readyToExecute: false,
    helpLines: [
      "Parece análisis de texto: usá la pestaña «Analizar» y pega el contexto ahí (análisis local, sin LLM).",
      "En «Comando» van órdenes cortas (crear, mover, foco, registrar tiempo).",
    ],
    exampleSnippets: ["cambiar a pestaña Analizar → pegar notas → botón Analizar"],
  };
}

function checkIncompleteMove(trimmed: string): ParseCommandLineResult | null {
  if (/^(?:mover|cambiar|pasar|llevar|pon(?:er)?|mv)\s*$/i.test(trimmed)) {
    return {
      parsed: { action: "unknown", raw: trimmed },
      intent: "move_status",
      readyToExecute: false,
      helpLines: [
        "Comando «mover» incompleto: necesitás título de tarjeta y estado destino.",
        "Separá con « a », « → » o « to » entre título y estado.",
      ],
      exampleSnippets: ['mover "Onboarding checkout" a desarrollo', "cambiar bug login a qa"],
    };
  }

  if (/^m\s*$/i.test(trimmed)) {
    return {
      parsed: { action: "unknown", raw: trimmed },
      intent: "move_status",
      readyToExecute: false,
      helpLines: [
        "Solo «m» es ambiguo. Si querés mover, escribí «mover», «mv» o «cambiar» seguido de la tarjeta.",
      ],
      exampleSnippets: ['mover "Mi tarea" a listo'],
    };
  }

  const movePrefixes = [
    /^mover\s+(.+)$/i,
    /^cambiar\s+(.+)$/i,
    /^pasar\s+(.+)$/i,
    /^llevar\s+(.+)$/i,
    /^pon(?:er)?\s+(.+)$/i,
    /^mv\s+(.+)$/i,
    /^m\s+(.+)$/i,
  ];
  for (const re of movePrefixes) {
    const m = trimmed.match(re);
    if (!m?.[1]) continue;
    const rest = m[1].trim();
    if (rest.length === 0) {
      return {
        parsed: { action: "unknown", raw: trimmed },
        intent: "move_status",
        readyToExecute: false,
        helpLines: ["Falta el nombre de la tarjeta y el estado después de «mover»."],
        exampleSnippets: ['mover "Título" a idea'],
      };
    }
    if (!splitTargetAndStatus(rest)) {
      return {
        parsed: { action: "unknown", raw: trimmed },
        intent: "move_status",
        readyToExecute: false,
        helpLines: [
          "No veo estado destino: falta « a [estado] » (o « → [estado] »).",
          `Revisá que exista separador antes del estado (ej. desarrollo, qa, listo).`,
        ],
        exampleSnippets: [`mover "${rest.length > 40 ? rest.slice(0, 37) + "…" : rest}" a desarrollo`],
      };
    }
  }
  return null;
}

function checkIncompleteCreate(trimmed: string): ParseCommandLineResult | null {
  if (
    /^(?:crear|agregar|add)(?:\s+una)?\s+tarea\s*:?\s*$/i.test(trimmed) ||
    /^(?:nueva|nuevo)\s+tarea\s*$/i.test(trimmed) ||
    /^(?:añadir|añade)(?:\s+una)?\s+tarea\s*$/i.test(trimmed) ||
    /^(?:recordar|todo|pendiente|pend)\s*:\s*$/i.test(trimmed)
  ) {
    return {
      parsed: { action: "unknown", raw: trimmed },
      intent: "create_task",
      readyToExecute: false,
      helpLines: [
        "Falta el título de la tarea.",
        "Opcional: « en NombreProyecto » si tenés más de un proyecto.",
      ],
      exampleSnippets: ["crear tarea Revisar métricas en Sentinel", "nueva tarea Llamar al cliente"],
    };
  }
  return null;
}

function checkIncompleteLog(trimmed: string): ParseCommandLineResult | null {
  if (/^(?:registrar|registra|anotar|loguear|log)\s*$/i.test(trimmed)) {
    return {
      parsed: { action: "unknown", raw: trimmed },
      intent: "log_time",
      readyToExecute: false,
      helpLines: [
        "Falta la cantidad de horas y el proyecto.",
        "Formato: registrar [número] horas en [proyecto] (también vale «2h en …»).",
      ],
      exampleSnippets: ["registrar 2 horas en Sentinel", "registrar 0.5h en Backend"],
    };
  }

  const onlyHours = trimmed.match(
    /^(?:registrar|registra|anotar|loguear|log)\s+(\d+(?:[.,]\d+)?)\s*(?:h|horas?)?\s*$/i,
  );
  if (onlyHours?.[1]) {
    const n = onlyHours[1].replace(",", ".");
    return {
      parsed: { action: "unknown", raw: trimmed },
      intent: "log_time",
      readyToExecute: false,
      helpLines: ["Falta « en [proyecto] » para saber dónde registrar el tiempo."],
      exampleSnippets: [`registrar ${n} horas en Sentinel`, `log ${n}h en Mi proyecto`],
    };
  }

  const metOnly = trimmed.match(
    /^(?:met[ií]|ech[eé]|puse)\s+(\d+(?:[.,]\d+)?)\s*(?:h|horas?)?\s*$/i,
  );
  if (metOnly?.[1]) {
    const n = metOnly[1].replace(",", ".");
    return {
      parsed: { action: "unknown", raw: trimmed },
      intent: "log_time",
      readyToExecute: false,
      helpLines: ["Falta el proyecto: « metí 2h en [proyecto] » o « registrar 2 horas en … »."],
      exampleSnippets: [`metí ${n}h en Sentinel`, `registrar ${n} horas en Backend`],
    };
  }
  return null;
}

function guessIntentFromUnknown(trimmed: string): CommandIntent {
  const t = trimmed.toLowerCase();
  if (/^(crear|nueva|nuevo|agregar|add|añadir|añade|recordar|todo|pendiente|necesito)\b/.test(t))
    return "create_task";
  if (/^(mover|cambiar|pasar|llevar|poner|pon|mv|m)\b/.test(t)) return "move_status";
  if (/\bfoco\b|^(iniciar|empezar|activar|poner|trabajar|enfocar)\b/.test(t)) return "start_focus";
  if (/^(registrar|registra|anotar|loguear|log)\b/.test(t) || /^\d+(?:[.,]\d+)?\s*h\s+en\b/.test(t))
    return "log_time";
  if (/^(terminar|detener|parar|fin|stop)\b.*foco|salir\s+de\s+foco/.test(t)) return "end_focus";
  return "unknown";
}

/**
 * Parseo con intención, validación de partes faltantes y textos de ayuda.
 * Si `readyToExecute` es false, no invocar `executeCommandWithDispatch`.
 */
export function parseCommandLine(input: string): ParseCommandLineResult {
  const trimmed = collapseSpaces(input);

  if (!trimmed) {
    return {
      parsed: { action: "unknown", raw: "" },
      intent: "unknown",
      readyToExecute: false,
      helpLines: ["Escribí un comando o elegí una sugerencia (flechas en el campo / Tab si está vacío)."],
      exampleSnippets: [...DEFAULT_EXAMPLES],
    };
  }

  const wrongAnalyze = detectAnalyzeWrongTab(trimmed);
  if (wrongAnalyze) return wrongAnalyze;

  const incMove = checkIncompleteMove(trimmed);
  if (incMove) return incMove;

  const incCreate = checkIncompleteCreate(trimmed);
  if (incCreate) return incCreate;

  const incLog = checkIncompleteLog(trimmed);
  if (incLog) return incLog;

  const parsed = parseCommandCore(trimmed);

  if (parsed.action !== "unknown") {
    return {
      parsed,
      intent: actionToIntent(parsed.action),
      readyToExecute: true,
      helpLines: [],
      exampleSnippets: [],
    };
  }

  return {
    parsed,
    intent: guessIntentFromUnknown(trimmed),
    readyToExecute: true,
    helpLines: [],
    exampleSnippets: [],
  };
}

/** Compatibilidad: solo el comando parseado (sin capa de validación). */
export function parseCommand(input: string): ParsedCommand {
  return parseCommandCore(collapseSpaces(input));
}

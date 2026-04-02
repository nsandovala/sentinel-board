import { readdir, readFile } from "node:fs/promises";
import { join, basename } from "node:path";
import type { SentinelCard, CodexLoopData, ChecklistItem } from "@/types/card";
import type { CardStatus, CardType, PriorityLevel } from "@/types/enums";
import type { Project } from "@/types/project";

const OUTPUTS_DIR = () => process.env.AMON_AGENTS_OUTPUTS_DIR ?? "";

interface RawPlan {
  task_id?: string;
  type?: string;
  title?: string;
  repo?: string;
  description?: string;
  goal?: string;
  scope?: string;
  files_to_touch?: string[];
  plan?: string[];
  risks?: string[];
  validations?: string[];
  done_when?: string[];
  status?: string;
  priority?: string;
  tags?: string[];
  codex_loop?: Record<string, string>;
}

const VALID_STATUSES: Set<string> = new Set([
  "idea_bruta", "clarificando", "validando", "en_proceso",
  "desarrollo", "qa", "listo", "produccion", "archivado",
]);

const VALID_PRIORITIES: Set<string> = new Set(["low", "medium", "high", "critical"]);

const VALID_TYPES: Set<string> = new Set([
  "idea", "feature", "bug", "task", "decision", "experiment", "deploy", "research",
]);

function inferStatus(raw: RawPlan, folder: string): CardStatus {
  if (raw.status && VALID_STATUSES.has(raw.status)) return raw.status as CardStatus;
  if (folder === "reviews") return "qa";
  if (folder === "adr") return "listo";
  return "clarificando";
}

function inferPriority(raw: RawPlan): PriorityLevel {
  if (raw.priority && VALID_PRIORITIES.has(raw.priority)) return raw.priority as PriorityLevel;
  return "medium";
}

function inferType(raw: RawPlan): CardType {
  const t = raw.type?.toLowerCase().replace(/_/g, " ") ?? "";
  if (t.includes("bug")) return "bug";
  if (t.includes("feature")) return "feature";
  if (t.includes("research")) return "research";
  if (t.includes("deploy")) return "deploy";
  if (t.includes("decision") || t.includes("adr")) return "decision";
  if (raw.type && VALID_TYPES.has(raw.type)) return raw.type as CardType;
  return "task";
}

function resolveProjectId(repo: string | undefined, projects: Project[]): string {
  if (!repo) return projects[0]?.id ?? "1";
  const lower = repo.toLowerCase();
  const match = projects.find(
    (p) =>
      p.slug.toLowerCase() === lower ||
      p.name.toLowerCase() === lower ||
      p.slug.toLowerCase().includes(lower) ||
      lower.includes(p.slug.toLowerCase()),
  );
  return match?.id ?? projects[0]?.id ?? "1";
}

function buildChecklist(raw: RawPlan): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  let idx = 0;
  for (const step of raw.plan ?? []) {
    items.push({ id: `chk-${idx++}`, text: step, status: "pending" });
  }
  for (const v of raw.validations ?? []) {
    items.push({ id: `chk-${idx++}`, text: `Validar: ${v}`, status: "pending" });
  }
  return items;
}

function buildCodexLoop(raw: RawPlan): CodexLoopData | undefined {
  if (raw.codex_loop) {
    return {
      problem: raw.codex_loop.problem,
      objective: raw.codex_loop.objective,
      hypothesis: raw.codex_loop.hypothesis,
      solution: raw.codex_loop.solution,
      validation: raw.codex_loop.validation,
      nextStep: raw.codex_loop.next_step,
    };
  }
  if (!raw.goal && !raw.scope) return undefined;
  return {
    problem: raw.goal ?? raw.title,
    objective: raw.scope ?? raw.goal,
    hypothesis: raw.risks?.[0] ? `Riesgo principal: ${raw.risks[0]}` : undefined,
    validation: raw.done_when?.[0],
  };
}

function buildDescription(raw: RawPlan): string {
  const parts: string[] = [];
  if (raw.description) parts.push(raw.description);
  if (raw.goal) parts.push(`Objetivo: ${raw.goal}`);
  if (raw.scope) parts.push(`Alcance: ${raw.scope}`);
  if (raw.files_to_touch?.length) {
    parts.push(`Archivos: ${raw.files_to_touch.join(", ")}`);
  }
  return parts.join("\n") || "";
}

function normalizeToCard(
  raw: RawPlan,
  folder: string,
  fileName: string,
  projects: Project[],
): SentinelCard {
  const id = raw.task_id ?? fileName.replace(/\.json$/, "");
  return {
    id: `amon-${folder}-${id}`,
    title: raw.title ?? id,
    description: buildDescription(raw) || undefined,
    status: inferStatus(raw, folder),
    type: inferType(raw),
    priority: inferPriority(raw),
    tags: raw.tags ?? [folder, raw.repo ?? ""].filter(Boolean),
    projectId: resolveProjectId(raw.repo, projects),
    checklist: buildChecklist(raw),
    codexLoop: buildCodexLoop(raw),
    blocked: false,
  };
}

async function readJsonFiles(dir: string): Promise<{ data: RawPlan; file: string }[]> {
  try {
    const entries = await readdir(dir);
    const jsons = entries.filter((f) => f.endsWith(".json"));
    const results: { data: RawPlan; file: string }[] = [];
    for (const file of jsons) {
      try {
        const raw = await readFile(join(dir, file), "utf-8");
        const parsed = JSON.parse(raw) as RawPlan;
        results.push({ data: parsed, file });
      } catch {
        // skip malformed files
      }
    }
    return results;
  } catch {
    return [];
  }
}

const SUBFOLDERS = ["plans", "reviews", "logs", "adr"] as const;

export async function loadAgentOutputs(projects: Project[]): Promise<SentinelCard[]> {
  const base = OUTPUTS_DIR();
  if (!base) return [];

  const cards: SentinelCard[] = [];

  for (const folder of SUBFOLDERS) {
    const files = await readJsonFiles(join(base, folder));
    for (const { data, file } of files) {
      cards.push(normalizeToCard(data, folder, basename(file), projects));
    }
  }

  return cards;
}

export async function loadAgentOutput(
  taskId: string,
  projects: Project[],
): Promise<SentinelCard | null> {
  const all = await loadAgentOutputs(projects);
  return all.find((c) => c.id === taskId) ?? null;
}

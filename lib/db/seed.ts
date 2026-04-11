/**
 * Seed script — populates the DB with the existing mock data.
 * Run: npm run db:seed
 */
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { join } from "node:path";
import { mkdirSync } from "node:fs";
import {
  projects,
  tasks,
  taskChecklistItems,
  events,
} from "./schema";

const DATA_DIR = join(process.cwd(), "data");
const DB_PATH = join(DATA_DIR, "sentinel.db");
mkdirSync(DATA_DIR, { recursive: true });

const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
const db = drizzle(sqlite);

// ── Mock data (inlined to avoid @/ alias issues in standalone scripts) ──────

const MOCK_PROJECTS = [
  { id: "1", name: "Jarvis Sentinel", slug: "jarvis_sentinel", repoUrl: "https://github.com/nsandovala/jarvis_sentinel", color: "#22c55e", status: "active" as const },
  { id: "2", name: "AMON Agents", slug: "amon_agents", repoUrl: "https://github.com/nsandovala/amon_agents", color: "#3b82f6", status: "active" as const },
  { id: "3", name: "AMON Website", slug: "amonwebsite", repoUrl: "https://github.com/nsandovala/amonwebsite", color: "#a855f7", status: "active" as const },
  { id: "4", name: "TBB AMON Delivery", slug: "tbb-amon-delivery-dev", repoUrl: "https://github.com/nsandovala/tbb-amon-delivery-dev", color: "#f97316", status: "active" as const },
  { id: "5", name: "Sentinel Board", slug: "sentinel-board", repoUrl: "https://github.com/nsandovala/sentinel-board", color: "#eab308", status: "active" as const },
];

const MOCK_CARDS = [
  {
    id: "c1",
    title: "Diseñar layout tipo IDE",
    description: "Definir sidebar izquierda, board central y panel derecho HEO.",
    status: "en_proceso",
    type: "feature",
    priority: "high",
    tags: ["ui", "layout", "core"],
    projectId: "5",
    blocked: false,
    checklist: [
      { id: "cl-1", text: "Definir grid principal", status: "done" },
      { id: "cl-2", text: "Crear sidebar colapsable", status: "in_progress" },
      { id: "cl-3", text: "Crear right panel HEO", status: "pending" },
      { id: "cl-4", text: "Revisar responsive en mobile", status: "blocked" },
    ],
  },
  {
    id: "c2",
    title: "Agregar proyecto TBB AMON Delivery al board",
    description: "Incluir repo y tareas iniciales del delivery dev.",
    status: "idea_bruta",
    type: "task",
    priority: "medium",
    tags: ["repo", "integration"],
    projectId: "4",
    blocked: false,
    checklist: [
      { id: "cl-5", text: "Vincular repositorio GitHub", status: "pending" },
      { id: "cl-6", text: "Definir tareas iniciales del sprint", status: "pending" },
    ],
  },
  {
    id: "c3",
    title: "Definir motor Código del Dinero",
    description: "Crear scoring inicial para priorización.",
    status: "validando",
    type: "research",
    priority: "high",
    tags: ["scoring", "codex"],
    projectId: "5",
    blocked: false,
    checklist: [
      { id: "cl-7", text: "Investigar modelos de scoring", status: "done" },
      { id: "cl-8", text: "Definir variables del motor", status: "done" },
      { id: "cl-9", text: "Crear fórmula base", status: "review" },
      { id: "cl-10", text: "Validar con datos reales", status: "in_progress" },
      { id: "cl-11", text: "Documentar criterios", status: "pending" },
    ],
  },
];

const MOCK_EVENTS = [
  { id: "ev-1", type: "system" as const, message: "Sentinel Board iniciado — Command Dock activo" },
  { id: "ev-2", type: "command" as const, message: '"Diseñar layout tipo IDE" movido a → en_proceso' },
  { id: "ev-3", type: "focus" as const, message: "Sesión de foco: 2h 15min en Sentinel Board" },
  { id: "ev-4", type: "heo_suggestion" as const, message: 'HEO: Llevas 3 días sin mover "Agregar proyecto TBB AMON Delivery"' },
];

// ── Seed ────────────────────────────────────────────────────────────────────

function seed() {
  console.log("Seeding Sentinel Board DB…");

  // Clear existing data (order matters for FK)
  db.delete(taskChecklistItems).run();
  db.delete(events).run();
  db.delete(tasks).run();
  db.delete(projects).run();

  // Projects
  for (const p of MOCK_PROJECTS) {
    db.insert(projects)
      .values({
        id: p.id,
        name: p.name,
        slug: p.slug,
        repoUrl: p.repoUrl,
        color: p.color,
        status: p.status,
      })
      .run();
  }
  console.log(`  ✓ ${MOCK_PROJECTS.length} proyectos`);

  // Tasks + checklist items
  let checklistCount = 0;
  for (const c of MOCK_CARDS) {
    db.insert(tasks)
      .values({
        id: c.id,
        title: c.title,
        description: c.description,
        status: c.status,
        type: c.type,
        priority: c.priority,
        tags: c.tags,
        projectId: c.projectId,
        blocked: c.blocked,
      })
      .run();

    for (let i = 0; i < c.checklist.length; i++) {
      const item = c.checklist[i];
      db.insert(taskChecklistItems)
        .values({
          id: item.id,
          taskId: c.id,
          text: item.text,
          status: item.status as "pending" | "in_progress" | "review" | "blocked" | "done",
          sortOrder: i,
        })
        .run();
      checklistCount++;
    }
  }
  console.log(`  ✓ ${MOCK_CARDS.length} tareas, ${checklistCount} checklist items`);

  // Events
  for (const e of MOCK_EVENTS) {
    db.insert(events)
      .values({ id: e.id, type: e.type, message: e.message })
      .run();
  }
  console.log(`  ✓ ${MOCK_EVENTS.length} eventos`);

  console.log("Seed completo.");
}

seed();
sqlite.close();

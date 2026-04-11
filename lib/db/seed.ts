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
  // ── Sentinel Board (id: 5) ──────────────────────────────────────────────
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
      { id: "cl-2", text: "Crear sidebar colapsable", status: "done" },
      { id: "cl-3", text: "Crear right panel HEO", status: "in_progress" },
      { id: "cl-4", text: "Revisar responsive en mobile", status: "blocked" },
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
  {
    id: "c-sb-persist",
    title: "Persistencia real con SQLite + Drizzle",
    description: "Etapa 1 completada: DB local-first, API CRUD, hydration desde DB.",
    status: "listo",
    type: "feature",
    priority: "high",
    tags: ["db", "backend", "etapa-1"],
    projectId: "5",
    blocked: false,
    checklist: [
      { id: "cl-p1", text: "Schema Drizzle con 6 tablas", status: "done" },
      { id: "cl-p2", text: "Seed desde mocks", status: "done" },
      { id: "cl-p3", text: "GET/POST /api/tasks", status: "done" },
      { id: "cl-p4", text: "PATCH /api/tasks/:id", status: "done" },
      { id: "cl-p5", text: "Store con hydration + dispatch persistente", status: "done" },
    ],
  },
  {
    id: "c-sb-etapa2",
    title: "Ingesta real de amon-agents desde DB",
    description: "Pipeline de ingesta: JSON → tabla agent_outputs → normalización → cards. Reemplazar lectura por filesystem.",
    status: "idea_bruta",
    type: "feature",
    priority: "high",
    tags: ["amon-agents", "pipeline", "etapa-2"],
    projectId: "5",
    blocked: false,
    checklist: [
      { id: "cl-e2-1", text: "Tabla agent_outputs con JSON crudo", status: "pending" },
      { id: "cl-e2-2", text: "Normalización idempotente a cards", status: "pending" },
      { id: "cl-e2-3", text: "Manejo de estados: new, parsed, linked, error", status: "pending" },
      { id: "cl-e2-4", text: "UI mínima de trazabilidad output → card", status: "pending" },
    ],
  },
  {
    id: "c-sb-agents",
    title: "Activar agentes qa-reviewer y state-guardian",
    description: "Definir prompts, contratos y wiring con el pipeline de agentes existente.",
    status: "idea_bruta",
    type: "task",
    priority: "medium",
    tags: ["agents", "qa", "state"],
    projectId: "5",
    blocked: false,
    checklist: [
      { id: "cl-ag1", text: "Completar prompt qa-reviewer", status: "pending" },
      { id: "cl-ag2", text: "Completar prompt state-guardian", status: "pending" },
      { id: "cl-ag3", text: "Integrar con run-agent.ts", status: "pending" },
      { id: "cl-ag4", text: "Emitir resultados como eventos en timeline", status: "pending" },
    ],
  },
  {
    id: "c-sb-dnd",
    title: "Sorting intra-columna y touch support",
    description: "Drag & drop dentro de la misma columna para reordenar. Soporte touch para mobile.",
    status: "idea_bruta",
    type: "feature",
    priority: "low",
    tags: ["dnd", "ux", "mobile"],
    projectId: "5",
    blocked: false,
    checklist: [
      { id: "cl-dnd1", text: "Sorting con @dnd-kit/sortable dentro de columna", status: "pending" },
      { id: "cl-dnd2", text: "Persistir sort_order en DB", status: "pending" },
      { id: "cl-dnd3", text: "Touch sensor para mobile", status: "pending" },
    ],
  },
  {
    id: "c-sb-dock-persist",
    title: "Persistir dock commands y focus sessions",
    description: "Tablas ya creadas en DB. Falta wiring: POST al ejecutar comandos y al iniciar/terminar foco.",
    status: "idea_bruta",
    type: "task",
    priority: "medium",
    tags: ["dock", "focus", "persistence"],
    projectId: "5",
    blocked: false,
    checklist: [
      { id: "cl-dp1", text: "POST /api/dock-commands al ejecutar comando", status: "pending" },
      { id: "cl-dp2", text: "POST /api/focus-sessions al iniciar/terminar", status: "pending" },
      { id: "cl-dp3", text: "Historial de foco en panel derecho", status: "pending" },
    ],
  },

  // ── TBB AMON Delivery (id: 4) ──────────────────────────────────────────
  {
    id: "c-tbb-env",
    title: "Completar .env con credenciales reales de Firebase",
    description: "Configurar FIREBASE_PROJECT_ID, CLIENT_EMAIL, PRIVATE_KEY, TENANT_ID en el servidor de producción.",
    status: "clarificando",
    type: "task",
    priority: "critical",
    tags: ["firebase", "config", "prod"],
    projectId: "4",
    blocked: false,
    checklist: [
      { id: "cl-tbb1", text: "Obtener service account key de Firebase Console", status: "pending" },
      { id: "cl-tbb2", text: "Configurar .env en servidor", status: "pending" },
      { id: "cl-tbb3", text: "Verificar conexión con firebase-admin", status: "pending" },
    ],
  },
  {
    id: "c-tbb-e2e",
    title: "Test end-to-end: pedido completo → Firebase Console",
    description: "Flujo completo: hola → menú → dirección → método pago → confirmar → verificar doc en Firestore.",
    status: "idea_bruta",
    type: "task",
    priority: "high",
    tags: ["testing", "e2e", "firebase"],
    projectId: "4",
    blocked: true,
    blockerReason: "Necesita credenciales Firebase reales primero",
    checklist: [
      { id: "cl-tbb-e1", text: "Flujo completo de pedido via WhatsApp", status: "pending" },
      { id: "cl-tbb-e2", text: "Validar dirección inválida (rechazada)", status: "pending" },
      { id: "cl-tbb-e3", text: "Validar método de pago inválido", status: "pending" },
      { id: "cl-tbb-e4", text: "Verificar documento en Firebase Console", status: "pending" },
      { id: "cl-tbb-e5", text: "Probar sync automático tras fallo de Firebase", status: "pending" },
    ],
  },
  {
    id: "c-tbb-cleanup",
    title: "Eliminar firestoreBridge.js viejo",
    description: "Archivo legacy que ya fue reemplazado por bridge/sync.js. Limpiar referencia.",
    status: "idea_bruta",
    type: "task",
    priority: "medium",
    tags: ["cleanup", "legacy"],
    projectId: "4",
    blocked: false,
    checklist: [
      { id: "cl-tbb-c1", text: "Eliminar firestoreBridge.js", status: "pending" },
      { id: "cl-tbb-c2", text: "Verificar que no hay imports residuales", status: "pending" },
    ],
  },
  {
    id: "c-tbb-recargo",
    title: "Recargo automático por distancia",
    description: "Calcular recargo de delivery según zona/distancia del cliente.",
    status: "idea_bruta",
    type: "feature",
    priority: "medium",
    tags: ["delivery", "pricing"],
    projectId: "4",
    blocked: false,
    checklist: [
      { id: "cl-tbb-r1", text: "Definir zonas y tarifas", status: "pending" },
      { id: "cl-tbb-r2", text: "Integrar cálculo en flujo de pedido", status: "pending" },
      { id: "cl-tbb-r3", text: "Mostrar recargo al cliente antes de confirmar", status: "pending" },
    ],
  },
  {
    id: "c-tbb-dashboard",
    title: "Dashboard web para ver pedidos",
    description: "Vista web simple para monitorear pedidos en tiempo real desde Firestore.",
    status: "idea_bruta",
    type: "feature",
    priority: "low",
    tags: ["dashboard", "web", "firestore"],
    projectId: "4",
    blocked: false,
    checklist: [
      { id: "cl-tbb-d1", text: "Definir stack (Next.js / React + Firebase)", status: "pending" },
      { id: "cl-tbb-d2", text: "Vista de pedidos activos", status: "pending" },
      { id: "cl-tbb-d3", text: "Filtro por estado y fecha", status: "pending" },
    ],
  },
  {
    id: "c-tbb-menu",
    title: "Separar menú por categorías",
    description: "Organizar el menú del bot en categorías: hamburguesas, combos, bebidas, extras.",
    status: "idea_bruta",
    type: "feature",
    priority: "low",
    tags: ["menu", "ux", "bot"],
    projectId: "4",
    blocked: false,
    checklist: [],
  },

  // ── AMON Agents (id: 2) ────────────────────────────────────────────────
  {
    id: "c-amon-pipeline",
    title: "Pipeline de outputs estructurados",
    description: "Que los agentes escriban outputs en formato estándar (JSON) para ingesta por Sentinel Board.",
    status: "idea_bruta",
    type: "feature",
    priority: "high",
    tags: ["pipeline", "outputs", "json"],
    projectId: "2",
    blocked: false,
    checklist: [
      { id: "cl-ap1", text: "Definir schema estándar de output", status: "pending" },
      { id: "cl-ap2", text: "Validar outputs contra schema", status: "pending" },
      { id: "cl-ap3", text: "Endpoint o webhook para recibir outputs", status: "pending" },
    ],
  },
  {
    id: "c-amon-multi",
    title: "Orquestación multi-agente",
    description: "Coordinar ejecución de múltiples agentes (planner → qa-reviewer → state-guardian) en secuencia.",
    status: "idea_bruta",
    type: "research",
    priority: "medium",
    tags: ["orchestration", "multi-agent"],
    projectId: "2",
    blocked: false,
    checklist: [
      { id: "cl-am1", text: "Definir grafo de dependencias entre agentes", status: "pending" },
      { id: "cl-am2", text: "Implementar runner secuencial", status: "pending" },
      { id: "cl-am3", text: "Manejo de errores y fallback por agente", status: "pending" },
    ],
  },

  // ── AMON Website (id: 3) ───────────────────────────────────────────────
  {
    id: "c-web-landing",
    title: "Landing page corporativa AMON",
    description: "Página principal con propuesta de valor, servicios, y call to action.",
    status: "idea_bruta",
    type: "feature",
    priority: "medium",
    tags: ["landing", "design", "web"],
    projectId: "3",
    blocked: false,
    checklist: [
      { id: "cl-wl1", text: "Diseño en Figma o wireframe", status: "pending" },
      { id: "cl-wl2", text: "Implementar con Next.js", status: "pending" },
      { id: "cl-wl3", text: "Deploy a Vercel", status: "pending" },
    ],
  },

  // ── Jarvis Sentinel (id: 1) ────────────────────────────────────────────
  {
    id: "c-jarvis-core",
    title: "Definir arquitectura core de Jarvis",
    description: "Documentar cómo Jarvis orquesta agentes, pipelines y decisiones a nivel sistema.",
    status: "idea_bruta",
    type: "research",
    priority: "medium",
    tags: ["architecture", "core", "docs"],
    projectId: "1",
    blocked: false,
    checklist: [
      { id: "cl-jc1", text: "Documentar bounded contexts", status: "pending" },
      { id: "cl-jc2", text: "Definir interfaces entre módulos", status: "pending" },
      { id: "cl-jc3", text: "ADR: por qué orquestación local-first", status: "pending" },
    ],
  },
];

const MOCK_EVENTS = [
  { id: "ev-1", type: "system" as const, message: "Sentinel Board iniciado — Command Dock activo" },
  { id: "ev-2", type: "command" as const, message: '"Diseñar layout tipo IDE" → En proceso' },
  { id: "ev-3", type: "focus" as const, message: "Sesión de foco: 2h 15min en Sentinel Board" },
  { id: "ev-4", type: "system" as const, message: "Persistencia SQLite + Drizzle implementada (Etapa 1)" },
  { id: "ev-5", type: "command" as const, message: '"Persistencia real con SQLite + Drizzle" → Listo' },
  { id: "ev-6", type: "command" as const, message: 'TBB Bot v2.0 — MVP implementado: sync WhatsApp → Firebase' },
  { id: "ev-7", type: "heo_suggestion" as const, message: 'HEO: "Test e2e TBB Bot" bloqueada — necesita credenciales Firebase' },
  { id: "ev-8", type: "system" as const, message: "Documentación de proyectos creada en docs/" },
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

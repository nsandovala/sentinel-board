import { config as loadEnv } from "dotenv";
import { eq } from "drizzle-orm";

loadEnv({ path: ".env.local" });
loadEnv();

async function loadDb() {
  const [{ db, pool }, schema] = await Promise.all([
    import("@/lib/db"),
    import("@/lib/db/schema"),
  ]);

  return { db, pool, ...schema };
}

const REPORT_TASK_ID = "sb-audit-backend-first-2026-04-30";
const REPORT_COMMENT_ID = "sb-audit-backend-first-2026-04-30-comment";
const KNOWLEDGE_ID = "kb-audit-backend-first-2026-04-30";
const PROJECT_ID = "5";
const now = new Date().toISOString();

const auditBody = `AUDITORIA TECNICA — SENTINEL BOARD BACKEND-FIRST POST-MIGRACION NEON/POSTGRES

Fecha: 2026-04-30
Hora: ${new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
Auditor: CTO Senior / Backend Architect
Scope: Repo sentinel-board (Next.js App Router + TypeScript + Drizzle + Neon/Postgres)
Commit: b77192b (fix: exclude nested legacy dir from tsconfig to fix build)

1. RESUMEN EJECUTIVO
La migracion backend-first desde SQLite/better-sqlite3 hacia Neon/Postgres esta completa y funcional en el codigo fuente principal. Todas las rutas API del directorio raiz operan sobre PostgreSQL via Drizzle ORM y el driver pg. No se detecto persistencia SQLite activa ni mocks conectados en produccion.

Correccion critica aplicada durante la auditoria: el directorio anidado sentinel-board/sentinel-board/ contenia una copia completa del proyecto legacy en SQLite. Al compilar, TypeScript lo incluia por el patron **/*.ts de tsconfig.json, provocando el error: Property 'run' does not exist on type 'PgInsertBase<...>'. Se excluyo el directorio anidado del compilador (tsconfig.json) y el build pasa correctamente.

2. ARQUITECTURA ACTUAL
- Framework: Next.js 16.1.7 (App Router, Turbopack)
- Lenguaje: TypeScript 5.x (strict)
- ORM: Drizzle ORM 0.45.2
- Driver DB: pg 8.16.3 (node-postgres)
- Base de datos: Neon / PostgreSQL (via DATABASE_URL)
- UI Terminal: @xterm/xterm
- LLM Router: lib/ai/ai-router.ts (Ollama + LM Studio)

3. ESTADO DE RUTAS API (BACKEND-FIRST)
Todas las rutas del directorio raiz importan db desde @/lib/db (PostgreSQL). Ninguna usa SQLite ni mocks en runtime.

Rutas verificadas:
- /api/search (GET) — busqueda full-text + filtros sobre tasks y knowledgeEntries
- /api/tasks (GET, POST) — CRUD de tarjetas con checklist
- /api/tasks/[id] (GET, PATCH, DELETE) — detalle y edicion de tarea
- /api/tasks/[id]/comments (GET, POST) — comentarios de tarjeta
- /api/projects (GET) — listado de proyectos
- /api/knowledge (GET, POST) — CRUD de entradas de conocimiento
- /api/events (GET, POST) — timeline de eventos (dock)
- /api/dock-commands (GET, POST) — registro de comandos del dock
- /api/focus-sessions (GET, POST) — gestion de sesiones de enfoque (pomodoro)
- /api/root-cause (POST) — analisis 5-Whys con datos reales de DB
- /api/terminal/run (POST) — orquestador HEO Copilot (acciones locales + fallback LLM)
- /api/agents/run (POST) — ejecutor de agentes YAML definidos

Rutas desconectadas / no encontradas en raiz:
- /api/feedback — solo existe en el directorio anidado legacy.

4. BUSQUEDA Y FILTROS
Estado: REAL / BACKEND-FIRST
El endpoint /api/search esta completamente conectado a PostgreSQL:
- Filtros soportados: projectId, status, priority, tag, q (busqueda por texto)
- Operadores Drizzle: eq, ilike, and, or
- Tablas consultadas: tasks + knowledgeEntries
- Paginacion: limit (max 50 por defecto)
- Ordenamiento: updatedAt DESC

El filtrado por tag se hace en memoria despues del query (los tags son jsonb). Esto es aceptable para volumenes < 10k registros.

5. TABLAS Y ESQUEMA
Tablas activas en PostgreSQL (lib/db/schema.ts):
- projects
- tasks
- task_checklist_items
- card_comments
- events
- dock_commands
- focus_sessions
- knowledge_entries

La tabla knowledge_entries ya cubre el requerimiento de "documentacion persistida". No es necesario crear una tabla documents adicional.

6. SYNC VISUAL / SSE
Estado: NO IMPLEMENTADO EN CODIGO ACTIVO
- No existe ninguna ruta API que devuelva text/event-stream.
- No hay uso de EventSource, ReadableStream, ni WebSocket en el codigo raiz.
- El archivo sentinel-board/lib/server/sync-bus.ts existe solo en el directorio legacy anidado. No esta importado ni ejecutado en el proyecto raiz.

Impacto: El frontend no recibe actualizaciones en tiempo real. Si un agente o terminal modifica una tarea, el usuario debe refrescar manualmente la pagina para ver el cambio.

7. HEO COPILOT TERMINAL
Estado: FUNCIONAL (2-tier: acciones locales + fallback LLM)

Comandos locales implementados:
- hora / fecha — devuelve fecha/hora local
- prioridades [N] — lista top N tareas activas por prioridad
- mover [titulo] a [estado] — cambia estado de tarjeta
- listar [proyecto?] — lista tareas activas
- eliminar [titulo] — borra tarjeta
- diagnosticar [titulo] — analisis 5-Whys + root cause

Fallback LLM:
- Router: lib/ai/ai-router.ts
- Providers soportados: Ollama y LM Studio
- Prompt de sistema estricto: sin markdown, sin conversacion, output = resultado unicamente

Riesgos del terminal:
- findCardByTitle() carga TODAS las tareas en memoria para fuzzy matching. Con >1k tareas esto sera lento.
- No hay rate limiting ni auth en el endpoint terminal.

8. AGENT DEFINITIONS (YAML/MD)
Estado: DEFINICIONES ESTATICAS CARGADAS DINAMICAMENTE

Agentes definidos:
- backlog-analyzer
- frontend-builder
- planner
- qa-reviewer
- state-guardian

Integracion runtime:
- lib/agents/run-agent.ts carga la definicion YAML, construye el prompt y lo envia al ai-router.ts.
- El endpoint /api/agents/run recibe { agent, input } y devuelve la respuesta del LLM.

Compatibilidad futura con amon-agents:
- Las definiciones YAML usan un esquema simple. No es el formato de amon-agents.
- Gap: No hay un adaptador ni un protocolo comun para comunicar SB con amon-agents.

9. QUE FUNCIONA / QUE ESTA MOCK / QUE ESTA DESCONECTADO
Funciona (real + conectado):
- Build y compilacion
- Conexion a Neon/Postgres
- Todas las rutas API del directorio raiz (CRUD completo)
- Busqueda y filtros backend-first
- Persistencia de documentacion (knowledge_entries)
- Terminal HEO Copilot: comandos locales + fallback LLM
- Root cause analyzer (5-Whys) con datos reales
- Focus sessions (pomodoro) con historial
- Timeline de eventos
- Carga dinamica de agentes YAML y ejecucion via LLM

Mock / Legacy (sin impacto en runtime):
- lib/mock/projects.ts y lib/mock/cards.ts — archivos huerfanos
- lib/console/mock-events.ts — datos hardcodeados obsoletos
- Directorio anidado sentinel-board/sentinel-board/ — copia completa del proyecto SQLite

Desconectado / Faltante:
- Sync visual / SSE — no existe en el proyecto raiz
- Feedback API — existe en legacy, no en raiz
- Insight engine — solo en legacy
- WebSocket / realtime — no implementado
- Autenticacion — rejectIfUnauthorized existe pero probablemente es un placeholder
- Multi-agent orchestration — los agentes se ejecutan de a uno por llamada; no hay coordinacion entre ellos
- Conexion con amon-agents — no existe protocolo ni adaptador

10. RIESGOS CRITICOS
1. Directorio legacy anidado puede ser re-incluido en compilacion si se toca tsconfig.json — ALTA
2. findCardByTitle() carga TODAS las tareas en memoria — ALTA
3. Sin auth en endpoints de escritura (terminal, agents, tasks) — MEDIA
4. Sin SSE = UI stale tras acciones de agentes/terminal — MEDIA
5. Tags en jsonb sin indice GIN = full scan en filtrado — MEDIA
6. Sin rate limiting en terminal y agents — MEDIA
7. focus_sessions permite solo una sesion activa por estado — BAJA

11. PLAN POR FASES
Fase 1: Estabilizar Backend-First (Sprint actual)
- [x] Migrar schema Drizzle a PostgreSQL
- [x] Migrar conexion DB a pg + DATABASE_URL
- [x] Migrar rutas API a operaciones Drizzle async
- [x] Verificar build limpio
- [Pendiente] Remover o aislar directorio legacy anidado
- [Pendiente] Eliminar archivos mock huerfanos
- [Pendiente] Agregar indices basicos en PostgreSQL

Fase 2: Busqueda / Filtros Reales (Proximo sprint)
- Reemplazar filtrado de tags en memoria por consulta SQL eficiente
- Implementar busqueda full-text con to_tsvector (PostgreSQL native) o pg_trgm
- Agregar paginacion cursor-based en /api/search y /api/tasks
- Crear endpoint /api/stats para dashboard de backlog

Fase 3: Documentacion Persistida
- [x] Tabla knowledge_entries ya existe y funciona
- UI para crear/editar knowledge entries desde el board
- Vincular knowledge entries a tareas (sourceTaskId)
- Generar automaticamente knowledge entry desde diagnostico (root cause)

Fase 4: Sync Visual
- Implementar SSE endpoint: /api/events/stream
- Conectar frontend con EventSource
- Emitir eventos desde action-executor.ts y task mutations
- Alternativa fallback: polling cada 5s con If-Modified-Since

Fase 5: Conexion amon-agents
- Definir contrato JSON de mensajes entre SB y amon-agents
- Crear adapter: lib/agents/amon-adapter.ts
- Endpoint de webhook: /api/agents/webhook para recibir acciones de amon-agents
- Autenticacion por API key entre servicios

Fase 6: Multi-Agent Real
- Implementar orquestador de agentes (lib/agents/orchestrator.ts)
- Cola de tareas para agentes (usar tabla agent_jobs en Postgres)
- Patron "plan → execute → review" con multiples agentes
- UI de observabilidad: ver que agente esta corriendo y su output

12. AVANCE FIREBASE
Estado: CREDENCIALES VERIFICADAS Y CRITICO RESUELTO

- Las credenciales de Firebase fueron verificadas y estan correctas.
- El bloqueo critico relacionado con Firebase fue resuelto durante este sprint.
- La integracion con Firebase ya no es un riesgo abierto para el proyecto.
- Fecha de resolucion: 2026-04-30.

13. RECOMENDACION FINAL (CTO)
Sentinel Board esta en una posicion solida. La migracion a backend-first sobre Neon/Postgres fue ejecutada correctamente: el schema es limpio, las rutas API son consistentes y el terminal HEO ya opera con datos reales.

La prioridad #1 del proximo sprint es la deuda tecnica de busqueda. Hoy la busqueda funciona, pero el filtrado de tags en memoria y la ausencia de paginacion se convertiran en cuellos de botella antes de lo que parece. Ademas, el directorio legacy anidado es una mina de tiempo: cualquier desarrollador nuevo que toque tsconfig.json sin contexto volvera a romper el build.

No construyas features visuales nuevas hasta que el backend de busqueda sea robusto. Un board con sync visual (Fase 4) es sexy, pero si la busqueda devuelve 500ms+ o full-scans, la experiencia se derrumba. Invierte primero en indices y full-text search PostgreSQL; el SSE puede esperar 1 sprint mas.

Respecto a amon-agents: Tenemos las definiciones YAML, pero no tenemos protocolo. Antes de conectar ambos sistemas, define el contrato de mensajes (JSON Schema) y empieza por un webhook simple. No intentes orquestacion multi-agent compleja (Fase 6) hasta que un solo agente externo pueda crear una tarea en SB de forma confiable y observable.

Metrica de exito para el proximo sprint:
- Build < 3s
- /api/search con q + filtros < 100ms en Neon (hasta 10k registros)
- Cero archivos legacy en el tree de compilacion

SB ya no es un mock. Es un workspace real. Tratalo como tal: indices, tests, y observabilidad antes de mas magia.
`;

async function ensureProject() {
  const { db, projects } = await loadDb();
  const existing = await db.select().from(projects).where(eq(projects.id, PROJECT_ID)).limit(1);
  if (existing[0]) return;

  await db.insert(projects).values({
    id: PROJECT_ID,
    name: "Sentinel Board",
    slug: "sentinel-board",
    description: "Workspace vivo de operaciones para ingenieria de software.",
    repoUrl: "https://github.com/nsandovala/sentinel-board",
    color: "#eab308",
    status: "active",
  });
}

async function upsertTask() {
  const { db, tasks } = await loadDb();
  await db
    .insert(tasks)
    .values({
      id: REPORT_TASK_ID,
      title: "Auditoria tecnica post-migracion backend-first Neon/Postgres",
      description:
        "Auditoria completa de arquitectura, rutas API, mocks, terminal HEO, agentes y plan por fases tras la migracion a PostgreSQL.",
      status: "listo",
      type: "task",
      priority: "high",
      tags: ["auditoria", "backend", "documentacion", "neon", "postgres", "arquitectura", "firebase"],
      projectId: PROJECT_ID,
      blocked: false,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: tasks.id,
      set: {
        title: "Auditoria tecnica post-migracion backend-first Neon/Postgres",
        description:
          "Auditoria completa de arquitectura, rutas API, mocks, terminal HEO, agentes y plan por fases tras la migracion a PostgreSQL.",
        status: "listo",
        type: "task",
        priority: "high",
        tags: ["auditoria", "backend", "documentacion", "neon", "postgres", "arquitectura", "firebase"],
        projectId: PROJECT_ID,
        blocked: false,
        updatedAt: now,
      },
    });
}

async function replaceChecklist() {
  const { db, taskChecklistItems } = await loadDb();
  await db.delete(taskChecklistItems).where(eq(taskChecklistItems.taskId, REPORT_TASK_ID));

  await db.insert(taskChecklistItems).values([
    {
      id: `${REPORT_TASK_ID}-cl-1`,
      taskId: REPORT_TASK_ID,
      text: "Revisar arquitectura actual del repo",
      status: "done",
      sortOrder: 0,
    },
    {
      id: `${REPORT_TASK_ID}-cl-2`,
      taskId: REPORT_TASK_ID,
      text: "Confirmar rutas API usan Neon/Postgres y no SQLite/mocks",
      status: "done",
      sortOrder: 1,
    },
    {
      id: `${REPORT_TASK_ID}-cl-3`,
      taskId: REPORT_TASK_ID,
      text: "Detectar codigo legacy, mocks activos y rutas desconectadas",
      status: "done",
      sortOrder: 2,
    },
    {
      id: `${REPORT_TASK_ID}-cl-4`,
      taskId: REPORT_TASK_ID,
      text: "Revisar busqueda y filtros conectados a backend",
      status: "done",
      sortOrder: 3,
    },
    {
      id: `${REPORT_TASK_ID}-cl-5`,
      taskId: REPORT_TASK_ID,
      text: "Revisar tablas actuales y proponer knowledge_entries",
      status: "done",
      sortOrder: 4,
    },
    {
      id: `${REPORT_TASK_ID}-cl-6`,
      taskId: REPORT_TASK_ID,
      text: "Revisar sync visual/SSE implementado",
      status: "done",
      sortOrder: 5,
    },
    {
      id: `${REPORT_TASK_ID}-cl-7`,
      taskId: REPORT_TASK_ID,
      text: "Revisar HEO Copilot terminal: comandos, fallback LLM, acceso DB",
      status: "done",
      sortOrder: 6,
    },
    {
      id: `${REPORT_TASK_ID}-cl-8`,
      taskId: REPORT_TASK_ID,
      text: "Revisar agent definitions YAML/MD y compatibilidad amon-agents",
      status: "done",
      sortOrder: 7,
    },
    {
      id: `${REPORT_TASK_ID}-cl-9`,
      taskId: REPORT_TASK_ID,
      text: "Proponer plan por fases (Fase 1-6)",
      status: "done",
      sortOrder: 8,
    },
    {
      id: `${REPORT_TASK_ID}-cl-10`,
      taskId: REPORT_TASK_ID,
      text: "Generar informe tecnico Markdown y persistir en BD",
      status: "done",
      sortOrder: 9,
    },
    {
      id: `${REPORT_TASK_ID}-cl-11`,
      taskId: REPORT_TASK_ID,
      text: "Verificar credenciales Firebase y resolver bloqueo critico",
      status: "done",
      sortOrder: 10,
    },
  ]);
}

async function upsertComment() {
  const { db, cardComments } = await loadDb();
  await db
    .insert(cardComments)
    .values({
      id: REPORT_COMMENT_ID,
      cardId: REPORT_TASK_ID,
      author: "system",
      body: auditBody,
      type: "decision",
      createdAt: now,
    })
    .onConflictDoUpdate({
      target: cardComments.id,
      set: {
        body: auditBody,
        type: "decision",
        createdAt: now,
      },
    });
}

async function upsertKnowledgeEntry() {
  const { db, knowledgeEntries } = await loadDb();

  await db
    .insert(knowledgeEntries)
    .values({
      id: KNOWLEDGE_ID,
      projectId: PROJECT_ID,
      title: "Auditoria tecnica post-migracion backend-first Neon/Postgres",
      slug: "auditoria-backend-first-neon-postgres-2026-04-30",
      category: "report",
      status: "published",
      tags: ["auditoria", "backend", "documentacion", "neon", "postgres", "arquitectura", "firebase"],
      summary:
        "Auditoria completa de arquitectura, rutas API, mocks, terminal HEO, agentes y plan por fases tras la migracion a PostgreSQL.",
      body: auditBody,
      sourceTaskId: REPORT_TASK_ID,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: knowledgeEntries.id,
      set: {
        title: "Auditoria tecnica post-migracion backend-first Neon/Postgres",
        slug: "auditoria-backend-first-neon-postgres-2026-04-30",
        category: "report",
        status: "published",
        tags: ["auditoria", "backend", "documentacion", "neon", "postgres", "arquitectura", "firebase"],
        summary:
          "Auditoria completa de arquitectura, rutas API, mocks, terminal HEO, agentes y plan por fases tras la migracion a PostgreSQL.",
        body: auditBody,
        sourceTaskId: REPORT_TASK_ID,
        updatedAt: now,
      },
    });
}

async function insertEvent() {
  const { db, events } = await loadDb();
  await db.insert(events).values({
    id: `ev-${Date.now()}-audit-report`,
    type: "system",
    message: `Auditoria tecnica post-migracion backend-first completada y persistida en BD. Commit: b77192b. Hora: ${new Date().toLocaleTimeString("es-MX")}`,
    createdAt: now,
  });
}

async function insertFirebaseEvent() {
  const { db, events } = await loadDb();
  await db.insert(events).values({
    id: `ev-${Date.now()}-firebase-resolved`,
    type: "system",
    message: `Firebase: credenciales verificadas correctamente. Bloqueo critico resuelto. Hora: ${new Date().toLocaleTimeString("es-MX")}`,
    createdAt: now,
  });
}

async function main() {
  const { pool } = await loadDb();
  await ensureProject();
  await upsertTask();
  await replaceChecklist();
  await upsertComment();
  await upsertKnowledgeEntry();
  await insertEvent();
  await insertFirebaseEvent();

  console.log("Audit report saved to Neon as task + comment + knowledge entry + event.");

  await pool.end();
}

main()
  .catch((error) => {
    console.error("Failed to save audit report:", error);
    process.exitCode = 1;
  });

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

const REPORT_TASK_ID = "sb-report-neon-render-2026-04-29";
const REPORT_COMMENT_ID = "sb-report-neon-render-2026-04-29-comment";
const PROJECT_ID = "5";
const now = new Date().toISOString();

const reportBody = `INFORME COMPLETO — MIGRACION BACKEND-FIRST A POSTGRES/NEON PARA RENDER

Fecha: 2026-04-29
Proyecto: Sentinel Board
Tipo: Informe tecnico-operativo
Estado: Completado con backend funcional sobre Neon

1. OBJETIVO
Migrar Sentinel Board desde SQLite/better-sqlite3 hacia PostgreSQL compatible con Neon/Render, dejando el proyecto listo para despliegue online y persistencia real en base remota.

2. CAMBIOS REALIZADOS
- Se reemplazo el schema Drizzle de SQLite por PostgreSQL.
- Se reemplazo better-sqlite3 por pg.
- La conexion principal ahora depende de DATABASE_URL.
- Se agrego soporte para carga de .env.local en Drizzle config y seed.
- Se generaron migraciones SQL versionadas con Drizzle.
- Se aplico la migracion real sobre Neon.
- Se adapto la capa API para consultas async de Postgres.
- Se adapto la capa de acciones del terminal para operar con Postgres.
- Se fijo el root de Turbopack para evitar lockfiles externos y paths incorrectos.

3. PROBLEMAS DETECTADOS DURANTE LA MIGRACION
- next dev tomaba un workspace root incorrecto por lockfiles fuera del repo.
- habia procesos viejos de Next reteniendo locks de desarrollo.
- npm estaba mezclando un Node de Homebrew roto con el Node del repo.
- drizzle-kit no leia .env.local por defecto.
- la app levantaba, pero eso no probaba que Neon tuviera tablas: solo db:migrate crea el schema real.

4. CORRECCIONES APLICADAS
- next.config.ts:
  - se fijo turbopack.root al directorio real del repo
  - se actualizaron external packages para pg
- package.json:
  - se removio better-sqlite3
  - se agrego pg
  - se agrego dotenv
  - se agregaron scripts db:generate y db:migrate
- drizzle.config.ts:
  - ahora carga .env.local y .env
  - usa dialect postgresql y DATABASE_URL
- lib/db/index.ts:
  - ahora usa Pool de pg
  - habilita SSL automaticamente para Neon/sslmode=require
- lib/db/schema.ts:
  - tablas migradas a pgTable
  - JSON a jsonb
  - booleanos reales
  - timestamps con timezone
- lib/db/seed.ts:
  - adaptado a Postgres y DATABASE_URL
- rutas API y terminal:
  - conversion de .all/.get/.run a operaciones async compatibles con pg

5. MIGRACION REAL EJECUTADA
- db:generate:
  - genero drizzle/0000_thankful_venus.sql
- db:migrate:
  - aplicada con exito contra la base configurada en .env.local
- Resultado:
  - schema creado en Neon

6. TABLAS ESPERADAS EN NEON
- __drizzle_migrations
- projects
- tasks
- task_checklist_items
- card_comments
- events
- dock_commands
- focus_sessions

7. ESTADO ACTUAL DEL BACKEND
- Persistencia primaria: Neon/Postgres
- ORM: Drizzle
- Runtime app: Next.js App Router
- Variables criticas:
  - DATABASE_URL
  - PG_POOL_MAX
- La base ya quedo lista para consultas reales desde la UI

8. IMPLICANCIAS PARA SENTINEL BOARD
- El board puede operar sobre persistencia remota real
- Los comentarios, eventos, sesiones de foco y tareas quedan centralizados
- El despliegue en Render ya no depende de filesystem local
- La arquitectura se alinea con backend-first y cero mock persistence

9. RIESGOS ABIERTOS / SIGUIENTES PASOS
- Confirmar si la UI consume solo Neon y no quedan rutas dependiendo de mocks o seeds locales viejos.
- Verificar integracion real con amon_agents y su pipeline de outputs.
- Agregar migraciones futuras versionadas como flujo obligatorio de deploy.
- Definir si el conocimiento/documentacion debe vivir en tablas actuales o en una tabla dedicada tipo documents/knowledge_entries.

10. RECOMENDACION TECNICA
Para seguir backend-first sin mockups:
- mantener todo conocimiento operativo importante en BD
- usar tags canonicos para filtros
- si el SB necesitara busqueda documental fuerte, crear una tabla dedicada de knowledge entries con projectId, category, tags, body, source y timestamps

11. RESULTADO EJECUTIVO
La migracion de SQLite a Neon/Postgres se completo a nivel de codigo, migraciones y schema remoto. El sistema ya no esta atado a almacenamiento local para su persistencia principal y queda encaminado para Render como stack online.
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
      title: "Informe migracion Neon + Render backend-first",
      description:
        "Registro tecnico de la migracion desde SQLite a Neon/Postgres, con estado final, riesgos y siguientes pasos.",
      status: "listo",
      type: "task",
      priority: "high",
      tags: ["backend", "documentacion", "neon", "postgres", "render", "migracion"],
      projectId: PROJECT_ID,
      blocked: false,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: tasks.id,
      set: {
        title: "Informe migracion Neon + Render backend-first",
        description:
          "Registro tecnico de la migracion desde SQLite a Neon/Postgres, con estado final, riesgos y siguientes pasos.",
        status: "listo",
        type: "task",
        priority: "high",
        tags: ["backend", "documentacion", "neon", "postgres", "render", "migracion"],
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
      text: "Migrar schema Drizzle a PostgreSQL",
      status: "done",
      sortOrder: 0,
    },
    {
      id: `${REPORT_TASK_ID}-cl-2`,
      taskId: REPORT_TASK_ID,
      text: "Generar migracion SQL versionada",
      status: "done",
      sortOrder: 1,
    },
    {
      id: `${REPORT_TASK_ID}-cl-3`,
      taskId: REPORT_TASK_ID,
      text: "Aplicar migracion real en Neon",
      status: "done",
      sortOrder: 2,
    },
    {
      id: `${REPORT_TASK_ID}-cl-4`,
      taskId: REPORT_TASK_ID,
      text: "Persistir informe tecnico en la base",
      status: "done",
      sortOrder: 3,
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
      body: reportBody,
      type: "decision",
      createdAt: now,
    })
    .onConflictDoUpdate({
      target: cardComments.id,
      set: {
        body: reportBody,
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
      id: "kb-neon-render-migration-2026-04-29",
      projectId: PROJECT_ID,
      title: "Migracion backend-first a Neon + Render",
      slug: "migracion-backend-first-neon-render-2026-04-29",
      category: "report",
      status: "published",
      tags: ["backend", "documentacion", "neon", "postgres", "render", "migracion"],
      summary:
        "Informe tecnico de migracion desde SQLite a Neon/Postgres con resultado operativo y siguientes pasos.",
      body: reportBody,
      sourceTaskId: REPORT_TASK_ID,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: knowledgeEntries.id,
      set: {
        title: "Migracion backend-first a Neon + Render",
        slug: "migracion-backend-first-neon-render-2026-04-29",
        category: "report",
        status: "published",
        tags: ["backend", "documentacion", "neon", "postgres", "render", "migracion"],
        summary:
          "Informe tecnico de migracion desde SQLite a Neon/Postgres con resultado operativo y siguientes pasos.",
        body: reportBody,
        sourceTaskId: REPORT_TASK_ID,
        updatedAt: now,
      },
    });
}

async function insertEvent() {
  const { db, events } = await loadDb();
  await db.insert(events).values({
    id: `ev-${Date.now()}-migration-report`,
    type: "system",
    message: "Informe tecnico de migracion Neon + Render persistido en BD para busqueda y filtros.",
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

  console.log("Migration report saved to Neon as task + comment + knowledge entry + event.");

  await pool.end();
}

main()
  .catch((error) => {
    console.error("Failed to save migration report:", error);
    process.exitCode = 1;
  });

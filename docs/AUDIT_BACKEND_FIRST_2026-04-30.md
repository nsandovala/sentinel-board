# Auditoría Técnica – Sentinel Board
## Migración Backend-First a Neon/Postgres + Preparación Fase 2–6

**Fecha:** 2026-04-30  
**Auditor:** CTO Senior / Backend Architect  
**Scope:** Repo `sentinel-board` (Next.js App Router + TypeScript + Drizzle + Neon/Postgres)  
**Estado post-auditoría:** Build verificado y funcional. Corrección crítica aplicada.

---

## 1. Resumen Ejecutivo

La migración backend-first desde SQLite/better-sqlite3 hacia Neon/Postgres está **completa y funcional** en el código fuente principal. Todas las rutas API del directorio raíz (`C:\Dev\sentinel-board`) operan sobre PostgreSQL vía Drizzle ORM y el driver `pg`. No se detectó persistencia SQLite activa ni mocks conectados en producción.

**Corrección crítica aplicada durante la auditoría:** el directorio anidado `sentinel-board/sentinel-board/` contenía una copia completa del proyecto legacy en SQLite. Al compilar, TypeScript lo incluía por el patrón `**/*.ts` de `tsconfig.json`, provocando el error:

```
Property 'run' does not exist on type 'PgInsertBase<...>'
```

Se excluyó el directorio anidado del compilador (`tsconfig.json`) y el build pasa correctamente.

---

## 2. Arquitectura Actual

| Capa | Tecnología | Estado |
|---|---|---|
| Framework | Next.js 16.1.7 (App Router, Turbopack) | ✅ Activo |
| Lenguaje | TypeScript 5.x (strict) | ✅ Activo |
| ORM | Drizzle ORM 0.45.2 | ✅ Activo |
| Driver DB | `pg` 8.16.3 (node-postgres) | ✅ Activo |
| Base de datos | Neon / PostgreSQL (via `DATABASE_URL`) | ✅ Activo |
| Estilos | Tailwind CSS 4 + shadcn/ui | ✅ Activo |
| UI Terminal | @xterm/xterm | ✅ Activo |
| Estado local | React Context + Reducer (`lib/state/`) | ✅ Activo |
| LLM Router | `lib/ai/ai-router.ts` (Ollama + LM Studio) | ✅ Activo |

### Diagrama de flujo (simplificado)

```
Frontend (App Router)
  ↕ fetch / REST
API Routes (app/api/*)
  ↕ Drizzle ORM
lib/db/index.ts  →  pg Pool  →  Neon/Postgres
  ↕
lib/server/* (terminal-runner, action-executor, root-cause-analyzer)
  ↕
lib/ai/ai-router.ts  →  Ollama / LM Studio
```

---

## 3. Estado de las Rutas API (Backend-First)

Todas las rutas del directorio raíz importan `db` desde `@/lib/db` (PostgreSQL). **Ninguna usa SQLite ni mocks en runtime.**

| Ruta | Métodos | DB Real | Descripción |
|---|---|---|---|
| `/api/search` | GET | ✅ | Búsqueda full-text + filtros sobre `tasks` y `knowledgeEntries` |
| `/api/tasks` | GET, POST | ✅ | CRUD de tarjetas con checklist |
| `/api/tasks/[id]` | GET, PATCH, DELETE | ✅ | Detalle y edición de tarea |
| `/api/tasks/[id]/comments` | GET, POST | ✅ | Comentarios de tarjeta |
| `/api/projects` | GET | ✅ | Listado de proyectos |
| `/api/knowledge` | GET, POST | ✅ | CRUD de entradas de conocimiento |
| `/api/events` | GET, POST | ✅ | Timeline de eventos (dock) |
| `/api/dock-commands` | GET, POST | ✅ | Registro de comandos del dock |
| `/api/focus-sessions` | GET, POST | ✅ | Gestión de sesiones de enfoque (pomodoro) |
| `/api/root-cause` | POST | ✅ | Análisis 5-Whys con datos reales de DB |
| `/api/terminal/run` | POST | ✅ | Orquestador HEO Copilot (acciones locales + fallback LLM) |
| `/api/agents/run` | POST | ✅ | Ejecutor de agentes YAML definidos |

### Rutas desconectadas / no encontradas en raíz
- `/api/feedback` — solo existe en el directorio anidado legacy. En el proyecto raíz no hay ruta de feedback.

---

## 4. Código Legacy, Mocks e Imports Muertos

### 4.1 Directorio anidado `sentinel-board/sentinel-board/` (LEGACY – CRÍTICO)
Este directorio es una **copia íntegra del proyecto SQLite**. Contiene:
- `lib/db/schema.ts` con `sqliteTable` (drizzle-orm/sqlite-core)
- `lib/db/index.ts` importando `better-sqlite3`
- `next.config.ts` con `serverExternalPackages: ["better-sqlite3"]`
- Rutas API idénticas pero usando métodos SQLite: `.run()`, `.all()`, `.get()`
- `lib/server/sync-bus.ts` (versión legacy del bus de eventos)

**Riesgo:** si el patrón `**/*.ts` del compilador lo vuelve a incluir (ej. si alguien revierte `tsconfig.json`), el build falla inmediatamente.

**Recomendación:** Mover a una rama Git o a `archive/sentinel-board-sqlite/` fuera del tree de compilación. No eliminar aún sin confirmar con el equipo.

### 4.2 Mocks presentes pero NO usados

| Archivo | Estado | Usado en raíz? |
|---|---|---|
| `lib/mock/projects.ts` | Mock de proyectos hardcodeados | ❌ No importado |
| `lib/mock/cards.ts` | Mock de tarjetas hardcodeadas | ❌ No importado |
| `lib/console/mock-events.ts` | Eventos iniciales hardcodeados (menciona SQLite) | ❌ No importado |

### 4.3 Imports muertos / código huérfano
- `lib/console/mock-events.ts` — menciona "Persistencia SQLite + Drizzle implementada (Etapa 1)". Está obsoleto.
- `sentinel-board/lib/server/feedback-service.ts` — solo existe en directorio anidado.
- `sentinel-board/lib/server/insight-engine.ts` — solo existe en directorio anidado.

---

## 5. Búsqueda y Filtros

### Estado: ✅ REAL / BACKEND-FIRST

El endpoint `/api/search` está completamente conectado a PostgreSQL:

- **Filtros soportados:** `projectId`, `status`, `priority`, `tag`, `q` (búsqueda por texto)
- **Operadores Drizzle:** `eq`, `ilike`, `and`, `or`
- **Tablas consultadas:** `tasks` + `knowledgeEntries`
- **Paginación:** `limit` (máx 50 por defecto)
- **Ordenamiento:** `updatedAt DESC`

El filtrado por `tag` se hace en memoria después del query (los tags son `jsonb`). Esto es aceptable para volúmenes < 10k registros. A futuro, si el volumen crece, se recomienda migrar tags a una tabla relacional `task_tags` con índice GIN.

---

## 6. Tablas y Esquema

### Tablas activas en PostgreSQL (lib/db/schema.ts)

| Tabla | Propósito | Estado |
|---|---|---|
| `projects` | Proyectos del workspace | ✅ Migrada |
| `tasks` | Tarjetas del board (cards) | ✅ Migrada |
| `task_checklist_items` | Checklist de cada tarea | ✅ Migrada |
| `card_comments` | Comentarios/decisiones en tarjetas | ✅ Migrada |
| `events` | Timeline / eventos del dock | ✅ Migrada |
| `dock_commands` | Historial de comandos ejecutados | ✅ Migrada |
| `focus_sessions` | Sesiones de enfoque (pomodoro) | ✅ Migrada |
| `knowledge_entries` | Documentación, runbooks, decisiones | ✅ Migrada |

### Tabla `knowledge_entries` — ya existe, no hace falta crear otra

La tabla `knowledge_entries` cubre el requerimiento de "documentación persistida":
- Campos: `title`, `slug`, `category` (report, decision, runbook, note, postmortem), `status` (draft, published, archived), `tags`, `summary`, `body`, `sourceTaskId`
- Tiene índice implícito único en `slug`
- Se consulta activamente desde `/api/search` y `/api/knowledge`

**Conclusión:** No es necesario crear una tabla `documents` adicional. `knowledge_entries` ya cumple el rol.

---

## 7. Sync Visual / SSE

### Estado: ❌ NO IMPLEMENTADO EN CÓDIGO ACTIVO

- No existe ninguna ruta API que devuelva `text/event-stream`.
- No hay uso de `EventSource`, `ReadableStream`, ni `WebSocket` en el código raíz.
- El archivo `sentinel-board/lib/server/sync-bus.ts` (EventEmitter + tipos SSE) existe solo en el directorio legacy anidado. **No está importado ni ejecutado en el proyecto raíz.**

**Impacto:** El frontend no recibe actualizaciones en tiempo real. Si un agente o terminal modifica una tarea, el usuario debe refrescar manualmente la página para ver el cambio.

---

## 8. HEO Copilot Terminal

### Estado: ✅ FUNCIONAL (2-tier: acciones locales + fallback LLM)

#### 8.1 Arquitectura del terminal

```
POST /api/terminal/run
  → terminal-runner.ts
      → resolveAction(cmd)     [lib/server/action-resolver.ts]
          → Si coincide → executeAction() [lib/server/action-executor.ts]
          → Si no       → routeAI()       [lib/ai/ai-router.ts]
```

#### 8.2 Comandos locales implementados

| Comando | Acción | DB Real |
|---|---|---|
| `hora` / `fecha` | Devuelve fecha/hora local | N/A |
| `prioridades [N]` | Lista top N tareas activas por prioridad | ✅ SELECT tasks |
| `mover [título] a [estado]` | Cambia estado de tarjeta | ✅ UPDATE tasks |
| `listar [proyecto?]` | Lista tareas activas | ✅ SELECT tasks |
| `eliminar [título]` | Borra tarjeta | ✅ DELETE tasks |
| `diagnosticar [título]` | Análisis 5-Whys + root cause | ✅ SELECT tasks + events + checklist |

#### 8.3 Fallback LLM
- Router: `lib/ai/ai-router.ts`
- Providers soportados: **Ollama** (`lib/ai/providers/ollama-provider.ts`) y **LM Studio** (`lib/ai/providers/lmstudio-provider.ts`)
- Prompt de sistema estricto: sin markdown, sin conversación, output = resultado únicamente

#### 8.4 Acceso a DB
- `action-executor.ts` lee y escribe directamente sobre `tasks`, `taskChecklistItems`, `events` usando Drizzle + pg.
- Las escrituras del terminal **bypassean** el reducer del frontend. Se devuelve `hint: "refresh_board"` para que el cliente sepa que debe re-hidratar.

#### 8.5 Riesgos del terminal
- `findCardByTitle()` hace `SELECT * FROM tasks` completo en memoria para fuzzy matching. Con >1k tareas esto será lento.
- No hay rate limiting ni auth en el endpoint terminal.

---

## 9. Agent Definitions (YAML/MD)

### Estado: ✅ DEFINICIONES ESTÁTICAS CARGADAS DINÁMICAMENTE

#### 9.1 Estructura

```
agents/
  definitions/     → YAML con metadatos del agente
  prompts/         → Markdown con system prompts
  skills/          → SKILL.md por agente
```

#### 9.2 Agentes definidos

| Agente | YAML | Prompt | Skill | Descripción |
|---|---|---|---|---|
| `backlog-analyzer` | ✅ | ❌ (usa YAML inline?) | ❌ | Análisis de backlog |
| `frontend-builder` | ✅ | ❌ | ✅ | Construcción de componentes UI |
| `planner` | ✅ | ✅ | ✅ | Planificación de tareas |
| `qa-reviewer` | ✅ | ✅ | ✅ | Revisión de calidad |
| `state-guardian` | ✅ | ✅ | ✅ | Guardián de estado |

#### 9.3 Integración runtime
- `lib/agents/run-agent.ts` carga la definición YAML (`load-agent.ts`), construye el prompt (`build-agent-prompt.ts`) y lo envía al `ai-router.ts`.
- El endpoint `/api/agents/run` recibe `{ agent, input }` y devuelve la respuesta del LLM.
- Si el agente define `output_format: strict_json`, se intenta parsear la respuesta.

#### 9.4 Compatibilidad futura con `amon-agents`
- Las definiciones YAML usan un esquema simple (name, role, output_format, allowed_skills). No es el formato de `amon-agents` (que probablemente use un schema más estructurado).
- **Gap:** No hay un adaptador ni un protocolo común (ej. MCP, A2A, o un bus de mensajes) para comunicar SB con `amon-agents`.
- **Recomendación:** En Fase 5, definir un contrato JSON estándar para que `amon-agents` publique tareas/insights y SB las consuma vía API o queue.

---

## 10. Qué Funciona / Qué Está Mock / Qué Está Desconectado

### ✅ Qué FUNCIONA (real + conectado)

1. Build y compilación (después de la corrección de `tsconfig.json`).
2. Conexión a Neon/Postgres (`lib/db/index.ts`).
3. Todas las rutas API del directorio raíz (CRUD completo).
4. Búsqueda y filtros backend-first (`/api/search`).
5. Persistencia de documentación (`knowledge_entries`).
6. Terminal HEO Copilot: comandos locales + fallback LLM.
7. Root cause analyzer (5-Whys) con datos reales.
8. Focus sessions (pomodoro) con historial.
9. Timeline de eventos (`/api/events`).
10. Carga dinámica de agentes YAML y ejecución vía LLM.

### ⚠️ Qué ESTÁ MOCK / LEGACY (sin impacto en runtime)

1. `lib/mock/projects.ts` y `lib/mock/cards.ts` — archivos huérfanos.
2. `lib/console/mock-events.ts` — datos hardcodeados obsoletos.
3. Directorio anidado `sentinel-board/sentinel-board/` — copia completa del proyecto SQLite.

### ❌ Qué ESTÁ DESCONECTADO / FALTANTE

1. **Sync visual / SSE** — no existe en el proyecto raíz.
2. **Feedback API** — existe en legacy, no en raíz.
3. **Insight engine** — solo en legacy.
4. **WebSocket / realtime** — no implementado.
5. **Autenticación** — `rejectIfUnauthorized` existe pero probablemente es un placeholder.
6. **Multi-agent orchestration** — los agentes se ejecutan de a uno por llamada; no hay coordinación entre ellos.
7. **Conexión con `amon-agents`** — no existe protocolo ni adaptador.

---

## 11. Riesgos Críticos

| # | Riesgo | Severidad | Mitigación |
|---|---|---|---|
| 1 | **Directorio legacy anidado** puede ser re-incluido en compilación si se toca `tsconfig.json` | 🔴 Alta | Mover a `archive/` o eliminar tras backup |
| 2 | `findCardByTitle()` carga **TODAS** las tareas en memoria | 🔴 Alta | Agregar `ilike` en DB o índice de búsqueda de texto |
| 3 | **Sin auth** en endpoints de escritura (terminal, agents, tasks) | 🟡 Media | Implementar API key o session middleware antes de deploy público |
| 4 | **Sin SSE** = UI stale tras acciones de agentes/terminal | 🟡 Media | Implementar polling ligero o SSE en Fase 4 |
| 5 | Tags en `jsonb` sin índice GIN = full scan en filtrado | 🟡 Media | Para volúmenes grandes, migrar a tabla relacional + GIN index |
| 6 | **Sin rate limiting** en terminal y agents | 🟡 Media | Agregar `lru-cache` o middleware de throttling |
| 7 | `focus_sessions` permite solo **una sesión activa** por estado (no soporta múltiples usuarios) | 🟢 Baja | Aceptable para uso personal; escalar con `userId` si se necesita multiusuario |

---

## 12. Plan por Fases

### Fase 1: Estabilizar Backend-First (Sprint actual)
- [x] Migrar schema Drizzle a PostgreSQL
- [x] Migrar conexión DB a `pg` + `DATABASE_URL`
- [x] Migrar rutas API a operaciones Drizzle async
- [x] Verificar build limpio
- [ ] **Pendiente:** Remover o aislar directorio legacy anidado
- [ ] **Pendiente:** Eliminar archivos mock huérfanos (`lib/mock/*`, `lib/console/mock-events.ts`)
- [ ] **Pendiente:** Agregar índices básicos en PostgreSQL (ver sección 14)

### Fase 2: Búsqueda / Filtros Reales (Próximo sprint)
- [ ] Reemplazar filtrado de tags en memoria por consulta SQL eficiente
- [ ] Implementar búsqueda full-text con `to_tsvector` (PostgreSQL native) o `pg_trgm`
- [ ] Agregar paginación cursor-based en `/api/search` y `/api/tasks`
- [ ] Crear endpoint `/api/stats` para dashboard de backlog

### Fase 3: Documentación Persistida
- [x] Tabla `knowledge_entries` ya existe y funciona
- [ ] UI para crear/editar knowledge entries desde el board
- [ ] Vincular knowledge entries a tareas (`sourceTaskId`)
- [ ] Generar automáticamente knowledge entry desde diagnóstico (root cause)

### Fase 4: Sync Visual
- [ ] Implementar SSE endpoint: `/api/events/stream`
- [ ] Conectar frontend con `EventSource`
- [ ] Emitir eventos desde `action-executor.ts` y `task` mutations
- [ ] Alternativa fallback: polling cada 5s con `If-Modified-Since`

### Fase 5: Conexión `amon-agents`
- [ ] Definir contrato JSON de mensajes entre SB y `amon-agents`
- [ ] Crear adapter: `lib/agents/amon-adapter.ts`
- [ ] Endpoint de webhook: `/api/agents/webhook` para recibir acciones de `amon-agents`
- [ ] Autenticación por API key entre servicios

### Fase 6: Multi-Agent Real
- [ ] Implementar orquestador de agentes (`lib/agents/orchestrator.ts`)
- [ ] Cola de tareas para agentes (usar tabla `agent_jobs` en Postgres)
- [ ] Patrón "plan → execute → review" con múltiples agentes
- [ ] UI de observabilidad: ver qué agente está corriendo y su output

---

## 13. Plan Exacto del Próximo Sprint (Fase 2)

**Duración sugerida:** 1–2 semanas  
**Objetivo:** Búsqueda/filtros de producción + limpieza de deuda técnica

### Semana 1 – Limpieza y estabilización
1. **Mover directorio legacy** a `archive/sentinel-board-sqlite/` o eliminar tras confirmar backup.
2. **Eliminar mocks huérfanos:** `lib/mock/*`, `lib/console/mock-events.ts`.
3. **Agregar índices en PostgreSQL:**
   ```sql
   CREATE INDEX idx_tasks_project_status ON tasks(project_id, status);
   CREATE INDEX idx_tasks_updated_at ON tasks(updated_at DESC);
   CREATE INDEX idx_knowledge_project ON knowledge_entries(project_id);
   CREATE INDEX idx_knowledge_slug ON knowledge_entries(slug);
   CREATE INDEX idx_events_created_at ON events(created_at DESC);
   CREATE INDEX idx_comments_card ON card_comments(card_id);
   ```
4. **Optimizar `findCardByTitle()`:** usar `ilike` en vez de cargar todo en memoria.

### Semana 2 – Búsqueda avanzada
5. **Implementar full-text search en PostgreSQL:**
   - Agregar columna `searchVector` en `tasks` y `knowledge_entries` (opcional).
   - O usar `pg_trgm` con `ilike` optimizado (más simple, sin migraciones de schema).
6. **Paginación en `/api/search` y `/api/tasks`:**
   - Parámetros: `cursor`, `limit`.
   - Devolver `nextCursor` para infinite scroll.
7. **Endpoint `/api/stats`:**
   - Conteo de tareas por estado y prioridad.
   - Tiempo total de focus sessions por proyecto.
8. **Tests de integración:**
   - Validar que `/api/search` devuelve resultados reales de Neon.
   - Validar que filtros combinados (`projectId + status + q`) funcionan.

---

## 14. Comandos de Prueba

### Verificar conexión a DB
```bash
npm run db:studio        # Drizzle Studio (UI de DB)
```

### Verificar build limpio
```bash
npm run build            # Debe pasar sin errores
```

### Seed de datos (si se necesita)
```bash
npm run db:seed          # Carga datos de prueba
```

### Probar rutas API manualmente
```bash
# Listar proyectos
curl http://localhost:3000/api/projects

# Buscar tareas
curl "http://localhost:3000/api/search?q=neon&limit=5"

# Crear tarea
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"id":"t-001","title":"Test task","projectId":"1","status":"idea_bruta"}'

# Terminal HEO
curl -X POST http://localhost:3000/api/terminal/run \
  -H "Content-Type: application/json" \
  -d '{"command":"listar"}'

# Ejecutar agente
curl -X POST http://localhost:3000/api/agents/run \
  -H "Content-Type: application/json" \
  -d '{"agent":"planner","input":{"task":"Planificar sprint 2"}}'
```

### Verificar migración
```bash
npm run db:report:migration   # Guarda reporte en DB como knowledge entry
```

---

## 15. Recomendación Final (Tipo CTO)

**Sentinel Board está en una posición sólida.** La migración a backend-first sobre Neon/Postgres fue ejecutada correctamente: el schema es limpio, las rutas API son consistentes y el terminal HEO ya opera con datos reales.

**La prioridad #1 del próximo sprint es la deuda técnica de búsqueda.** Hoy la búsqueda funciona, pero el filtrado de tags en memoria y la ausencia de paginación se convertirán en cuellos de botella antes de lo que parece. Además, el directorio legacy anidado es una mina de tiempo: cualquier desarrollador nuevo que toque `tsconfig.json` sin contexto volverá a romper el build.

**No construyas features visuales nuevos hasta que el backend de búsqueda sea robusto.** Un board con sync visual (Fase 4) es sexy, pero si la búsqueda devuelve 500ms+ o full-scans, la experiencia se derrumba. Invierte primero en índices y full-text search PostgreSQL; el SSE puede esperar 1 sprint más.

**Respecto a `amon-agents`:** Tenemos las definiciones YAML, pero no tenemos protocolo. Antes de conectar ambos sistemas, define el contrato de mensajes (JSON Schema) y empieza por un webhook simple. No intentes orquestación multi-agent compleja (Fase 6) hasta que un solo agente externo pueda crear una tarea en SB de forma confiable y observable.

**Métrica de éxito para el próximo sprint:**
- Build < 3s
- `/api/search` con `q` + filtros < 100ms en Neon (hasta 10k registros)
- Cero archivos legacy en el tree de compilación

**SB ya no es un mock. Es un workspace real. Trátalo como tal: índices, tests, y observabilidad antes de más magia.**

---

## Apéndice: Archivos Revisados

### Código activo (raíz)
- `package.json`
- `tsconfig.json` *(modificado durante auditoría)*
- `next.config.ts`
- `drizzle.config.ts`
- `lib/db/index.ts`
- `lib/db/schema.ts`
- `lib/db/seed.ts`
- `app/api/search/route.ts`
- `app/api/tasks/route.ts`
- `app/api/tasks/[id]/route.ts`
- `app/api/tasks/[id]/comments/route.ts`
- `app/api/projects/route.ts`
- `app/api/knowledge/route.ts`
- `app/api/events/route.ts`
- `app/api/dock-commands/route.ts`
- `app/api/focus-sessions/route.ts`
- `app/api/root-cause/route.ts`
- `app/api/terminal/run/route.ts`
- `app/api/agents/run/route.ts`
- `lib/server/terminal-runner.ts`
- `lib/server/action-resolver.ts`
- `lib/server/action-executor.ts`
- `lib/server/root-cause-analyzer.ts`
- `lib/server/log-event.ts`
- `lib/ai/ai-router.ts`
- `lib/ai/ai-provider.ts`
- `lib/ai/providers/ollama-provider.ts`
- `lib/ai/providers/lmstudio-provider.ts`
- `lib/agents/run-agent.ts`
- `lib/agents/load-agent.ts`
- `lib/agents/build-agent-prompt.ts`
- `lib/agents/parse-planner-response.ts`
- `lib/mock/projects.ts`
- `lib/mock/cards.ts`
- `lib/console/mock-events.ts`
- `scripts/save-migration-report.ts`

### Código legacy (directorio anidado `sentinel-board/`)
- `sentinel-board/lib/db/schema.ts` (sqliteTable)
- `sentinel-board/lib/db/index.ts` (better-sqlite3)
- `sentinel-board/lib/db/seed.ts` (better-sqlite3)
- `sentinel-board/lib/server/sync-bus.ts`
- `sentinel-board/lib/server/action-executor.ts`
- `sentinel-board/lib/server/feedback-service.ts`
- `sentinel-board/lib/server/insight-engine.ts`
- `sentinel-board/app/api/dock-commands/route.ts` (usa `.run()`)
- `sentinel-board/app/api/focus-sessions/route.ts`
- `sentinel-board/app/api/feedback/route.ts`
- `sentinel-board/next.config.ts`
- `sentinel-board/drizzle.config.ts`

---
*Fin del informe.*

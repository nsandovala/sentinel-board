# Sentinel Board

> Cockpit operacional para desarrollo asistido por agentes IA. Pareja con
> [AMON Agents](https://github.com/nsandovala/amon-agents) como runtime
> externo. SB observa, persiste y coordina; AA ejecuta.

![Sentinel Board](docs/screenshots/board-overview.png)

---

## Qué es Sentinel Board (hoy)

Sentinel Board **no** es un kanban genérico ni un workspace IA de propósito
general. Es un **cockpit operacional** con cuatro superficies coordinadas:

| Superficie | Rol | Persistencia |
|---|---|---|
| **Board** | Estado actual de cards por proyecto/columna | PostgreSQL (Neon) |
| **Timeline** | Historia operacional cronológica | PostgreSQL |
| **Detail Panel** | Contexto de la card seleccionada (Codex Loop, Money Code, comentarios) | PostgreSQL |
| **HEO Copilot Dock** | Runtime vivo: ejecutar, analizar, foco, observar agentes | Sesión + DB |

La regla mental que ordena todo:

- **Board** es _estado_ — lo que existe ahora.
- **Timeline** es _memoria_ — lo que pasó.
- **Detail Panel** es _contexto_ — lo que importa de un ítem.
- **Dock** es _acción_ — lo que voy a hacer ahora.

El dock está unificado bajo un único `CopilotInput` con cuatro modos:
`Execute`, `Analyze`, `Focus`, `Runtime`. Detalle exhaustivo en
[`docs/OPERATIONAL_COCKPIT.md`](docs/OPERATIONAL_COCKPIT.md).

---

## Arquitectura

```
Developer
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  Sentinel Board (Next.js 16 / React 19)                     │
│                                                             │
│   Board        Timeline       Detail Panel                  │
│       └──────────┬─────────────────┘                        │
│                  ▼                                          │
│          SentinelProvider                                   │
│         (Context + Reducer, store con resync en error)      │
│                  │                                          │
│                  ▼                                          │
│           HEO Copilot Dock                                  │
│      Execute · Analyze · Focus · Runtime                    │
│                  │                                          │
│       ┌──────────┼──────────────────┐                       │
│       ▼          ▼                  ▼                       │
│   Postgres   AI Router          /api/runtime/events         │
│   (Neon)     (Ollama →           (NDJSON tail polling)      │
│              OpenRouter →                                   │
│              Anthropic →                                    │
│              heurístico)                                    │
└─────────┬─────────┬─────────────────┬───────────────────────┘
          │         │                 │
          ▼         ▼                 ▼
     PostgreSQL  Provider LLM   AMON Agents (runtime externo)
     (verdad)                   NDJSON / Event Stream
```

**AMON Agents** es runtime externo: ejecuta agentes (planner, state-guardian,
qa-reviewer, scorer) y emite eventos a un archivo NDJSON. SB **solo lee** ese
NDJSON (Fase 4, polling cada 3 s). Streaming bidireccional queda para
Fase 5+.

---

## Conceptos operacionales

| Concepto | Significado |
|---|---|
| **Single-Card architecture** | Hay una `selectedCardId` global; el Detail Panel y el Dock comparten ese contexto. No hay multi-select. |
| **Operational Dock** | Franja inferior redimensionable (240 px ↔ 65 vh), modos internos, status badge global `idle/running/ok/error`. |
| **Runtime polling** | El modo Runtime hace `GET /api/runtime/events` cada 3 s y deriva estado por agente desde los tipos `agent.started/done/error`. |
| **Event Stream (planned)** | WebSocket/SSE formal entre AA y SB — Fase 5. Hoy solo polling NDJSON. |
| **AI Routing** | `lib/ai/ai-router.ts` cae en cascada Ollama → OpenRouter → Anthropic → heurístico. Cada provider valida su modelo contra `lib/ai/models.ts` antes de hacer fetch. |
| **Context orchestration** | El dock combina card seleccionada, proyecto activo, foco actual y modo para enrutar el submit del input único. |
| **Timeline = source of operational history** | Toda acción relevante (mover, crear, comentar, foco) emite a `events`. El dock NO mantiene log propio. |

---

## Quick Start

```bash
git clone https://github.com/nsandovala/sentinel-board.git
cd sentinel-board
npm install
cp .env.example .env.local
# pegar DATABASE_URL de Neon / Render Postgres
npm run db:push && npm run db:seed
npm run dev
```

Requiere Node `22` (ver `.nvmrc`). Abrir [http://localhost:3000/board](http://localhost:3000/board).
La UI funciona sin providers IA — el fallback heurístico analiza texto
localmente.

HTTPS local opcional: `npm run dev:https`.

---

## Providers IA (opcionales)

| Provider | Costo | Setup |
|---|---|---|
| Sin IA | $0 | Fallback heurístico siempre activo |
| Ollama | $0 | `ollama pull qwen3:8b` |
| OpenRouter | Free tier | Crear cuenta en [openrouter.ai](https://openrouter.ai) → API key |
| Anthropic | ~$0.001/req | Crear cuenta en [console.anthropic.com](https://console.anthropic.com) → API key |

```bash
# .env.local
DATABASE_URL=postgresql://user:pass@host:5432/dbname
PG_POOL_MAX=10
SENTINEL_API_TOKEN=optional-token-for-non-loopback-writes

OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen3:8b

OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=qwen/qwen3-8b:free

ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-haiku-4-5-20251001

# Runtime de AMON Agents (Fase 4)
AMON_EVENTS_PATH=C:\Dev\amon-agents\outputs\events.jsonl
```

**Prioridad del router**: Ollama → OpenRouter → Anthropic → heurístico.

**Validación de modelos**: cada provider rechaza el request antes del fetch
si el modelo configurado no pasa `validateModel()` (ver `lib/ai/models.ts`).
Modelos legacy o inventados producen un warning único por proceso y el
provider se marca como no-disponible en `describeProviders()`.

---

## Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16.1.7 (App Router, Turbopack, React Compiler) |
| Lenguaje | TypeScript strict |
| UI | React 19 + shadcn/ui + Radix primitives |
| Estilos | Tailwind CSS 4 + custom properties (OKLCH) |
| Persistencia | PostgreSQL (Neon / Render) + Drizzle ORM |
| Validación | Zod (server-side, `lib/validation/`) |
| Drag & drop | `@dnd-kit/core` + `@dnd-kit/utilities` |
| Superficie operacional | HEO Copilot Dock (única superficie, sin terminal paralela) |
| IA | Ollama → OpenRouter → Anthropic → heurístico (modelo validado pre-fetch) |
| Runtime externo | AMON Agents (NDJSON event stream, lectura por polling) |

---

## Features

### Board (9 estados)

Drag & drop entre columnas. Flujo: Idea bruta → Clarificando → Validando →
En proceso → Desarrollo → QA → Listo → Producción → Archivado. Cards con
prioridad, tipo, tags, checklist, timestamps, bloqueo, y eliminación con
confirmación.

![Board con columnas y cards](docs/screenshots/board-terminal.png)

### HEO Copilot Dock — modo Execute

Comandos deterministas locales que ejecutan contra Postgres sin LLM:

| Comando | Acción |
|---|---|
| `crear tarea <título> en <proyecto>` | Crea card (POST `/api/tasks`) |
| `mover "<título>" a <estado>` | Cambia status (PATCH `/api/tasks/:id`) |
| `registrar <n> horas en <proyecto>` | Registra log de tiempo |
| `iniciar foco` / `terminar foco` | Controla `focus_sessions` |

Tolera verbos castellanos: `pasa`, `manda`, `lleva`, `pon`, `cambia`.

![HEO Copilot ejecutando acciones locales](docs/screenshots/heo-copilot.png)

### Dock — modo Analyze

Pega texto/idea/contexto, submit con `Ctrl + Enter`. Pipeline:
`POST /api/agents/run → planner` (provider configurable) con fallback
heurístico si el agente falla. Devuelve resumen + tareas propuestas + Codex
Loop. Crear cards requiere confirmación humana.

![Resultado del planner](docs/screenshots/planner-analysis.png)

### Dock — modo Focus

Timer en sesión, vinculación con card activa, deep-link "Localizar" al board.

### Dock — modo Runtime

Estado real por agente (`planner`, `state-guardian`, `qa-reviewer`, `scorer`)
derivado del NDJSON de AMON Agents:

- `agent.started → running`
- `agent.done → success`
- `agent.error → error`
- sin evento reciente → `idle`

Polling cada 3 s, badge "Event Stream conectado/pendiente" según
existencia del archivo. **No** se ejecutan agentes desde SB en esta fase.

![Dock expandido](docs/screenshots/dock-expanded.png)

### Detail Panel

Codex Loop (6 pasos), Money Code (scoring multidimensional), próxima acción
sugerida con comando copiable, comentarios.

![Panel derecho con Codex Loop](docs/screenshots/codex-loop-panel.png)

### Comentarios por card

4 tipos: `comment`, `decision`, `system`, `agent`. Lazy-load al seleccionar
una card. Persistencia en `card_comments` (cascade desde `tasks`).

![Comentarios](docs/screenshots/comments-activity.png)

### Búsqueda y filtros backend-first

Todos los filtros del top bar consultan Postgres vía API — no hay filtrado
en memoria:

- `GET /api/tasks?q=&projectId=&status=&priority=&type=&tag=&blocked=&limit=&offset=`
- `GET /api/search?q=&projectId=&status=&priority=&tag=`
- `GET /api/knowledge?q=&projectId=&category=&status=&tag=`

### Knowledge Base

Documentación operacional persistida en `knowledge_entries` (categorías:
`report`, `decision`, `runbook`, `note`, `postmortem`). Buscable por
proyecto, tag y query libre.

### Backlog Inteligente

Vista filtrada de ideas brutas y bloqueadas, ordenadas por scoring.

![Backlog](docs/screenshots/backlog-scoring.png)

---

## Base de datos

10 tablas en PostgreSQL (Drizzle):

| Tabla | Descripción |
|---|---|
| `projects` | Proyectos del workspace |
| `tasks` | Cards (status, priority, tags, codexLoop, fiveWhys, moneyCode) |
| `task_checklist_items` | Items de checklist (cascade desde `tasks`) |
| `card_comments` | Comentarios (cascade desde `tasks`) |
| `events` | Timeline operacional |
| `dock_commands` | Telemetría del dock |
| `focus_sessions` | Sesiones de foco |
| `knowledge_entries` | Base de conocimiento |
| `suggestion_feedback` | Aceptación/rechazo de sugerencias HEO |
| `system_insights` | Insights generados por el motor de análisis |

### Scripts

| Script | Acción |
|---|---|
| `npm run db:push` | Aplica schema directo (dev rápido) |
| `npm run db:generate` | Genera SQL versionado en `drizzle/` |
| `npm run db:migrate` | Aplica migraciones pendientes |
| `npm run db:seed` | Datos iniciales |
| `npm run db:studio` | Drizzle Studio |

### Render / Neon

```text
Build Command: npm install && npm run db:migrate && npm run build
Start Command: npm start
Vars:          DATABASE_URL=postgresql://...
               PG_POOL_MAX=10
```

---

## API

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/tasks` | Lista con filtros SQL (q, projectId, status, priority, type, tag, blocked, limit, offset) |
| `POST` | `/api/tasks` | Crea card + evento |
| `PATCH` | `/api/tasks/:id` | Update parcial (Zod-validated) → `{ ok, task }` |
| `DELETE` | `/api/tasks/:id` | Borra → `{ ok, deletedId }` |
| `GET` | `/api/tasks/:id/comments` | Lista cronológica |
| `POST` | `/api/tasks/:id/comments` | Crea (Zod-validated, `crypto.randomUUID`) |
| `GET` | `/api/projects` | Lista de proyectos |
| `GET/POST` | `/api/events` | Timeline |
| `GET/POST` | `/api/dock-commands` | Telemetría del dock |
| `GET/POST` | `/api/focus-sessions` | Sesiones de foco |
| `GET` | `/api/knowledge` | Knowledge entries con filtros |
| `GET` | `/api/search` | Búsqueda agregada (tasks + knowledge) |
| `GET` | `/api/runtime/events` | Tail NDJSON de AA → estado por agente |
| `GET` | `/api/insights` / `POST` `/api/insights/run` | System insights |
| `POST` | `/api/root-cause` | 5 Whys assist |
| `POST` | `/api/feedback` | Decisión sobre sugerencias HEO |
| `GET` | `/api/stream` | SSE bus interno (refresh hints) |
| `POST` | `/api/agents/run` | Ejecuta agente IA local (no AA) |

Endpoints de mutación validan body con Zod
(`lib/validation/tasks.ts`). Errores: `400` body inválido, `404` no
encontrado, `500` genérico (detalle queda server-side).

---

## Estructura del proyecto

```
app/
  (dashboard)/                  Shell: sidebar + topbar + board + dock
  api/
    tasks/                      CRUD + filtros SQL
    tasks/[id]/                 PATCH/DELETE
    tasks/[id]/comments/        GET/POST
    runtime/events/             Tail NDJSON de AMON Agents (Fase 4)
    agents/run/                 Ejecución local de agentes IA
    search/  knowledge/         Búsqueda agregada y KB
    insights/  root-cause/      Motor de análisis y 5 Whys
    feedback/  events/  stream/ Telemetría y SSE interno
    focus-sessions/  dock-commands/  projects/

components/
  board/                        board-view, column, card-item
  console/                      command-suggestions, focus-timer, quick-actions
  console/dock/                 dock-workspace, copilot-input, dock-mode-tabs,
                                command-mode, analyze-mode, focus-mode, agents-mode
                                (HEO Copilot Dock como única superficie operacional)
  layout/  modals/  ui/

lib/
  state/                        sentinel-store.tsx, sentinel-reducer.ts
  db/                           schema.ts (10 tablas), index.ts, seed.ts
  ai/                           ai-router.ts (validated), models.ts, ai-types.ts
  ai/providers/                 ollama, lmstudio
  ai/prompts/                   prompts versionados
  agents/                       run-agent, load-agent, build-prompt, parse-response
  validation/                   tasks.ts (Zod: PATCH, POST comment, GET query)
  server/                       request-guard, assemble-card, sync-bus,
                                action-resolver, action-executor, agent-outputs,
                                feedback-service, insight-engine, root-cause-analyzer,
                                log-event, task-validation
  console/                      command-parser, command-executor, generators
  scoring/                      backlog-scorer

types/                          card, comment, enums, event, project,
                                knowledge, agent, root-cause, timer, command

agents/                         definitions/ (YAML), prompts/ (MD), skills/

docs/
  ROADMAP.md                    Fases 1–9 con estado
  PHASE_LOG.md                  Bitácora detallada por fase
  OPERATIONAL_COCKPIT.md        Arquitectura UX del dock
```

---

## Estado del roadmap

Detalle completo en [`docs/ROADMAP.md`](docs/ROADMAP.md) y bitácora en
[`docs/PHASE_LOG.md`](docs/PHASE_LOG.md).

### Operativo (en `main`, con `tsc + build` verdes)

- **Fase 1** — Desfragmentación visual del dock
- **Fase 2** — HEO Copilot unificado (un input, status badge global)
- **Fase 3** — Dock dev-first profesional (resize, persistencia, Dev Matte)
- **Fase 4** — Runtime real mínimo (polling NDJSON cada 3 s)
- **Fase 4A** — Backend hardening: PATCH/DELETE completos, validación Zod,
  store sin persistencia silenciosa
- **Fase 4A.2** — Filtros SQL reales en `GET /api/tasks` (no en memoria)
- **Fase 4A.3** — Validación fuerte de modelos IA (ningún fetch con modelo
  inválido)

### Experimental / en diseño

- **Fase 5** — Event Stream formal (contrato `RuntimeEvent` + transporte
  SSE/WS). Hoy solo polling.

### Planeado

- **Fase 6** — Integración AA bidireccional (SB lanza, AA ejecuta, ambos
  comparten contrato de Fase 5)
- **Fase 7** — Auth + multi-workspace (Clerk u opción equivalente)
- **Fase 8** — Telemetría de provider + tokens
- **Fase 9** — Voice Copilot (exploratorio, requiere 4–7 estables)

---

## Contribuir

- Reglas operacionales y contratos para nuevos cambios: [`AGENT.md`](AGENT.md)
- Workflow de PRs y convenciones: [`CONTRIBUTING.md`](CONTRIBUTING.md)

## Licencia

MIT

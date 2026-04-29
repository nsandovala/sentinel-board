# Sentinel Board

> Workspace vivo de operaciones para ingenieria de software. No es un kanban -- es una interfaz de ejecucion donde ideas se convierten en trabajo estructurado, analizado y accionable.

![Sentinel Board](docs/screenshots/board-overview.png)

---

## Por que Sentinel Board

| Problema | Sentinel Board |
|----------|---------------|
| Los kanbans son pasivos | Cards con acciones reales: eliminar, mover, comentar desde terminal |
| El analisis vive fuera del board | Pegar texto -> analisis estructurado -> cards en el board, todo en un flujo |
| La IA reemplaza al usuario | La IA es opcional. El sistema completo funciona offline sin providers |
| El estado se pierde al recargar | Postgres + Drizzle. Persistencia real en cada accion |

---

## Quick Start

```bash
git clone https://github.com/nsandovala/sentinel-board.git
cd sentinel-board
npm install
cp .env.example .env.local
# poner DATABASE_URL de Render Postgres
npm run db:push && npm run db:seed
npm run dev
```

Usar Node `22` (ver `.nvmrc`) para evitar problemas de arranque con versiones no LTS.

Abrir [http://localhost:3000/board](http://localhost:3000/board) -- funciona sin IA.

Si necesitas HTTPS local para probar certificados o APIs seguras:

```bash
npm run dev:https
```

### Providers de IA (opcionales)

| Provider | Costo | Setup |
|----------|-------|-------|
| Sin IA | $0 | Nada. Fallback heuristico analiza texto localmente |
| Ollama | $0 | `ollama pull qwen3:8b` y listo |
| OpenRouter | Free tier | Crear cuenta en [openrouter.ai](https://openrouter.ai) -> copiar API key |
| Anthropic | ~$0.001/req | Crear cuenta en [console.anthropic.com](https://console.anthropic.com) -> copiar API key |

```bash
# .env.local
DATABASE_URL=postgresql://user:pass@host:5432/dbname
PG_POOL_MAX=10
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen3:8b
OPENROUTER_API_KEY=sk-or-...
ANTHROPIC_API_KEY=sk-ant-...
```

**Prioridad del router**: Ollama -> OpenRouter -> Anthropic -> Fallback heuristico

---

## Features

### Board Kanban (9 estados)

Drag & drop real entre columnas. 9 estados de flujo: Idea bruta -> Clarificando -> Validando -> En proceso -> Desarrollo -> QA -> Listo -> Produccion -> Archivado.

Cards con prioridad, tipo, tags, checklist, timestamps, y boton de eliminar con confirmacion.

![Board con columnas y cards](docs/screenshots/board-terminal.png)

### HEO Copilot (Terminal)

Terminal operativa con acciones reales sobre el sistema. Los comandos locales se ejecutan contra la BD sin pasar por el LLM.

![HEO Copilot ejecutando acciones locales](docs/screenshots/heo-copilot.png)

| Comando | Tipo | Que hace |
|---------|------|----------|
| `lista las 3 prioridades mas altas` | `[ACTION]` | Lee cards reales de la BD, ordena por prioridad |
| `mueve Ingesta real de amon-agents a clarificando` | `[ACTION]` | Actualiza status en BD, refresca board automaticamente |
| `que hora es` | `[ACTION]` | Hora real del sistema |
| Cualquier otro comando | `[TEXT]`/`[JSON]` | Se envia al LLM via ai-router |

Soporta lenguaje natural sin comillas: `pasa`, `manda`, `lleva`, `pon`, `cambia` -- todos funcionan como verbos de movimiento.

Cuando Ollama u otro provider esta disponible, responde preguntas libres:

![Respuesta de Ollama en terminal](docs/screenshots/ollama-response.png)

### Command Dock

Panel inferior con dos modos:

- **COMANDO**: Crear tareas, mover cards, iniciar foco, registrar tiempo
- **ANALIZAR**: Pegar texto libre -> analisis estructurado con agente IA -> crear cards en el board

![Dock expandido con registro y acciones rapidas](docs/screenshots/dock-expanded.png)

### Planner (Analisis con IA)

Pega cualquier texto, pregunta o contexto en la pestana ANALIZAR. El agente planner devuelve: resumen ejecutivo, proximos pasos, tareas propuestas para el backlog, riesgos, y un Codex Loop completo.

![Resultado del planner con tareas y riesgos](docs/screenshots/planner-analysis.png)

### Panel Derecho (Detalle HEO)

Al seleccionar una card: Codex Loop (6 pasos), Codigo del Dinero (scoring multidimensional), siguiente accion sugerida con comando copiable, y seccion de comentarios.

![Panel derecho con Codex Loop y comando sugerido](docs/screenshots/codex-loop-panel.png)

### Comentarios por Card

4 tipos de comentario: comentario, decision, sistema, agente. Se cargan on-demand al seleccionar una card y persisten en SQLite.

![Seccion de actividad y comentarios](docs/screenshots/comments-activity.png)

### Backlog Inteligente

Vista filtrada de ideas brutas y tareas bloqueadas, ordenadas por scoring de prioridad. Incluye analizador de backlog con IA.

![Backlog con scoring y analisis](docs/screenshots/backlog-scoring.png)

### Drag & Drop

Arrastrar cards entre columnas con feedback visual. Persistencia automatica via PATCH.

![Card siendo arrastrada entre columnas](docs/screenshots/drag-drop.png)

### Búsqueda y Filtros Backend-First

La barra superior ya no usa placeholders visuales. La búsqueda y los filtros consultan Postgres via API:

- `GET /api/tasks?q=&projectId=&status=&priority=&tag=`
- `GET /api/search?q=&projectId=&status=&priority=&tag=`
- `GET /api/knowledge?q=&projectId=&category=&status=&tag=`

La UI usa esos endpoints para:

- buscar tareas reales
- buscar documentación persistida en BD
- filtrar por proyecto, estado, prioridad y tag

### Knowledge Base

Sentinel Board ahora persiste documentación operativa en la tabla `knowledge_entries`.

Campos principales:

- `projectId`
- `title`
- `slug`
- `category`
- `status`
- `tags`
- `summary`
- `body`
- `sourceTaskId`
- timestamps

Casos de uso:

- informes técnicos
- decisiones
- runbooks
- postmortems
- notas operativas

El informe de migración a Neon/Render quedó guardado tanto como card/comentario como en `knowledge_entries`, así que ya es buscable por tags y proyecto.

### Mas

- **Timeline**: Registro cronologico de toda accion ejecutada
- **Proyectos**: Filtro lateral que segmenta board, timeline y panel (5 proyectos en la sidebar)
- **Foco**: Temporizador integrado con registro automatico
- **Toast contextual**: Feedback visual al copiar informes y comandos

---

## Stack

| Capa | Tecnologia |
|------|-----------|
| Framework | Next.js 16.1.7 (App Router, Turbopack, React Compiler) |
| Lenguaje | TypeScript strict |
| UI | React 19 + shadcn/ui + Radix primitives |
| Estilos | Tailwind CSS 4 + CSS custom properties (OKLCH) |
| Persistencia | PostgreSQL + Drizzle ORM |
| Drag & drop | @dnd-kit/core + @dnd-kit/utilities |
| Terminal | xterm.js + addon-fit |
| IA | Ollama -> OpenRouter -> Anthropic -> fallback heuristico |
| Estado | React Context + useReducer (UI) / PostgreSQL (verdad) |

---

## Arquitectura

```
                    +------------------+
                    |   Dashboard UI   |
                    +--------+---------+
                             |
          +------------------+------------------+
          |                  |                  |
    +-----+------+   +------+------+   +-------+-------+
    |   Board    |   | Right Panel |   |  Command Dock |
    |  (Kanban)  |   |   (Detail)  |   | (Cmd/Analyze) |
    +-----+------+   +------+------+   +-------+-------+
          |                  |                  |
          +------------------+------------------+
                             |
                   +---------+---------+
                   | SentinelProvider  |
                   | Context+Reducer   |
                   +---------+---------+
                             |
               +-------------+-------------+
               |                           |
      +--------+--------+        +--------+--------+
      | API Routes       |        | HEO Copilot     |
      | /api/tasks       |        | Terminal Panel   |
      | /api/events      |        +--------+--------+
      | /api/comments    |                 |
      +--------+--------+        +--------+--------+
               |                 | action-resolver  |
               |                 | action-executor  |
               |                 +--------+--------+
               |                          |
               |                 +--------+--------+
               |                 | ai-router.ts    |
               |                 | (LLM fallback)  |
               |                 +-----------------+
               |
         +-----+-----+
         |  SQLite    |
         | sentinel.db|
         +-----------+
```

---

## Base de Datos

8 tablas en PostgreSQL via Drizzle ORM:

| Tabla | Descripcion |
|-------|------------|
| `projects` | Proyectos del workspace |
| `tasks` | Cards con status, priority, tags, codexLoop, fiveWhys, moneyCode (JSON) |
| `task_checklist_items` | Items de checklist por tarea |
| `card_comments` | Comentarios por card (4 tipos) |
| `events` | Timeline de eventos del sistema |
| `dock_commands` | Registro de comandos del dock |
| `focus_sessions` | Sesiones de foco |
| `knowledge_entries` | Documentación operativa persistida y buscable |

### Scripts de BD

| Script | Que hace |
|--------|----------|
| `npm run db:push` | Crea/actualiza tablas segun el schema |
| `npm run db:generate` | Genera migraciones SQL versionadas en `drizzle/` |
| `npm run db:migrate` | Ejecuta migraciones pendientes en la base |
| `npm run db:seed` | Puebla la BD con datos iniciales |
| `npm run db:studio` | Abre Drizzle Studio para inspeccionar |

### Flujo recomendado

En desarrollo rapido:

```bash
npm run db:push
npm run db:seed
```

Para despliegue serio en Render:

```bash
# 1. generar la migracion desde el schema actual
npm run db:generate

# 2. aplicar migraciones en tu base
npm run db:migrate

# 3. poblar datos de ejemplo si quieres
npm run db:seed
```

La primera vez, `npm run db:generate` creara la carpeta `drizzle/` con el SQL inicial del sistema.

Si agregas tablas nuevas, el flujo correcto es:

```bash
npm run db:generate
npm run db:migrate
```

No basta con `db:generate`: ese comando solo crea el SQL. `db:migrate` aplica el schema real en Neon/Render.

### Render

Config recomendada para el servicio web:

```text
Build Command: npm install && npm run db:migrate && npm run build
Start Command: npm start
```

Variables minimas:

```text
DATABASE_URL=postgresql://...
PG_POOL_MAX=10
```

## Backend-First

Desde esta etapa, el board ya no depende de datos mock para su flujo principal:

- la persistencia base vive en Postgres
- las cards se hidratan desde `/api/tasks`
- el timeline se hidrata desde `/api/events`
- la documentación se hidrata desde `/api/knowledge`
- la búsqueda agregada usa `/api/search`

Si la UI aparece vacía, la primera verificación correcta ya no es revisar mocks sino consultar las APIs:

```bash
curl http://localhost:3000/api/tasks
curl http://localhost:3000/api/events
curl http://localhost:3000/api/knowledge
```

---

## API

| Metodo | Ruta | Descripcion |
|--------|------|------------|
| `GET` | `/api/tasks` | Lista tareas con checklist |
| `POST` | `/api/tasks` | Crea tarea + evento |
| `PATCH` | `/api/tasks/:id` | Actualiza campos de tarea |
| `DELETE` | `/api/tasks/:id` | Elimina tarea + evento |
| `GET` | `/api/tasks/:id/comments` | Comentarios de una card |
| `POST` | `/api/tasks/:id/comments` | Agrega comentario |
| `POST` | `/api/terminal/run` | Ejecuta comando en terminal |
| `POST` | `/api/agents/run` | Ejecuta agente IA |
| `GET` | `/api/projects` | Lista proyectos |
| `GET/POST` | `/api/events` | Timeline de eventos |
| `GET/POST` | `/api/dock-commands` | Registro del dock |
| `GET/POST` | `/api/focus-sessions` | Sesiones de foco |

---

## Estructura del Proyecto

```
app/
  (dashboard)/
    layout.tsx                  Shell: sidebar + topbar + HEO Copilot + dock
    board/page.tsx              Vista principal del board
  api/
    tasks/                      CRUD de tareas
    tasks/[id]/comments/        Comentarios por card
    terminal/run/               Endpoint de la terminal
    agents/run/                 Endpoint de agentes IA
    events/                     Timeline
    projects/                   Proyectos

components/
  board/                        board-view, column, card-item
  console/                      command-dock, input, log, suggestions, timer
  terminal/                     terminal-panel (xterm.js, HEO Copilot)
  layout/                       app-sidebar, topbar, right-panel
  modals/                       create-task-modal, move-state-modal
  ui/                           shadcn primitives (button, card, toast, etc.)

lib/
  state/                        sentinel-store.tsx, sentinel-reducer.ts
  db/                           schema.ts, index.ts, seed.ts
  ai/                           ai-router.ts, ai-provider.ts, providers/
  agents/                       run-agent, load-agent, build-prompt, parse-response
  server/                       terminal-runner, action-resolver, action-executor
  terminal/                     use-terminal.ts (hook cliente)
  console/                      command-parser, command-executor, generators

types/                          card, comment, enums, event, project, timer, agent
agents/                         definitions/ (YAML), prompts/ (MD), skills/
```

---

## Estado del Proyecto

### Implementado

- [x] Kanban 9 columnas con drag & drop
- [x] Command Dock (crear, mover, foco, tiempo)
- [x] Analisis con agente planner (Ollama/OpenRouter/Anthropic)
- [x] Fallback heuristico completo (sin IA)
- [x] Panel derecho: Codex Loop + Codigo del Dinero
- [x] Comentarios por card (4 tipos)
- [x] Eliminar cards (board + panel derecho)
- [x] Edicion generica de cards (UPDATE_CARD)
- [x] HEO Copilot: terminal con acciones reales
- [x] MOVE_CARD tolerante a lenguaje natural
- [x] Auto-refresh del board tras acciones de terminal
- [x] Persistencia real SQLite + Drizzle
- [x] API CRUD completa (GET, POST, PATCH, DELETE)
- [x] Hidratacion del board desde BD
- [x] Timeline con eventos clickeables
- [x] Backlog inteligente con scoring
- [x] Filtro por proyecto en sidebar
- [x] Temporizador de foco
- [x] Toast contextual
- [x] Timestamps en cards

### Roadmap

- [ ] Streaming de respuestas en la terminal (SSE)
- [ ] Multi-agente activo (qa-reviewer, state-guardian)
- [ ] Edicion inline de cards en el panel derecho
- [ ] Sorting dentro de columnas (drag intra-columna)
- [ ] Touch support para drag & drop
- [ ] PWA / modo offline completo
- [ ] Ingesta real de amon-agents via pipeline DB
- [ ] Tests (Vitest + Playwright)

---

## Variables de Entorno

Copiar `.env.example` a `.env.local`. Todos los valores son opcionales:

```bash
# Ollama (primario -- funciona si Ollama corre local)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen3:8b

# OpenRouter (secundario -- requiere API key)
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=qwen/qwen3-8b:free

# Anthropic (terciario -- requiere API key)
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-haiku-4-5-20251001
```

---

## Contribuir

Ver [CONTRIBUTING.md](CONTRIBUTING.md).

## Licencia

MIT

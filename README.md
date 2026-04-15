# Sentinel Board

Consola visual de operaciones para AMON Engineering OS.

No es solo un Kanban — es una interfaz orientada a ejecucion donde ideas se convierten en trabajo estructurado, analizado y accionable.

---

## Quick Start (30 segundos)

```bash
git clone https://github.com/tu-usuario/sentinel-board.git
cd sentinel-board
npm install
npm run db:push && npm run db:seed
npm run dev
```

Abrir [http://localhost:3000/board](http://localhost:3000/board) — **funciona sin IA**.

### Opciones de IA

| Opcion | Costo | Setup |
|--------|-------|-------|
| **Sin IA** | $0 | Nada — fallback heurístico analiza texto localmente |
| **Ollama** | $0 | `ollama pull qwen3:8b` y listo |
| **OpenRouter** | Free tier / ~$0.001 | Crear cuenta → copiar API key → `.env.local` |
| **Anthropic** | ~$0.001/análisis | Crear cuenta → copiar API key → `.env.local` |

### Que funciona con cada opcion

| Feature | Sin IA | Ollama | OpenRouter | Anthropic |
|---------|--------|--------|------------|-----------|
| Board kanban completo | ✅ | ✅ | ✅ | ✅ |
| Drag & drop | ✅ | ✅ | ✅ | ✅ |
| Command Dock | ✅ | ✅ | ✅ | ✅ |
| Timeline | ✅ | ✅ | ✅ | ✅ |
| Backlog inteligente (scoring) | ✅ | ✅ | ✅ | ✅ |
| Análisis heurístico | ✅ | ✅ | ✅ | ✅ |
| Análisis con agente IA | ❌ | ✅ | ✅ | ✅ |
| Backlog analyzer (IA) | ❌ | ✅ | ✅ | ✅ |

**TL;DR**: El board es 100% funcional offline. La IA es opcional y mejora el análisis de texto.

---

## Que hace

- **Board kanban** con 9 estados (idea bruta → produccion → archivado)
- **Drag & drop** real entre columnas con `@dnd-kit/core`
- **Command Dock** — consola inferior con dos modos:
  - **Comando**: crear tareas, mover cards, iniciar foco, registrar tiempo
  - **Analizar**: pegar texto libre → analisis estructurado con agente IA
- **Panel derecho** — Codex Loop, Codigo del Dinero, siguiente accion sugerida
- **Timeline** — registro cronologico de toda accion ejecutada
- **Backlog** — vista filtrada de ideas brutas y tareas bloqueadas
- **Proyectos** — filtro lateral que segmenta board, timeline y panel
- **Toast contextual** — feedback visual al copiar informes y comandos
- **Foco** — temporizador integrado con registro automatico

## Stack

| Capa | Tecnologia |
|------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Lenguaje | TypeScript strict |
| Persistencia | SQLite + Drizzle ORM (local-first) |
| Estilos | Tailwind CSS 4 + CSS custom properties |
| Componentes | shadcn/ui + Radix primitives |
| Drag & drop | @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities |
| IA | Ollama → OpenRouter → Anthropic → fallback heurístico (100% offline) |
| Estado | React Context + useReducer (UI local) — DB como fuente de verdad |

## Arquitectura de agentes

```
lib/ai/ai-router.ts          → Router: Ollama → OpenRouter → Anthropic → heuristic
lib/agents/run-agent.ts       → Orquestador: carga agente → prompt → routeAI
lib/agents/load-agent.ts      → Registry de agentes (planner, frontend-builder, etc.)
lib/agents/build-agent-prompt.ts → Construye system + user prompt con schema
lib/agents/parse-planner-response.ts → Safe JSON parser + normalizador
app/api/agents/run/route.ts   → POST endpoint: { agent, input } → resultado
```

### Flujo de analisis

```
[Usuario escribe texto] → click Analizar
       ↓
POST /api/agents/run { agent: "planner", input: { task, context, constraints } }
       ↓
ai-router: Ollama → OpenRouter → Anthropic → error
       ↓
Si OK → parsear JSON → normalizar → mostrar resultado real
Si falla → fallback heuristico local (sin red)
       ↓
AnalysisPreview: resumen, tareas, riesgos, codex loop
       ↓
Acciones: crear tarjetas en board, copiar informe
```

### Contrato del planner

```json
{
  "summary": "string",
  "objective": "string",
  "hypothesis": "string",
  "risks": ["string"],
  "next_steps": ["string"],
  "backlog_tasks": ["string"],
  "codex_loop": {
    "problem": "string",
    "objective": "string",
    "hypothesis": "string",
    "solution": "string",
    "validation": "string",
    "next_step": "string"
  }
}
```

## Variables de entorno

```bash
# .env.local

# Ollama (primario — defaults funcionan si Ollama corre local)
OLLAMA_BASE_URL=http://localhost:11434   # opcional
OLLAMA_MODEL=qwen3:8b                    # o cualquier modelo instalado

# OpenRouter (secundario — solo si OPENROUTER_API_KEY esta definida)
OPENROUTER_API_KEY=sk-or-...             # https://openrouter.ai/keys
OPENROUTER_MODEL=qwen/qwen3-8b:free      # opcional, free tier disponible

# Anthropic (terciario — solo si ANTHROPIC_API_KEY esta definida)
ANTHROPIC_API_KEY=sk-ant-...             # https://console.anthropic.com/
ANTHROPIC_MODEL=claude-haiku-4-5-20251001  # ~$0.001 por análisis
```

**Prioridad del router**: Ollama → OpenRouter → Anthropic → Fallback heurístico

## Setup

```bash
# Clonar
git clone https://github.com/tu-usuario/sentinel-board.git
cd sentinel-board

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env.local  # o crear manualmente

# Crear tablas y poblar la DB con datos iniciales
npm run db:push
npm run db:seed

# (Opcional) Tener Ollama corriendo con un modelo para IA
ollama pull qwen2.5-coder:7b

# Iniciar servidor de desarrollo
npm run dev
```

Abrir [https://localhost:3000/board](https://localhost:3000/board)

## Persistencia (SQLite + Drizzle)

La DB vive en `data/sentinel.db` (SQLite, gitignored).

### Scripts disponibles

| Script | Que hace |
|--------|----------|
| `npm run db:push` | Crea/actualiza tablas segun el schema (`lib/db/schema.ts`) |
| `npm run db:seed` | Puebla la DB con los datos mock iniciales |
| `npm run db:studio` | Abre Drizzle Studio para inspeccionar la DB |

### Schema (6 tablas)

| Tabla | Descripcion |
|-------|------------|
| `projects` | Proyectos del board |
| `tasks` | Cards/tareas con JSON para tags, codexLoop, fiveWhys, moneyCode |
| `task_checklist_items` | Items de checklist por tarea (FK → tasks) |
| `events` | Timeline de eventos |
| `dock_commands` | Registro de comandos del dock |
| `focus_sessions` | Sesiones de foco |

### Flujo de datos

```
[Browser] → dispatch(CREATE_CARD) → reducer (UI local) + POST /api/tasks (DB)
[Browser] → dispatch(MOVE_CARD)   → reducer (UI local) + PATCH /api/tasks/:id (DB)
[Mount]   → fetch /api/tasks + /api/projects + /api/events → HYDRATE reducer
[Fallback] → si DB vacia o error → mocks como antes
```

### API endpoints

| Metodo | Ruta | Descripcion |
|--------|------|------------|
| GET | `/api/tasks` | Lista tareas con checklist desde DB |
| POST | `/api/tasks` | Crea tarea + evento |
| PATCH | `/api/tasks/:id` | Actualiza status, titulo, prioridad, etc. |
| DELETE | `/api/tasks/:id` | Elimina tarea + evento |
| GET | `/api/projects` | Lista proyectos |
| GET | `/api/events` | Lista eventos del timeline |
| POST | `/api/events` | Registra evento |
| GET/POST | `/api/dock-commands` | Registro de comandos del dock |
| GET/POST | `/api/focus-sessions` | Sesiones de foco |
| POST | `/api/agents/run` | Ejecuta agente IA |

## Estructura del proyecto

```
app/
  (dashboard)/
    layout.tsx              → Shell: sidebar + topbar + panel + dock
    page.tsx                → Redirect a /board
    board/page.tsx          → Vista principal del board
  api/tasks/route.ts        → GET + POST tareas (DB)
  api/tasks/[id]/route.ts   → PATCH tarea
  api/projects/route.ts     → GET proyectos (DB)
  api/events/route.ts       → GET + POST eventos (DB)
  api/agents/run/route.ts   → Endpoint de agentes

components/
  board/
    board-view.tsx          → DndContext + kanban + timeline + backlog
    column.tsx              → Columna droppable
    card-item.tsx           → Card draggable
  console/
    command-dock.tsx         → Dock: comando + analizar + acciones rapidas
    command-input.tsx        → Input con sugerencias y feedback en vivo
    command-log.tsx          → Registro de eventos del dock
    command-suggestions.tsx  → Sugerencias HEO
    focus-timer.tsx          → Temporizador de foco
    quick-actions.tsx        → Botones rapidos
  layout/
    app-sidebar.tsx          → Sidebar con proyectos
    topbar.tsx               → Barra superior con vistas
    right-panel.tsx          → Detalle: codex loop, money code, acciones
  modals/
    create-task-modal.tsx    → Modal crear tarea
    move-state-modal.tsx     → Modal mover estado
  ui/
    toast.tsx                → Sistema de toast contextual (sin librerias)
    button.tsx, card.tsx...  → shadcn/ui primitives

lib/
  db/
    schema.ts               → Schema Drizzle (6 tablas)
    index.ts                → Conexion SQLite singleton
    seed.ts                 → Script de seed desde mocks
  ai/
    ai-router.ts            → Router Ollama → OpenRouter → fallback
  agents/
    run-agent.ts             → Orquestador de agentes
    load-agent.ts            → Definiciones de agentes
    build-agent-prompt.ts    → Constructor de prompts
    parse-planner-response.ts → Parser seguro de JSON
  state/
    sentinel-store.tsx       → Provider + hooks + persistencia automatica
    sentinel-reducer.ts      → Reducer: HYDRATE, MOVE_CARD, CREATE_CARD, etc.
  console/
    command-parser.ts        → Parser de comandos del dock
    command-executor.ts      → Ejecutor de comandos
    local-analysis.ts        → Analisis heuristico (fallback sin IA)
    codex-loop-generator.ts  → Generador de Codex Loop
    money-code-generator.ts  → Generador de Codigo del Dinero

agents/
  definitions/               → YAML de definicion de agentes
  prompts/                   → Prompts base en markdown
  skills/                    → Skills por agente

types/
  card.ts, enums.ts, event.ts, project.ts, timer.ts, agent.ts
```

## Fase actual

**MVP funcional** — board operativo con:

- [x] Kanban 9 columnas con drag & drop real
- [x] Command Dock con parser de comandos en lenguaje natural
- [x] Analisis con agente planner (Ollama local)
- [x] Fallback heuristico cuando no hay IA disponible
- [x] Panel derecho con Codex Loop + Codigo del Dinero
- [x] Timeline con eventos clickeables
- [x] Sistema de toast contextual (copiar informe/comando)
- [x] Filtro por proyecto en sidebar
- [x] Temporizador de foco integrado

### Completado recientemente

- [x] Persistencia real con SQLite + Drizzle
- [x] API CRUD para tasks (GET, POST, PATCH)
- [x] Hydration del board desde DB al iniciar
- [x] Mover/crear cards persiste en DB

### Pendiente — Etapa 2

- [ ] Ingesta real de amon-agents (pipeline DB, no filesystem)
- [ ] Multiples agentes activos (qa-reviewer, state-guardian)
- [ ] Edicion completa de cards (checklist, codexLoop, moneyCode via API)
- [ ] Sorting dentro de columnas (drag intra-columna)
- [ ] Touch support para drag & drop
- [ ] Modo offline completo (PWA)

## Licencia

MIT

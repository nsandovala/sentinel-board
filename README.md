# Sentinel Board

Consola visual de operaciones para AMON Engineering OS.

No es solo un Kanban — es una interfaz orientada a ejecucion donde ideas se convierten en trabajo estructurado, analizado y accionable.

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
| Estilos | Tailwind CSS 4 + CSS custom properties |
| Componentes | shadcn/ui + Radix primitives |
| Drag & drop | @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities |
| IA local | Ollama (primario) → OpenRouter (secundario) → heuristico (fallback) |
| Estado | React Context + useReducer (fuente de verdad unica) |

## Arquitectura de agentes

```
lib/ai/ai-router.ts          → Router: Ollama → OpenRouter → heuristic
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
ai-router: Ollama (local) → OpenRouter (si hay key) → error
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
OLLAMA_MODEL=qwen2.5-coder:7b           # o cualquier modelo instalado

# OpenRouter (secundario — solo si quieres fallback en la nube)
OPENROUTER_API_KEY=sk-or-...             # si no esta, se salta
OPENROUTER_MODEL=qwen/qwen3-8b:free     # opcional
```

## Setup

```bash
# Clonar
git clone https://github.com/tu-usuario/sentinel-board.git
cd sentinel-board

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env.local  # o crear manualmente

# Tener Ollama corriendo con un modelo
ollama pull qwen2.5-coder:7b

# Iniciar servidor de desarrollo
npm run dev
```

Abrir [https://localhost:3000/board](https://localhost:3000/board)

## Estructura del proyecto

```
app/
  (dashboard)/
    layout.tsx              → Shell: sidebar + topbar + panel + dock
    page.tsx                → Redirect a /board
    board/page.tsx          → Vista principal del board
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
  ai/
    ai-router.ts            → Router Ollama → OpenRouter → fallback
  agents/
    run-agent.ts             → Orquestador de agentes
    load-agent.ts            → Definiciones de agentes
    build-agent-prompt.ts    → Constructor de prompts
    parse-planner-response.ts → Parser seguro de JSON
  state/
    sentinel-store.tsx       → Provider + hooks (useSentinel, useSentinelDispatch)
    sentinel-reducer.ts      → Reducer: MOVE_CARD, CREATE_CARD, SELECT_CARD, etc.
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

### Pendiente

- [ ] Persistencia real (hoy es estado en memoria)
- [ ] Multiples agentes activos (qa-reviewer, state-guardian)
- [ ] Sorting dentro de columnas (drag intra-columna)
- [ ] Touch support para drag & drop
- [ ] Modo offline completo

## Licencia

MIT

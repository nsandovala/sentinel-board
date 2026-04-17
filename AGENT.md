# Sentinel Board -- Contrato de Arquitectura para Agentes

Este archivo es el contrato de arquitectura para cualquier agente (humano o IA) que asista en el desarrollo de Sentinel Board. Define las reglas de interaccion, componentes reales, y protocolos vigentes.

---

## I. Vision General

**Sentinel Board** es un workspace vivo de gestion de proyectos con ejecucion integrada. No es un kanban pasivo: las ideas entran como texto libre, se estructuran via analisis (IA o heuristico), se convierten en cards accionables, y se operan desde una terminal con acciones reales sobre la base de datos.

### Principios

1. **Local-first**: SQLite como fuente de verdad. El board funciona sin red.
2. **IA opcional**: Ollama, OpenRouter y Anthropic son capas de enriquecimiento. El sistema completo funciona sin ningun provider.
3. **Desacoplamiento**: Terminal, Board, Dock y Panel Derecho no se conocen entre si. Se comunican via estado global (Context + Reducer) y la BD.
4. **Acciones antes que conversacion**: La terminal ejecuta, no chatea. Si un comando se puede resolver localmente, no se envia al LLM.

---

## II. Arquitectura Real

### Estado Global

| Capa | Archivo | Mecanismo |
|------|---------|-----------|
| Provider | `lib/state/sentinel-store.tsx` | React Context + `useReducer` |
| Reducer | `lib/state/sentinel-reducer.ts` | Switch sobre `SentinelAction` union type |
| Hooks | `useSentinel()`, `useSentinelDispatch()`, `useSentinelRefresh()` | Lectura, mutacion, re-hidratacion |

### Acciones del Reducer

```
SELECT_CARD | SELECT_PROJECT | SET_VIEW
MOVE_CARD | CREATE_CARD | DELETE_CARD | UPDATE_CARD
LOAD_AGENT_CARDS | HYDRATE
ADD_EVENT | SET_CARD_COMMENTS | ADD_COMMENT
START_FOCUS | END_FOCUS | TICK_FOCUS
```

### Persistencia

Side-effects en el dispatch del Provider:
- `MOVE_CARD` -> `PATCH /api/tasks/:id`
- `CREATE_CARD` -> `POST /api/tasks`
- `DELETE_CARD` -> `DELETE /api/tasks/:id`
- `UPDATE_CARD` -> `PATCH /api/tasks/:id`
- `ADD_COMMENT` -> `POST /api/tasks/:id/comments`
- `SELECT_CARD` -> `GET /api/tasks/:id/comments` (carga on-demand)

Hidratacion al montar: `GET /api/tasks` + `/api/projects` + `/api/events` -> `HYDRATE`.

### Terminal (HEO Copilot)

```
Input del usuario
  -> lib/server/action-resolver.ts   (pattern matching local)
    -> si matchea -> action-executor.ts (lee/escribe BD directamente)
    -> si no      -> ai-router.ts      (Ollama -> OpenRouter -> Anthropic -> error)
  -> respuesta con outputType: "action" | "json" | "text"
  -> hint "refresh_board" -> useSentinelRefresh() re-hidrata el board
```

Acciones locales implementadas:
- `GET_TIME` -- hora del sistema
- `GET_TOP_PRIORITY` -- lee cards reales de la BD, ordena por prioridad
- `MOVE_CARD` -- actualiza status en BD, registra evento, refresca board

### AI Router

```
lib/ai/ai-router.ts
  -> Ollama (local, gratis)
  -> OpenRouter (nube, free tier disponible)
  -> Anthropic (nube, ~$0.001/request)
  -> Error (el caller activa fallback heuristico)
```

No crear providers nuevos. No duplicar logica del router. No meter IA en el frontend.

---

## III. Esquema de Datos (SQLite + Drizzle)

| Tabla | Campos clave | FK |
|-------|-------------|-----|
| `projects` | id, name, slug, status, color | -- |
| `tasks` | id, title, status, type, priority, tags (JSON), projectId, codexLoop (JSON), fiveWhys (JSON), moneyCode (JSON), blocked, createdAt | -> projects |
| `task_checklist_items` | id, taskId, text, status, sortOrder | -> tasks (cascade) |
| `card_comments` | id, cardId, author, body, type (comment/decision/system/agent), createdAt | -> tasks (cascade) |
| `events` | id, type (command/system/heo_suggestion/focus), message, createdAt | -- |
| `dock_commands` | id, action, target, raw, success, resultMessage | -- |
| `focus_sessions` | id, project, state, startedAt, endedAt, elapsedSeconds | -- |

---

## IV. Protocolos para Agentes

### Antes de modificar cualquier archivo

1. Verificar que el build pasa: `npx next build`
2. No tocar `lib/ai/ai-router.ts` salvo que sea imprescindible
3. No crear stores nuevos -- usar `useSentinel()` / `useSentinelDispatch()`
4. No mover logica de IA al frontend
5. No romper drag & drop (cuidado con `stopPropagation` en card-item)

### Para agregar una accion local en la terminal

1. Agregar pattern en `lib/server/action-resolver.ts`
2. Agregar handler en `lib/server/action-executor.ts`
3. Si modifica la BD, devolver `hint: "refresh_board"` para que el board se sincronice

### Para agregar una API route

1. Crear en `app/api/...`
2. Usar `db` de `lib/db` (singleton Drizzle)
3. Registrar evento en tabla `events` si la accion es relevante para el timeline

### Para modificar el estado global

1. Agregar la accion al union type `SentinelAction` en `sentinel-reducer.ts`
2. Agregar el case en el switch del reducer
3. Si necesita persistencia, agregar side-effect en `sentinel-store.tsx`

---

## V. Estructura de Directorios

```
app/
  (dashboard)/layout.tsx          Shell: sidebar + topbar + terminal + dock
  board/page.tsx                  Vista principal
  api/tasks/                      CRUD de tareas
  api/tasks/[id]/comments/        Comentarios por card
  api/terminal/run/               Endpoint de la terminal
  api/agents/run/                 Endpoint de agentes IA

components/
  board/                          Kanban: board-view, column, card-item
  console/                        Dock: command-dock, input, log, suggestions
  terminal/                       HEO Copilot: terminal-panel (xterm.js)
  layout/                         Sidebar, topbar, right-panel
  modals/                         Crear tarea, mover estado
  ui/                             shadcn primitives

lib/
  state/                          Reducer + Context + Provider
  db/                             Schema Drizzle + conexion SQLite
  ai/                             Router de providers IA
  agents/                         Definiciones + ejecucion de agentes
  server/                         Terminal runner + action resolver/executor
  terminal/                       Hook useTerminal (cliente)
  console/                        Parser, executor, generadores heuristicos

types/                            card, comment, enums, event, project, timer, agent
agents/                           Definiciones YAML, prompts MD, skills
```

---

## VI. Checklist de Validacion

Antes de entregar cualquier cambio:

- [ ] `npx next build` pasa sin errores
- [ ] Board: drag & drop funciona
- [ ] Dock: COMANDO y ANALIZAR funcionan
- [ ] Terminal: acciones locales devuelven [ACTION]
- [ ] Terminal: comandos no reconocidos caen al LLM y devuelven [TEXT] o [JSON]
- [ ] Panel derecho: seleccionar card muestra detalle + comentarios
- [ ] Timeline: eventos se registran
- [ ] No se crearon stores duplicados
- [ ] No se movio logica de IA al frontend

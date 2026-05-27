# AGENT.md — Operational rules for Sentinel Board

Contrato vigente para cualquier agente (humano o IA) que modifique este repo.
Es **descriptivo de lo que el código hace hoy**, no aspiracional. Cuando el
código y este documento divergen, gana el código y este archivo se actualiza
en el mismo PR.

> Lectura previa obligatoria antes de tocar arquitectura:
> [`docs/ROADMAP.md`](docs/ROADMAP.md) (fases y orden de prioridades) y
> [`docs/OPERATIONAL_COCKPIT.md`](docs/OPERATIONAL_COCKPIT.md) (UX del dock).
> Bitácora detallada por fase: [`docs/PHASE_LOG.md`](docs/PHASE_LOG.md).

---

## I. Source of truth

| Capa | Source of truth |
|---|---|
| Estado del board / cards / comentarios / timeline / focus / knowledge | **PostgreSQL (Neon)** vía Drizzle |
| Eventos del runtime de agentes | **Archivo NDJSON** que emite AMON Agents (`AMON_EVENTS_PATH`) |
| Configuración runtime | `.env.local` (no commitear) |
| Modelos IA válidos | `lib/ai/models.ts` |
| Contratos de payload | `lib/validation/tasks.ts` (Zod) |
| Schema DB | `lib/db/schema.ts` |

Reglas derivadas:

- **Postgres es la verdad para SB.** Cualquier estado UI que sobreviva un
  refresh tiene que estar respaldado por una tabla. Nada de estados visibles
  que solo viven en React.
- **NDJSON es la verdad para el runtime de AA.** SB no inventa estado de
  agentes — si el archivo no existe, el modo Runtime lo declara como
  "pendiente" en vez de fingir actividad.
- **AA no comparte DB con SB.** AA es runtime externo, sin DB propia,
  con su propio outputs/. SB observa por NDJSON; en Fase 6 SB podrá
  emitir trabajo hacia AA por contrato explícito.

---

## II. Component boundaries

| Componente | Rol | NO debe |
|---|---|---|
| **Board** | Mostrar y mutar cards por status/project | tener filtros locales que el backend ya soporta; sortear o filtrar en memoria lo que SQL puede hacer |
| **Timeline** | Historia operacional persistente | duplicarse en otros paneles; convertirse en un log mutable |
| **Detail Panel** | Contexto y comentarios de UNA card seleccionada | romper la regla single-card (no multi-select) |
| **HEO Copilot Dock** | Única superficie operacional (Execute/Analyze/Focus/Runtime) | acumular log propio (el Timeline existe), fingir streaming, mostrar estado runtime sin evidencia real, coexistir con otra terminal paralela |
| **AI Router** | Cascada Ollama → OpenRouter → Anthropic → heurístico | hacer fetch sin validar modelo, ejecutarse desde el cliente |
| **AMON Agents** | Runtime externo de agentes | invocarse desde SB en esta fase (solo Fase 6 en adelante) |

---

## III. Estado global UI

| Capa | Archivo | Mecanismo |
|---|---|---|
| Provider | `lib/state/sentinel-store.tsx` | React Context + `useReducer` |
| Reducer | `lib/state/sentinel-reducer.ts` | switch sobre `SentinelAction` |
| Hooks | `useSentinel()` / `useSentinelDispatch()` / `useSentinelRefresh()` | leer / mutar / re-hidratar |

Acciones (no exhaustivo):

```
SELECT_CARD | SELECT_PROJECT | SET_VIEW
HYDRATE | LOAD_AGENT_CARDS
CREATE_CARD | UPDATE_CARD | DELETE_CARD | MOVE_CARD
ADD_EVENT | SET_CARD_COMMENTS | ADD_COMMENT
START_FOCUS | PAUSE_FOCUS | RESUME_FOCUS | END_FOCUS | TICK_FOCUS
```

### Persistencia: dispatch → API → resync en error

```
dispatch(MOVE_CARD)     → PATCH  /api/tasks/:id
dispatch(CREATE_CARD)   → POST   /api/tasks
dispatch(UPDATE_CARD)   → PATCH  /api/tasks/:id
dispatch(DELETE_CARD)   → DELETE /api/tasks/:id
dispatch(ADD_COMMENT)   → POST   /api/tasks/:id/comments
dispatch(SELECT_CARD)   → GET    /api/tasks/:id/comments  (lazy)
dispatch(START_FOCUS)   → POST   /api/focus-sessions {action:"start"}
dispatch(END_FOCUS)     → POST   /api/focus-sessions {action:"end"}
```

**Regla:** ninguna persistencia es silenciosa. Cada `persist*` retorna
`Promise<void>` y, ante fallo, el provider invoca `refreshRef.current()`
para rehidratar desde Postgres. Esto evita el patrón "optimistic-sin-rollback"
que dejaba el cliente divergido del servidor.

Hidratación al montar y al cambiar filtros:

```
GET /api/tasks?<filtros>  → HYDRATE.cards
GET /api/projects         → HYDRATE.projects
GET /api/events           → HYDRATE.events
GET /api/knowledge?<...>  → HYDRATE.knowledgeEntries
```

---

## IV. Backend rules

### Endpoints validan body con Zod

Schemas en `lib/validation/tasks.ts`. Endpoints de mutación deben:

1. `await req.json()` envuelto en try/catch — body inválido → **400**.
2. `schema.parse(body)` — esquema Zod estricto, errores devuelven 400 con
   detalle (`flattenZodIssues`).
3. Verificar existencia del recurso → **404** si no existe.
4. Operar y devolver shape consistente:
   - PATCH → `{ ok: true, task }`
   - DELETE → `{ ok: true, deletedId }`
   - POST comment → `{ ok: true, comment }`
5. Capturar errores internos → **500 genérico** (`"Internal error"`).
   Detalle real va a `console.error`, **no** al cliente.

### Filtros se aplican en SQL

`GET /api/tasks` empuja todo a la DB:

- `q` → `ILIKE` con escape de `% _ \`
- `projectId / status / priority / type / blocked` → `eq()`
- `tag` → `tags @> '["…"]'::jsonb`
- `limit` (1..200) / `offset` (≥0)
- Orden: `updatedAt DESC, createdAt DESC`

No cargar la tabla entera para filtrar en JS. Si necesitas un filtro nuevo
y SQL no lo soporta limpio, documenta la limitación en el endpoint.

### Card assembly compartido

`lib/server/assemble-card.ts` provee `assembleCard()` y `loadCardById()`.
Cualquier respuesta que devuelva una `SentinelCard` (POST/PATCH/GET tasks)
debe usar estos helpers — nada de mappers duplicados.

### IDs de comentario

`crypto.randomUUID()` server-side. No aceptar `id` cliente sin validar
formato y unicidad; preferir generar siempre y devolver el id final al
cliente.

### Auth

`lib/server/request-guard.ts → rejectIfUnauthorized(req)` se aplica a
endpoints de escritura: loopback siempre permitido, externo requiere
`SENTINEL_API_TOKEN` por header. **No** retirar el guard "porque molesta
en dev"; ajustar la config local.

---

## V. AI Router rules

Archivo: `lib/ai/ai-router.ts`. Source of truth de modelos: `lib/ai/models.ts`.

Cascada:

```
Ollama (local, gratis)
  → OpenRouter (free tier)
    → Anthropic (~$0.001/req)
      → heurístico (fallback determinista)
```

Reglas:

1. **No hacer fetch sin validar modelo.** Cada `call*()` invoca
   `validateModel(provider, model)` antes del HTTP. Modelo inválido →
   `{ ok:false, error:"Invalid <provider> model configured: ..." }` y
   warning `[ai-router] ...` (deduplicado por proceso).
2. **No marcar provider como healthy si el modelo es inválido.**
   `describeProviders()` retorna `available: configured && modelValid`.
3. **No agregar providers nuevos sin extender `models.ts`.** Cada provider
   nuevo necesita su validador (allowlist o pattern).
4. **No mover IA al cliente.** El router corre server-side; el frontend
   solo ve `/api/agents/run` y resultados.
5. **No tocar `lib/ai/ai-router.ts`** salvo para extender de forma
   estrictamente aditiva (nuevo provider, nuevo validador, status helper).
   Retries/backoff/streaming pertenecen a fases posteriores.

---

## VI. Runtime / AMON Agents rules

Endpoint: `GET /api/runtime/events` (Fase 4).

- Lee NDJSON desde `AMON_EVENTS_PATH`. Fallback: `../amon-agents/outputs/events.jsonl`.
- Tail eficiente (≤512 KB del final), descarta la primera línea parcial,
  parsea de atrás hacia adelante.
- `?limit=1..200` (default 100), validado en server.
- Líneas inválidas se descartan, no rompen la respuesta.
- Respuesta: `{ ok, source:"ndjson", exists, events, agents }`.
- Si el archivo no existe → `exists:false`, **no** 500.
- Errores reales → 500 con mensaje genérico (`basename` o `"configured path"`,
  **nunca** la ruta absoluta).

Modo Runtime del dock:

- Polling cada 3000 ms con `AbortController` (cancela en unmount y en cada
  ciclo).
- Estado por agente derivado de:
  - `agent.started → running`
  - `agent.done → success`
  - `agent.error → error`
  - sin evento → `idle`
- Badge "Event Stream conectado" si `exists=true`; "pendiente" si no.

**Prohibido:**

- Fingir actividad de agentes cuando no hay archivo.
- Inventar timestamps (`Date.now()` no es el `ts` del evento).
- Persistir eventos del runtime en Postgres (son log volátil de AA).
- Ejecutar agentes desde SB en esta fase.
- Migrar a WebSocket/SSE sin pasar por el contrato de Fase 5.

---

## VII. Schema de datos (Postgres + Drizzle)

10 tablas en `lib/db/schema.ts`:

| Tabla | Notas |
|---|---|
| `projects` | id, name, slug (unique), status (active/paused/archived) |
| `tasks` | id, title, status, type, priority, tags (jsonb), projectId (FK), blocked, codexLoop/fiveWhys/moneyCode (jsonb), createdAt, updatedAt |
| `task_checklist_items` | FK → tasks (cascade), sortOrder |
| `card_comments` | FK → tasks (cascade), type ∈ comment/decision/system/agent |
| `events` | type ∈ command/system/heo_suggestion/focus |
| `dock_commands` | telemetría del dock (action, target, raw, success) |
| `focus_sessions` | state ∈ idle/running/paused/ended |
| `knowledge_entries` | category ∈ report/decision/runbook/note/postmortem |
| `suggestion_feedback` | decision ∈ accepted/rejected/ignored |
| `system_insights` | severity, status open/dismissed/resolved |

Migraciones:

```bash
npm run db:generate   # genera SQL en drizzle/
npm run db:migrate    # aplica en Neon/Render
npm run db:push       # dev rápido (no genera SQL)
```

**Regla:** no romper FKs con cascade. Borrar una task borra sus checklist
items y comments automáticamente — apoyarse en eso, no duplicar lógica de
limpieza en el endpoint.

---

## VIII. Anti-patterns prohibidos

- ❌ **Backend hallucinations** — frontend que asume un endpoint que no existe
  o un campo que el server no devuelve.
- ❌ **Optimistic persistence silenciosa** — `.catch(() => {})` que esconde
  errores y diverge UI de DB.
- ❌ **Fake streaming** — UI que sugiere conexión live cuando es polling, o
  badges de "conectado" sin verificación.
- ❌ **Fake runtime** — agentes con timestamps inventados o estados que
  cambian solos en un `setInterval` mock.
- ❌ **Stores duplicados** — todo estado UI pasa por `SentinelProvider`.
- ❌ **IA en el cliente** — providers, prompts y router corren server-side.
- ❌ **Filtros en memoria cuando SQL puede** — degrada cuando hay volumen.
- ❌ **Mocks ocultos en producción** — si algo es mock, declararlo en la UI
  (Runtime "pendiente" es ejemplo del patrón correcto).
- ❌ **Modelos IA inventados o legacy en `.env`** — `validateModel()` los
  rechaza; ajustar `models.ts` si un modelo real fue omitido.

---

## IX. Protocolos para agregar funcionalidad

### Nueva API route

1. `app/api/<recurso>/route.ts` con `export const dynamic = "force-dynamic"`.
2. Body con Zod (`lib/validation/...`). Query string también con Zod cuando
   haya filtros.
3. Errores: 400 / 404 / 500 — nunca leak de stack ni de path absoluto.
4. Mutación → registrar evento en `events` si es relevante para el Timeline.
5. Si afecta sincronización entre tabs/clientes → emitir en `syncBus`.

### Nueva acción en el dock

1. Si es determinista local → extender `lib/console/command-parser.ts` +
   `command-executor.ts`.
2. Si requiere LLM → enviarlo por `/api/agents/run`, no por el cliente.
3. Si necesita ejecutarse en un agente AA → **esperar Fase 6**. Por ahora
   solo lectura del NDJSON.
4. Resultado emite a Timeline vía `ADD_EVENT`. El dock solo guarda el último
   `lastResultMessage` para el status badge.

### Nueva acción del reducer

1. Extender union `SentinelAction` en `sentinel-reducer.ts`.
2. Agregar `case` puro en el switch (no efectos en el reducer).
3. Side-effect de persistencia → en el wrapper de dispatch en
   `sentinel-store.tsx`, con `.catch(resyncOnFailure)`.

### Nuevo provider IA

1. Agregar al enum `ProviderName` y validador en `lib/ai/models.ts`.
2. Implementar `call<Provider>()` en `ai-router.ts` siguiendo el patrón:
   validar modelo → fetch → extraer texto → devolver `AIRouterResult`.
3. Registrar en `providers[]` con `available()` y `describe()` honestos.

### Nuevo tipo de evento NDJSON

1. Decidir si afecta estado por agente o si es general (`run.started`, etc.).
2. Si afecta estado → mapear en `deriveAgentState()` de
   `app/api/runtime/events/route.ts`.
3. Si es general → ya queda normalizado en `events[]`; documentar en
   `OPERATIONAL_COCKPIT.md` si se renderizará en UI.

---

## X. Checklist de validación pre-PR

Antes de pedir review:

- [ ] `npx tsc --noEmit` pasa
- [ ] `npm run build` pasa con todas las rutas registradas
- [ ] Endpoints nuevos validan body con Zod y manejan 400/404/500
- [ ] No hay `.catch(() => {})` silencioso nuevo
- [ ] No hay filtros en memoria sustituibles por SQL
- [ ] No hay timestamps/estados runtime inventados en UI
- [ ] No hay providers IA llamando fetch sin `validateModel()`
- [ ] Drag & drop sigue funcionando (cuidado con `stopPropagation` en
      `card-item.tsx`)
- [ ] Cambios de schema: `db:generate` + `db:migrate` corridos contra Neon
      en dev y documentados
- [ ] Si tocaste fases listadas en `docs/ROADMAP.md` o
      `docs/PHASE_LOG.md`, actualizá la entrada correspondiente en el mismo
      PR

---

## XI. Gaps documentales conocidos

Pendientes de documentar formalmente (no bloquean PRs, pero el primero que
los toque debería actualizarlos):

- Contrato `RuntimeEvent` formal (Fase 5) — falta `docs/projects/amon-agents/event-contract.md`.
- Cómo correr AMON Agents en local emitiendo a `events.jsonl` — README de AA fuera del scope de este repo, pero un quickstart de pareja sería útil.
- Catálogo de eventos generales (`run.started`, `run.done`, `sb.push.done`) y dónde renderizarlos en UI cuando se decida.
- Tests automatizados (Vitest + Playwright) — Fase aún no asignada.

Cuando algo de esta lista se cierre, mover a `PHASE_LOG.md` con cierre y
borrar de aquí.

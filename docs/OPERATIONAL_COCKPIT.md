# Operational Cockpit — HEO Copilot

> Documento de arquitectura UX y conceptual del dock inferior de Sentinel Board.
> Estado: vigente al cierre de Fase 4 (2026-05).

## 1. ¿Qué es HEO Copilot?

**HEO Copilot** es la capa operacional viva de Sentinel Board: el dock inferior
unificado donde el usuario ejecuta acciones, analiza contexto y supervisa el
runtime de agentes sin abandonar el board.

No es un chat con un LLM, no es un panel de configuración, y desde el cierre
de la fase Single Operational Surface **es la única superficie operacional
de SB** — ya no coexiste con una terminal xterm paralela. Es un copiloto
**operacional**, dev-first, que convierte intenciones cortas (texto en
lenguaje natural acotado, comandos, contexto pegado) en cambios deterministas
sobre el board y en señales para el usuario.

Su ubicación física es la franja inferior de la pantalla, redimensionable
verticalmente (min 240 px expandido, max 65 vh con tope duro de 760 px).

## 2. Anatomía visual de Sentinel Board

| Zona | Rol | Persistencia | Interactividad principal |
|---|---|---|---|
| **Board** | Tablero kanban — cards por estado/proyecto | DB (Drizzle/Neon) | Drag & drop, click para seleccionar |
| **Timeline** | Historial cronológico de eventos del workspace | DB + reducer | Solo lectura, navegación temporal |
| **Detail Panel** (Right Panel) | Detalle de la card o proyecto seleccionado, Codex Loop, Código del Dinero, comentarios | DB | Edición de comentarios, sugerencias de comando |
| **Dock / HEO Copilot** | Runtime vivo: ejecutar, analizar, foco, estado de agentes | Sesión + altura en localStorage | Input único, status badge, atajos |

**Regla mental clara:**

- **Board** es _estado_ — lo que existe.
- **Timeline** es _memoria_ — lo que pasó.
- **Detail Panel** es _contexto_ — lo que importa de un ítem.
- **Dock** es _acción_ — lo que voy a hacer ahora.

## 3. Modos del Copilot

El dock tiene cuatro modos seleccionables vía tabs. El input es **único**
(`CopilotInput`) y cambia su comportamiento según el modo activo.

### 3.1 EXECUTE

- **Placeholder:** `Ejecuta una acción: mover card, crear tarea, iniciar foco...`
- **Submit:** `Enter`
- **Pipeline:** `parseCommandLine` → `executeCommandWithDispatch` (lib/console)
- **Hace:**
  - `crear tarea <título> en <proyecto>`
  - `mover "<título>" a <estado>`
  - `registrar <n> horas en <proyecto>`
  - `iniciar foco` / `terminar foco`
- **No hace:** análisis de texto largo, llamadas LLM, ejecución de scripts shell.
- **Side-panel:** sugerencias HEO contextuales + acciones rápidas (Iniciar foco,
  Nueva tarea). El resto de operaciones (incluido mover estado) se hace por
  input — sin modales paralelos.

### 3.2 ANALYZE

- **Placeholder:** `Pega una idea, contexto o problema para convertirlo en backlog...`
- **Submit:** `Ctrl + Enter` (textarea multilínea)
- **Pipeline:** `POST /api/agents/run` → planner (provider configurable) →
  fallback a `runLocalAnalysis` heurístico si el agente falla o devuelve no-JSON.
- **Hace:**
  - Convertir notas/correos/párrafos en una propuesta de tareas
  - Renderizar `AnalysisPreview` con acciones "Crear en board" / "Copiar informe"
- **No hace:** crear cards automáticamente; siempre exige confirmación humana.

### 3.3 FOCUS

- **Placeholder:** `Define el foco actual o vincula una tarea...`
- **Submit:** `Enter`
- **Pipeline:**
  - Si el texto parsea como verbo conocido (`mover`, `crear`, etc.), se ejecuta tal cual
  - Si no, se delega a `iniciar foco en <texto>` reutilizando el executor existente
- **Hace:**
  - Timer en sesión (`focusSession` en el reducer)
  - Botones mínimos: Iniciar / Pausar / Reanudar / Finalizar
  - Línea contextual con la card activa (si hay) y un botón "Localizar" que hace deep-link al board
- **No hace:** notificaciones, control de pomodoro configurable, sync con calendarios.

### 3.4 RUNTIME

- **Placeholder:** `Runtime aún no recibe comandos. Solo muestra estado de agentes.`
- **Input:** _deshabilitado_ por diseño.
- **Pipeline (Fase 4):** polling NDJSON simple cada 3000 ms a
  `GET /api/runtime/events` (lee `AMON_EVENTS_PATH`). No WebSocket, no SSE.
- **Hace:**
  - Listar agentes: `planner`, `state-guardian`, `qa-reviewer`, `scorer`.
  - Estado por agente derivado de los últimos eventos:
    `agent.started → running`, `agent.done → success`, `agent.error → error`,
    sin evento reciente → `idle`.
  - Muestra último mensaje, tiempo relativo, `runId` y `taskId` si existen.
  - Badge "Event Stream conectado" cuando el archivo existe;
    "Event Stream pendiente" si no.
- **No hace:** ejecutar agentes desde SB, persistir eventos en DB,
  reconectarse vía streaming (Fase 5+), inventar timestamps cuando no hay
  archivo.

## 4. Status del Copilot

Indicador compacto en el header con cuatro estados:

| Estado | Significado |
|---|---|
| `idle` | Sin operación reciente |
| `running` | Último submit en curso (analyze, command, etc.) |
| `ok` | Última operación exitosa; subtítulo muestra el mensaje |
| `error` | Última operación falló; subtítulo muestra el motivo |

El status **no es un historial** — guarda solo el último resultado. El
historial completo vive en el Timeline.

## 5. Decisiones arquitectónicas

### 5.1 Runtime no finge datos

> Mostrar agentes con timestamps inventados, estados que cambian solos o
> contadores que parecen reales degrada la confianza del usuario en todo lo
> demás del producto.

Desde Fase 4, Runtime lee NDJSON real:

- Si no hay archivo configurado o accesible → badge "Event Stream pendiente"
  y todos los agentes quedan en `idle`. No se inventa actividad.
- Si hay archivo, los estados (`running / success / error`) se derivan de
  eventos reales, no de mocks.
- El tiempo relativo (`hace 12s`) usa el `ts` del evento, no `Date.now()`
  inventado.

Es preferible un panel honestamente vacío que un panel que aparente vida.

### 5.2 Timeline es memoria persistente, Dock es operación viva

El dock **no acumula log propio**. Lo que sucede en el dock se vuelca al
Timeline; el dock solo recuerda el último resultado del último submit.

Consecuencias prácticas:

- Eliminado `command-log.tsx` (estaba duplicando el Timeline)
- Eliminado `command-input.tsx` (reemplazado por `CopilotInput`)
- No se replican aquí columnas de "actividad reciente" — son ruido

Esto significa: si el usuario necesita ver qué pasó hace cinco minutos, va al
Timeline; el dock solo le dice _en qué está parado ahora_.

### 5.3 Dev Matte por sobre glass excesivo

Decisión visual: el dock es una herramienta de trabajo, no una landing page.

- Sustituida la iridiscencia de gradientes (`linear-gradient(90deg, oklch(0.6 …)…)`)
  por un único `box-shadow: inset 0 1px 0` monocromo
- Superficies sólidas: `--dock-surface` (`oklch(0.048 …)`) y `--dock-elevated`
  (`oklch(0.062 …)`), carbón mate
- Bordes finos `border-border/35` y contraste de texto secundario subido a
  `/70`-`/75` para legibilidad continuada
- Sin blur de fondo, sin glow, sin saturaciones decorativas

El objetivo es que el dock se sienta como una franja de VS Code/Cursor/Warp,
no como un overlay translúcido.

### 5.4 Input único, modos internos

`CopilotInput` es la única superficie de entrada de texto del dock. Vive
abajo, persiste entre modos y rotea su submit por modo a través de la función
central `handleCopilotSubmit()`.

Cada modo conserva su draft localmente (`executeValue`, `analyzeValue`,
`focusValue`) para no perder texto al cambiar de tab durante la misma sesión.

### 5.5 Colapso es estado de sesión; altura es estado persistente

- `expanded` se reinicia al cargar la app (queremos un primer pintado liviano)
- `dockHeight` se persiste en `localStorage` bajo `sentinel:dock-height` y se
  re-clampea al máximo dinámico (65 vh) en cada mount y en `window.resize`

## 6. Lenguaje y tono

Español neutro/chileno profesional. Prohibido en UI:

- `pegá`, `creá`, `podés`, `revisá`, `usá`, `tenés`, `acá` (como sustituto de "aquí")

Preferido:

- `pega`, `crea`, `puedes`, `revisa`, `usa`, `tienes`, `aquí`

Tono general:

- Imperativo cuando es acción ("Ejecuta", "Pega contexto")
- Declarativo cuando es estado ("Sin card seleccionada", "Runtime se conectará…")
- Sin emojis en UI

## 7. Qué NO hace el cockpit todavía

Para evitar promesas implícitas, este es el muro de "todavía no":

- No hay autenticación ni separación por workspace (Fase 7)
- No hay WebSocket/SSE — el Runtime usa polling NDJSON simple cada 3 s
  (Fase 4 implementada; streaming queda para Fase 5)
- SB no ejecuta agentes — solo observa eventos NDJSON (Fase 6)
- No hay tracking de tokens ni costos (Fase 8)
- No hay entrada por voz (Fase 9)
- No hay atajo global de teclado para enfocar el input
- No hay persistencia de drafts del input al recargar
- No hay notificaciones push ni desktop notifications

Cuando algo de esta lista se mueva a "implementado", debe actualizarse aquí
**y** en `ROADMAP.md`.

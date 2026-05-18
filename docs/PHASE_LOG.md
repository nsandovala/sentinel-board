# Phase Log — Dock / HEO Copilot

Bitácora cronológica de las fases ejecutadas sobre el dock inferior.
Cada fase fue una intervención acotada con criterio de éxito explícito y
validación de `npx tsc --noEmit` + `npm run build`.

---

## Fase 1 — Desfragmentación visual del MVP

**Cierre:** 2026-05-18

### Objetivo

Reducir la sensación de "cuatro mini aplicaciones pegadas" sin tocar backend,
DB ni endpoints.

### Problema resuelto

- COMMAND duplicaba la idea de terminal/copolito
- AGENTS parecía un mock con datos que no existían
- El dock repetía actividad que ya vive en Timeline
- Mezcla de español rioplatense y neutro en la UI

### Cambios funcionales

- **Renombrado visual** (keys internas intactas para no romper handlers):
  - `command` → **Execute**
  - `analyze` → **Analyze**
  - `focus` → **Focus**
  - `agents` → **Runtime**
- **Eliminado** el bloque "Actividad operacional reciente" + `<CommandLog>` en
  Execute y Analyze (era duplicación literal del Timeline)
- **Runtime** simplificado a una lista compacta `idle` para
  `planner / state-guardian / qa-reviewer / scorer`, con badge explicativo
  de que el stream se conecta después
- **Focus** simplificado: timer + estado + tarea activa, sin panel "Sesión"
- **Lenguaje neutralizado**: `usá → usa`, `Pegar … → Pega …`, `cockpit operacional → HEO Copilot`

### Archivos modificados

- `components/console/dock/dock-mode-tabs.tsx`
- `components/console/dock/dock-workspace.tsx`
- `components/console/dock/command-mode.tsx`
- `components/console/dock/analyze-mode.tsx`
- `components/console/dock/agents-mode.tsx`
- `components/console/dock/focus-mode.tsx`
- `components/layout/right-panel.tsx`
- `lib/console/command-parser.ts`

### Resultado funcional

El dock dejó de sentirse fragmentado. Cada modo tiene un propósito claro y
nada de lo que muestra duplica al Timeline.

### Validación

- `npx tsc --noEmit` → OK
- `npm run build` → 6/6 páginas

### Pendientes que pasaron a Fase 2

- Inputs duplicados: Execute y Analyze seguían con inputs independientes
- Submit fragmentado entre `handleCommandSubmit` y `handleAnalyzeSubmit`
- Falta de feedback de estado global del copilot

---

## Fase 2 — HEO Copilot unificado

**Cierre:** 2026-05-18

### Objetivo

Convertir el dock en un único copiloto operacional con un input único y
pipeline visual coherente, sin tocar backend ni implementar streaming.

### Problema resuelto

- Cada modo tenía su propio input → percepción de mini apps separadas
- Submit handlers desperdigados → costoso agregar nuevos modos
- Sin estado global del copilot (idle/running/success/error)

### Cambios funcionales

- **Nuevo componente** `components/console/dock/copilot-input.tsx`
  - Único input del dock, adaptable por modo (placeholder, ícono, multilínea, disabled)
  - Submit con `Enter` (single-line) o `Ctrl + Enter` (textarea de Analyze)
- **`handleCopilotSubmit()`** central en `dock-workspace.tsx`:
  - `command` → `runCommandLine` (executor existente)
  - `analyze` → `runAnalyzeSubmit` (POST `/api/agents/run` + fallback heurístico)
  - `focus` → si parsea como verbo conocido lo ejecuta tal cual; si no, lo delega
    a `iniciar foco en <texto>`
  - `agents` → no-op (input deshabilitado)
- **Status badge** en el header con cuatro estados: `idle / running / ok / error`,
  más subtítulo con `lastResultMessage`
- **Drafts por modo**: `executeValue / analyzeValue / focusValue` separados
  para no perder texto al cambiar tab
- **Eliminados**: `components/console/command-input.tsx` y
  `components/console/command-log.tsx` (sin consumidores tras el refactor)

### Archivos modificados / creados

- **Nuevo** `components/console/dock/copilot-input.tsx`
- `components/console/dock/dock-workspace.tsx` (reescrito)
- `components/console/dock/command-mode.tsx`
- `components/console/dock/analyze-mode.tsx`
- **Eliminados** `components/console/command-input.tsx` y
  `components/console/command-log.tsx`

### Resultado funcional

El dock se percibe como un solo HEO Copilot con modos internos, no como cuatro
aplicaciones. El status badge da feedback inmediato sin duplicar Timeline.

### Validación

- `npx tsc --noEmit` → OK
- `npm run build` → 6/6 páginas

### Pendientes que pasaron a Fase 3

- Dock con altura fija fea en pantallas chicas
- Resize manual existía pero faltaba pulir clamp y dev-feel
- Sidebar podía quedar sin scroll cuando el dock crecía
- Focus seguía sintiéndose como mini app pese al refactor

---

## Fase 3 — Dock dev-first profesional

**Cierre:** 2026-05-18

### Objetivo

Convertir el dock en un panel profesional, redimensionable y usable, estilo
panel inferior de VS Code/Cursor/Warp.

### Problema resuelto

- Altura del dock pegada vs pantalla
- Sin clamp consistente al redimensionar la ventana
- Sidebar (especialmente la lista de Proyectos) podía verse cortada cuando
  el dock crecía
- Focus seguía sintiéndose como mini app
- Glass excesivo restaba sensación de herramienta dev

### Cambios funcionales

- **Resize**:
  - `DOCK_MIN_HEIGHT = 240` (expandido), `DOCK_COLLAPSED_HEIGHT = 48`,
    default `340`
  - **Max dinámico**: `min(0.65 × innerHeight, 760)`
  - `Math.round` para evitar subpixel jitter
  - Drag desde el handle superior con `pointermove` / `pointerup` globales,
    `cursor: ns-resize` + `user-select: none` durante el drag
  - Auto-clamp en `window.resize`
  - Drag desde colapsado auto-expande sin saltos
- **Colapso profesional**:
  - Colapsado (48 px) muestra solo: chevron + "HEO Copilot", label del modo,
    status badge, resize handle
  - Tabs y focus chip ocultos en colapsado
- **Persistencia**:
  - Altura en `localStorage` bajo `sentinel:dock-height`
  - `expanded` NO se persiste (es estado de sesión)
- **Sidebar**:
  - `shrink-0` en branding, workspace card, live stats, navigation, footer y
    encabezado de "Proyectos"
  - Único bloque que cede: la lista de Proyectos con su `ScrollArea`
- **Focus** rediseñado como estado contextual:
  - Una fila: timer compacto + badge de estado + sugerencia de proyecto + botones
    Iniciar/Pausar/Reanudar/Finalizar alineados a la derecha
  - "Tarea activa" colapsada a una línea con label, título truncado, status y
    botón "Localizar" (deep-link al board)
- **Runtime** copy final: "Event Stream de AMON Agents se conectará en una
  fase posterior."
- **Dev Matte**:
  - Sustituidos los gradientes iridiscentes de `.sentinel-command-dock` y
    `.sentinel-dock-expanded` por un único `box-shadow: inset 0 1px 0`
    monocromo
  - Carbón sólido (`--dock-surface`, `--dock-elevated`)
  - Contraste de textos secundarios subido de `/55` a `/70`-`/75`

### Archivos modificados

- `components/console/dock/dock-workspace.tsx`
- `components/console/dock/focus-mode.tsx`
- `components/console/dock/agents-mode.tsx`
- `components/console/dock/command-mode.tsx`
- `components/console/dock/analyze-mode.tsx`
- `components/console/dock/copilot-input.tsx`
- `components/layout/app-sidebar.tsx`
- `app/globals.css`

### Resultado funcional

El dock se siente como un panel inferior profesional: se arrastra, se colapsa,
recuerda su altura, no pelea con la sidebar y no tapa el board más de un 65 %
de la ventana.

### Validación

- `npx tsc --noEmit` → OK
- `npm run build` → 6/6 páginas

### Pendientes que pasan a fases siguientes

- Conectar `/api/stream` real al Runtime (Fase 4)
- Definir contrato formal de eventos (Fase 5)
- Integración con AMON Agents como motor real (Fase 6)
- Auth / multi-workspace / token security (Fase 7)
- Telemetría de provider y tokens (Fase 8)
- Voice Copilot (Fase 9)
- Persistir draft del input por modo
- Atajo global Cmd+K / `/` para enfocar el `CopilotInput`
- Cap de altura sensible al alto del TopBar + Terminal abiertos
- Accesibilidad por teclado del resize handle

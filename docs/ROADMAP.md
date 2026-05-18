# Sentinel Board — Roadmap

> Estado declarado del producto y plan futuro de fases.
> Mantener sincronizado con `PHASE_LOG.md` y `OPERATIONAL_COCKPIT.md`.

## Convención

- **Implementado** — código en `main`, validado con `tsc + build`.
- **Pendiente** — diseñado o iniciado, no operativo.
- **Futuro** — comprometido conceptualmente, no diseñado en detalle.

No marcar como "implementado" nada que no esté en `main` y compilando.

## Implementado (Fase 1 → Fase 3)

Resumen breve — el detalle vive en `PHASE_LOG.md`.

- **Fase 1 — Desfragmentación visual:** renombrado de modos
  (Execute / Analyze / Focus / Runtime), eliminación de duplicación con
  Timeline, neutralización del lenguaje.
- **Fase 2 — HEO Copilot unificado:** componente `CopilotInput` único,
  `handleCopilotSubmit` central, status badge `idle/running/ok/error`,
  drafts por modo.
- **Fase 3 — Dock dev-first profesional:** resize con cap 65 vh, persistencia
  de altura, colapso compacto, sidebar con scroll independiente, Focus
  contextual, Dev Matte.

---

## Fase 4 — Runtime real mínimo

**Estado:** Pendiente.

**Objetivo:** Que Runtime deje de ser estático y refleje actividad real,
aunque sea con polling simple.

**Alcance:**

- Leer eventos NDJSON producidos por AMON Agents (formato a confirmar con AA).
- Endpoint local minimal `GET /api/runtime/events` que retorne los últimos
  N eventos en memoria o archivo, sin estado distribuido.
- Polling desde el componente Runtime (intervalo razonable, p.ej. 3-5 s) con
  cancelación al cambiar de modo o desmontar.
- Indicador visual real cuando un agente pasa a `running` y vuelve a `idle`.
- Manejo defensivo de payloads desconocidos: si llega un evento sin schema
  esperado, se ignora silenciosamente (no romper la UI).

**Fuera de alcance:**

- WebSocket / SSE (queda para Fase 5).
- Persistencia en DB de los eventos del runtime.
- Replay histórico — solo "lo que está pasando ahora".

**Criterio de éxito:**

Cuando un usuario lance una tarea desde AMON Agents y abra Runtime, ve los
nombres correctos pasando a `running` y luego volviendo a `idle`, sin mocks.

---

## Fase 5 — Event Stream formal

**Estado:** Pendiente.

**Objetivo:** Estabilizar un contrato de eventos compartido entre AA y SB y
preparar transporte streaming.

**Alcance:**

- Definir tipo `RuntimeEvent` con campos mínimos: `id`, `ts`, `type`,
  `agent?`, `runId?`, `payload?`.
- Soportar los tipos canónicos:
  - `run.started`
  - `agent.started`
  - `agent.done`
  - `agent.error`
  - `sb.push.done`
- Abstracción `EventSink` server-side: el consumidor de NDJSON entrega eventos
  a un sink y el sink decide cómo retransmitir (in-memory, archivo, futuro
  SSE/WS).
- Preparar `/api/stream` para SSE (sin obligarlo todavía): retornar el último
  buffer + headers de streaming, dejando lugar a una conexión persistente.
- Documentar el contrato en `docs/PROJECTS/amon-agents/event-contract.md`
  (o equivalente) con ejemplos JSON.

**Fuera de alcance:**

- Migrar el polling de Fase 4 a SSE (se hace cuando AA emita estable).
- Auth del stream — eso pertenece a Fase 7.

**Criterio de éxito:**

Cualquier consumidor (SB, dashboard externo, log) puede leer el mismo formato
de eventos y reaccionar consistentemente. Un cambio en AA no rompe SB salvo
que el contrato cambie explícitamente.

---

## Fase 6 — AMON Agents integration

**Estado:** Futuro.

**Objetivo:** Conectar Sentinel Board con AMON Agents como runtime externo
real, manteniendo a SB como capa visual/operacional y no como motor LLM.

**Alcance:**

- SB consume eventos del runtime de AA vía contrato de Fase 5.
- SB puede gatillar jobs hacia AA (ej.: `planner` desde Analyze) y observar
  el ciclo de vida completo.
- Estado real de `planner`, `state-guardian`, `qa-reviewer`, `scorer`
  reflejado en Runtime.
- Decisión arquitectónica explícita: **AA es el motor**, SB es el cockpit.
  Toda lógica LLM heavy vive en AA; SB orquesta visualmente y persiste
  resultados.

**Fuera de alcance:**

- Reescribir el executor local de comandos deterministas: sigue siendo SB.
- Mover el board / Timeline a AA.

**Criterio de éxito:**

Un mismo `runId` se puede seguir end-to-end: SB lanza la intención, AA
ejecuta, los agentes emiten eventos, SB muestra el estado en Runtime y el
resultado final aparece en el board y en el Timeline.

**Riesgos:**

- Dependencia operativa entre dos proyectos — necesitamos versionado del
  contrato.
- Latencia entre AA y SB visible al usuario; mitigar con loading states
  honestos (no spinners infinitos).

---

## Fase 7 — Security MVP

**Estado:** Futuro.

**Objetivo:** Llevar SB de "uso single-user en dev" a una superficie con
identidad, autorización y manejo correcto de secretos.

**Alcance:**

- Auth con Clerk u opción equivalente evaluada (NextAuth, Lucia).
- Protección de rutas server-side: `/api/*` valida sesión y workspace.
- Modelo de **workspace** mínimo: separar datos por usuario/equipo en el
  schema, sin asumir que un solo board global sirve.
- Validación de tokens server-side; nunca confiar en payloads de cliente.
- Revisión de `NEXT_PUBLIC_*`: nada que no deba estar en el bundle del
  cliente.
- Eliminación de logs que exponen valores sensibles.
- Auditoría básica de dependencias y env vars (script o checklist).

**Fuera de alcance:**

- 2FA / SSO empresarial.
- Logging estructurado nivel SIEM.

**Criterio de éxito:**

Dos usuarios distintos pueden usar la misma instancia sin verse los datos.
Las llaves de provider LLM no se exponen al cliente. Las rutas de API
rechazan requests sin sesión válida.

**Bloqueante para:** Fase 8 (telemetría de tokens) y Fase 9 (voz) — no
exponer endpoints sensibles antes de tener auth.

---

## Fase 8 — Provider & token telemetry

**Estado:** Futuro.

**Objetivo:** Hacer visible qué provider de LLM está activo y cuánto está
costando, sin exponer secretos.

**Alcance:**

- Indicador del provider activo (Ollama / OpenRouter / otro) en el header
  del Copilot o en el Detail Panel.
- Estado de salud del provider: alcanzable, latencia aproximada, modelo
  cargado.
- Registro aproximado de consumo de tokens **cuando** el provider lo entregue
  en la respuesta. No estimar a ojo si el provider no devuelve `usage`.
- Persistir uso por `runId` para agregación.
- Dashboard mínimo de costos: cards procesadas, tokens estimados, ventanas
  diaria/semanal.

**Fuera de alcance:**

- Facturación o cobros.
- Predicción de costo previo a ejecutar.

**Criterio de éxito:**

El usuario puede responder "qué provider estoy usando", "está sano" y "cuánto
gasté esta semana" sin abrir el código.

**Restricciones:**

- Cero exposición de llaves al cliente.
- No mostrar valores que no vengan literal del provider.
- Bloqueado por Fase 7 (necesita scoping por workspace para que el reporte
  tenga sentido en multi-usuario).

---

## Fase 9 — Voice Copilot / Mini Jarvis

**Estado:** Futuro / exploratorio.

**Objetivo:** Explorar entrada por voz y respuestas habladas para el HEO
Copilot, manteniéndolo opcional y opt-in.

**Alcance exploratorio:**

- Captura de audio en el navegador, envío a Whisper (local o remoto).
- Transcripción → reutiliza `handleCopilotSubmit` con el texto resultante.
- TTS opcional con ElevenLabs u opción local; activable por preferencia.
- Notificaciones habladas por categoría (foco terminado, agente en error,
  build roto), siempre opt-in.
- Hotword/push-to-talk con atajo de teclado claro y posibilidad de
  desactivar.

**Fuera de alcance hasta tener Fase 7 + Fase 4-6:**

- Procesamiento de audio en backend sin auth.
- Comandos de voz que ejecuten destructivos sin confirmación.

**Criterio de éxito:**

Un usuario puede dictar `crear tarea revisar reporte en MiProyecto` y el
comando se ejecuta en el dock como si lo hubiera tipeado, mostrando el
status badge normal.

**Precondiciones obligatorias:**

- Fase 7 estable: voz envía texto a endpoints que requieren auth y workspace
  válidos.
- Fase 4 estable: hay un runtime real al que reaccionar.
- UX explícita: nada de voz silenciosa de fondo, nada de activación
  involuntaria.

---

## Mantenimiento de este roadmap

- Al cerrar una fase: mover de "Pendiente" a "Implementado", actualizar el
  resumen de fases implementadas, y registrar el detalle en `PHASE_LOG.md`.
- Si una fase se reordena: actualizar este archivo y `OPERATIONAL_COCKPIT.md`
  (sección "Qué NO hace todavía").
- Si una fase se cancela: dejarla aquí con `Estado: descartada` y un párrafo
  corto del motivo. No borrar — la historia importa.
- No marcar nada como "implementado" sin `tsc + build` verdes y un PR
  visible.

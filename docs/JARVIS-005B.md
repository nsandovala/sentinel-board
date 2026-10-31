# JARVIS-005B — Sentinel Board Snapshot Ingest

Estado: **implementado en rama; pendiente de QA humano y revisión de Nelson**.

## Contrato recuperado

AA expone `GET /api/ops/snapshot` en `127.0.0.1:4785`. La respuesta contiene
`workers`, `jobs`, `guardianReviews` y `agents`; también incluye rutas locales.
SB ya tiene un modo Runtime que lee NDJSON para el pipeline
`planner/state-guardian/qa-reviewer/scorer`. El Dock y Kanban existentes son
las superficies vigentes. Esta integración agrega la observación operacional
de Worker, Jarvis, Claudio y Guardian dentro del mismo modo Runtime.

## Canal y límites

1. Iniciar AA local: `npm run amon -- ops-server`.
2. Configurar `AMON_OPS_SNAPSHOT_URL=http://127.0.0.1:4785/api/ops/snapshot`
   en `.env.local` de SB.
3. Iniciar SB local con `npm run dev` (el script fija `127.0.0.1`).
4. El navegador consulta `/api/runtime/ops` de SB cada 3 segundos. SB consulta
   AA desde el servidor con timeout de 1,5 segundos, sin redirecciones y con
   URL restringida a loopback literal y ruta exacta.

El puente de SB está deshabilitado en producción. La respuesta de SB contiene
solo identificadores acotados, estados, timestamps, veredictos y cantidad de
hallazgos. No transmite `repo`, `worktreePath`, `workspace.root`, herramientas,
stdout, stderr ni errores de AA. No usa la DB ni emite comandos a AA.

## Semántica

- Worker online requiere `status=online` y heartbeat válido de hasta 20 s.
  Sin worker → offline; heartbeat viejo o inválido → stale.
- Un job `running`/`queued` reciente (hasta 10 min) junto con Worker online
  permite `working`. Si envejece, pasa a `stale`.
- El último job por timestamp decide el estado de Claudio. Solo el veredicto
  Guardian más reciente de **ese job** puede mostrar `blocked` o
  `waiting_human`; una revisión histórica de otro job no afecta el actual.
- Una respuesta inválida, error o desconexión devuelve una proyección offline
  vacía. Ningún resultado anterior queda visible después de fallar el polling.

## Criterios de revisión

- Verificar en máquina local con AA vivo, job en curso y revisión Guardian real.
- Confirmar que Kanban, Dock y modo NDJSON se mantienen funcionales.
- Revisar estados y etiquetas con Nelson. Este documento no declara cerrado
  el sprint hasta esas verificaciones humanas.

Las tareas de confiabilidad R2/R3, recuperación y revisión amplia de Guardian
quedan como seguimiento independiente. No son prerequisitos del puente de
lectura JARVIS-005B.

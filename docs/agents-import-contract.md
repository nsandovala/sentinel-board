# `POST /api/agents/import` — Contrato de ingesta desde amon-agents

Endpoint dedicado para que **amon-agents (AA)** y otros agentes externos
inserten tareas en Sentinel Board sin tener que conocer el esquema interno
de `SentinelCard`.

> Recomendado para AA. El endpoint legacy `POST /api/tasks` sigue activo y
> sin cambios para clientes browser internos.

## Endpoint

```
POST {SENTINEL_BOARD_API_URL}/api/agents/import
```

## Auth

Mismas reglas que el resto del API (`rejectIfUnauthorized`):

- Llamadas desde `localhost` o mismo origen del browser pasan sin token.
- Desde fuera, requiere `Authorization: Bearer ${SENTINEL_API_TOKEN}` o
  header `X-Sentinel-Token`.

Desde AA: configurar `SENTINEL_BOARD_AGENT_TOKEN` en `.env.local` igual al
`SENTINEL_API_TOKEN` del Board.

## Request body

| Campo            | Tipo                                       | Requerido | Default          | Notas |
|------------------|--------------------------------------------|:--------:|:-----------------|-------|
| `source`         | `"amon-agents"` (literal)                  |   sí     | —                | Fija el origen. |
| `externalTaskId` | `string`                                   |   sí     | —                | Ej: `TASK-003`. |
| `agent`          | `string`                                   |   sí     | —                | Ej: `architect`, `qa`, `security`, `ops`. |
| `title`          | `string`                                   |   sí     | —                | Mostrado como título de la card. |
| `description`    | `string`                                   |   no     | resumen autogenerado | Markdown libre. |
| `priority`       | `low \| medium \| high \| critical`        |   no     | `medium`         | |
| `status`         | enum `CardStatus`                          |   no     | `idea_bruta`     | `idea_bruta`, `clarificando`, `validando`, `en_proceso`, `desarrollo`, `qa`, `listo`, `produccion`, `archivado`. |
| `type`           | enum `CardType`                            |   no     | `feature`        | `idea`, `feature`, `bug`, `task`, `decision`, `experiment`, `deploy`, `research`. |
| `tags`           | `string[]`                                 |   no     | `[]`             | Se mergean con tags semilla (`amon-agents`, `agent:<n>`, `ext:<id>`). |
| `projectSlug`    | `string`                                   |   no     | `amon_agents`    | Si no existe, se crea on-the-fly. |
| `metadata`       | objeto (ver abajo)                         |   no     | objeto vacío     | Datos operativos del pipeline AA. |

### `metadata`

```jsonc
{
  "plan": ["paso 1", "paso 2"],
  "risks": ["riesgo 1"],
  "validations": ["validación 1"],
  "done_when": ["criterio 1"],
  "files_to_touch": ["src/x.ts"],
  "score": 87
}
```

Persistencia interna:
- `metadata.plan` / `validations` / `done_when` se serializan en
  `tasks.codex_loop` (jsonb).
- `metadata.score` se guarda en `tasks.money_code.score` (jsonb).
- `metadata.risks` y `files_to_touch` quedan disponibles para futuras
  vistas; hoy se incluyen como hints en `description` si está vacío.

### Ejemplo

```bash
curl -X POST http://localhost:3000/api/agents/import \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SENTINEL_API_TOKEN" \
  -d '{
    "source": "amon-agents",
    "externalTaskId": "TASK-003",
    "agent": "architect",
    "title": "Agregar login OAuth",
    "description": "Plan inicial generado por planner.",
    "priority": "high",
    "type": "feature",
    "tags": ["oauth", "auth"],
    "metadata": {
      "plan": ["Definir estrategia", "Implementar endpoint", "Integrar provider"],
      "risks": ["Manejo de tokens"],
      "validations": ["Login E2E"],
      "done_when": ["OAuth funciona contra Google"],
      "files_to_touch": ["src/auth/oauth.js"],
      "score": 8
    }
  }'
```

## Response

### 200 OK

```json
{
  "ok": true,
  "taskId": "aa-task-003-architect",
  "projectId": "2",
  "source": "amon-agents",
  "agent": "architect",
  "externalTaskId": "TASK-003"
}
```

### 400 Validation

```json
{
  "ok": false,
  "error": "Validation failed — externalTaskId: externalTaskId is required",
  "issues": [ /* zod issues */ ]
}
```

### 403 Auth

```json
{ "ok": false, "error": "Protected endpoint. ..." }
```

### 500

```json
{ "ok": false, "error": "<motivo>" }
```

## Idempotencia

El `taskId` interno se deriva determinísticamente:

```
taskId = `aa-${externalTaskId}-${agent}` (lowercased, sanitized)
```

Reenviar el mismo `(externalTaskId, agent)` actualiza la tarea existente
(`ON CONFLICT DO UPDATE`) y registra otro evento en la timeline.

## Eventos / timeline

Cada import exitoso inserta un row en `events`:

```
type    = "system"
message = "[amon-agents] import <agent> → <externalTaskId> (task=<taskId>)"
```

## Diferencias vs `POST /api/tasks`

| Aspecto             | `/api/tasks`                                    | `/api/agents/import`                  |
|---------------------|-------------------------------------------------|---------------------------------------|
| Cliente principal   | UI del Board                                    | amon-agents y agentes externos        |
| `id`                | Lo provee el cliente, requerido                 | Derivado de `externalTaskId + agent`  |
| `projectId`         | Requerido (FK estricta)                         | Resuelto por slug, autocreado         |
| Validación          | `validateTaskCreate` manual                     | Zod                                   |
| Idempotencia        | Inserción simple (falla por PK duplicada)       | Upsert por `tasks.id`                 |
| Timeline            | `logDockEvent("command", ...)`                  | `logDockEvent("system", ...)`         |

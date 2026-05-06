# Sentinel Board Deploy

## Objetivo

Desplegar Sentinel Board en Render como `Web Service`, usando Neon/Postgres por `DATABASE_URL`, con OpenRouter como provider principal en produccion y una integracion minima para capturar ideas desde UI o desde `amon_agents`.

## Render

- Tipo: `Web Service`
- Runtime: `Node`
- Root Directory: repo root `sentinel-board`
- Build Command: `npm ci && npm run build`
- Start Command: `npm run start`

## Variables requeridas

### Base de datos

- `DATABASE_URL`
  - Debe apuntar a Neon/Postgres.
  - Usa la connection string completa con SSL. Ejemplo:
  - `postgresql://USER:PASSWORD@ep-xxx.us-east-1.aws.neon.tech/DBNAME?sslmode=require`

### Seguridad

- `SENTINEL_API_TOKEN`
  - Requerido para integraciones externas hacia endpoints sensibles.
  - Los requests desde `localhost` siguen permitidos para pruebas locales.
  - La UI del mismo origen web puede escribir sin exponer el token al browser.

### IA en produccion

- `OPENROUTER_API_KEY`
  - Provider principal/fallback recomendado en Render.
- `OPENROUTER_MODEL`
  - Recomendado: `qwen/qwen3-8b:free` o el modelo operativo que prefieras.

### Opcionales

- `PG_POOL_MAX`
  - Recomendado inicial: `10`
- `ANTHROPIC_API_KEY`
- `ANTHROPIC_MODEL`
- `OLLAMA_BASE_URL`
- `OLLAMA_MODEL`

## Providers IA

### Local

- `OLLAMA_BASE_URL=http://localhost:11434`
- `OLLAMA_MODEL=qwen3:8b`
- LM Studio sigue siendo opcional para desarrollo local.

### Produccion

- Prioridad practica recomendada:
  1. `OPENROUTER_API_KEY`
  2. `ANTHROPIC_API_KEY` si quieres otro fallback remoto
  3. fallback heuristico local de la app

## Neon

- Sentinel Board usa `DATABASE_URL` directamente desde `lib/db/index.ts`.
- Neon funciona sin cambios de schema para este deploy.
- Si la base todavia no tiene tablas creadas, ejecuta una vez:
- `npm run db:push`

## Endpoint nuevo

### `POST /api/agent-inputs`

Body:

```json
{
  "source": "manual",
  "projectSlug": "sentinel-board",
  "title": "Idea de backlog",
  "content": "Contexto libre de la idea",
  "tags": ["deploy", "idea"]
}
```

Efecto:

- Busca proyecto por `slug`
- Crea `knowledge_entry`
- Crea `task` en `idea_bruta`
- Crea `event` en timeline
- Devuelve `projectId`, `taskId`, `knowledgeEntryId`, `eventId`

## Integracion minima con amon_agents

- `amon_agents` puede enviar ideas a Sentinel Board usando `POST /api/agent-inputs`.
- Recomendacion:
  - `source=amon_agents`
  - `projectSlug=amon_agents` o el proyecto destino real
  - `Authorization: Bearer $SENTINEL_API_TOKEN`

## Pruebas manuales

Asumiendo app local en `http://localhost:3000`.

### Crear idea manual

```bash
curl -X POST http://localhost:3000/api/agent-inputs \
  -H "Content-Type: application/json" \
  -d "{\"source\":\"manual\",\"projectSlug\":\"sentinel-board\",\"title\":\"Validar deploy Render + Neon\",\"content\":\"Necesitamos checklist de deploy, smoke test y validacion de variables en Render.\",\"tags\":[\"deploy\",\"render\",\"neon\"]}"
```

### Simular idea desde amon_agents

```bash
curl -X POST http://localhost:3000/api/agent-inputs \
  -H "Content-Type: application/json" \
  -d "{\"source\":\"amon_agents\",\"projectSlug\":\"amon_agents\",\"title\":\"Convertir analisis comercial en backlog\",\"content\":\"Amon detecto oportunidades y debe crear backlog minimo con prioridad de captura.\",\"tags\":[\"amon\",\"backlog\",\"sync\"]}"
```

### Crear idea remota con token

```bash
curl -X POST https://TU-SERVICE.onrender.com/api/agent-inputs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_SENTINEL_API_TOKEN" \
  -d "{\"source\":\"terminal\",\"projectSlug\":\"sentinel-board\",\"title\":\"Idea remota\",\"content\":\"Prueba remota del endpoint seguro.\",\"tags\":[\"remote\"]}"
```

### Listar tasks

```bash
curl "http://localhost:3000/api/tasks?status=idea_bruta"
```

### Listar knowledge

```bash
curl "http://localhost:3000/api/knowledge?limit=20"
```

## Validacion funcional

- Crear idea por `POST /api/agent-inputs`
- Confirmar que aparece en:
  - board/backlog por `GET /api/tasks`
  - timeline por `GET /api/events`
  - knowledge por `GET /api/knowledge`
- En la UI, `Analizar -> Crear en board` ya persiste via backend real

## Checklist final de deploy

- `DATABASE_URL` de Neon cargada en Render
- `SENTINEL_API_TOKEN` cargado en Render
- `OPENROUTER_API_KEY` cargado en Render
- `OPENROUTER_MODEL` definido
- `npm ci && npm run build` pasa
- `npm run start` levanta en local
- `POST /api/agent-inputs` responde `ok: true`
- Se valida aparicion en board/backlog/timeline/knowledge
- Render configurado como `Web Service`, no `Static Site`

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

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`
- `AMON_OWNER_CLERK_USER_ID`: único usuario autorizado.
- `CLERK_AUTHORIZED_PARTIES`: orígenes HTTPS exactos, separados por coma.
- `SENTINEL_PUBLIC_ORIGIN`: origen público HTTPS único de este despliegue,
  incluido en `CLERK_AUTHORIZED_PARTIES`. En Render usar el dominio público,
  nunca el listener interno (`0.0.0.0` y su puerto). Las mutaciones se rechazan
  si falta o es inválido. En desarrollo local admite HTTP en loopback.
- `AMON_IMPORT_TOKEN`: únicamente `POST /api/agents/import`.
- `SENTINEL_API_TOKEN`: compatibilidad temporal de importación; retirar después de rotar AA.
- Ningún acceso anónimo por localhost. El token de servicio no autoriza APIs humanas.
- Las mutaciones desde la UI usan sesión y Origin, sin token de servicio en el cliente.
- [Política, matriz de métodos y QA pendiente](docs/SEC-SB-AUTH-01.md).

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

## Integración con AMON Agents

El endpoint existente es `POST /api/agents/import`, no `/api/agent-inputs`.
Acepta el payload AA con `externalTaskId` y confirma recepción; actualmente
no persiste en PostgreSQL. Mantiene `ok`, `received`, `taskId` y `message`.

El consumidor AA conserva `SENTINEL_BOARD_AGENT_TOKEN` y envía
`Authorization: Bearer`. Su valor debe corresponder a `AMON_IMPORT_TOKEN`
en SB. Durante la rotación SB acepta también `SENTINEL_API_TOKEN` antiguo,
exclusivamente en importación. No cambiar el payload ni el nombre de variable
del consumidor para esta transición.

## Validación previa a cualquier despliegue

- Ejecutar pruebas de autorización, Runtime, polling e interacción.
- Completar QA real con Clerk de desarrollo: ingreso, propietario, usuario
  ajeno, expiración, cierre de sesión y llamadas directas a API.
- Configurar explícitamente los orígenes autorizados; no derivarlos de cabeceras.
- Confirmar auditorías y tracing sin configuración privada.
- Las consultas a tasks/knowledge y las mutaciones requieren una sesión
  autenticada del propietario; el token de servicio no es sustituto.
- `GET /api/runtime/ops` está bloqueado en producción, aun con sesión válida.
- Migraciones, servicios productivos y deploy requieren autorización separada.

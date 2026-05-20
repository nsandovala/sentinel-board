# Database indexes — Sentinel Board

Cierre Fase 4A.5 (2026-05-19). Documenta los índices Drizzle/PostgreSQL
agregados a `lib/db/schema.ts` y cómo aplicarlos con seguridad sobre Neon.

> **Verdad operativa:** Postgres no crea índices automáticos para foreign
> keys (a diferencia de MySQL). Cualquier `references()` que se use en
> joins o WHERE necesita un índice explícito o sufre full scans cuando la
> tabla crece.

---

## 1. Resumen de índices

Migración generada: `drizzle/0002_pretty_toad.sql`.

### `tasks`

| Índice | Columna | Por qué |
|---|---|---|
| `tasks_project_id_idx` | `project_id` | Filtro `?projectId=` en `/api/tasks` y `/api/search`; hidratación por proyecto. |
| `tasks_status_idx` | `status` | Filtro `?status=` y agrupación por columna del board. |
| `tasks_priority_idx` | `priority` | Filtro `?priority=` y orden secundario en backlog. |
| `tasks_type_idx` | `type` | Filtro `?type=` (bug/feature/etc.). |
| `tasks_blocked_idx` | `blocked` | Filtro `?blocked=true` para vista de bloqueadas. |
| `tasks_updated_at_idx` | `updated_at` | `ORDER BY updatedAt DESC` por defecto en GET /api/tasks. Postgres puede escanear btree en cualquier dirección, no se necesita índice DESC explícito. |
| `tasks_created_at_idx` | `created_at` | Tiebreak de ordenamiento y queries históricas. |
| `tasks_tags_gin_idx` | `tags` (jsonb) | GIN para `WHERE tags @> '["tagX"]'::jsonb`. |

### `task_checklist_items`

| Índice | Columna | Por qué |
|---|---|---|
| `task_checklist_task_id_idx` | `task_id` | Lookup masivo en `GET /api/tasks` (`inArray(taskId, ids)`); `replaceChecklist()` borra por taskId; cascade desde tasks. |

### `card_comments`

| Índice | Columna | Por qué |
|---|---|---|
| `card_comments_card_id_idx` | `card_id` | `GET /api/tasks/:id/comments`. |
| `card_comments_created_at_idx` | `created_at` | `ORDER BY createdAt ASC` en la misma ruta. |

### `events`

| Índice | Columna | Por qué |
|---|---|---|
| `events_created_at_idx` | `created_at` | Timeline y `/api/root-cause` ordenan por createdAt DESC. |
| `events_type_idx` | `type` | Filtrado por tipo (`command/system/heo_suggestion/focus`). |

### `dock_commands`

| Índice | Columna | Por qué |
|---|---|---|
| `dock_commands_created_at_idx` | `created_at` | Telemetría reciente. |

### `focus_sessions`

| Índice | Columna | Por qué |
|---|---|---|
| `focus_sessions_state_idx` | `state` | `WHERE state = 'running'` en GET /api/focus-sessions. |
| `focus_sessions_started_at_idx` | `started_at` | `ORDER BY startedAt DESC` en la misma ruta. |

### `knowledge_entries`

| Índice | Columna | Por qué |
|---|---|---|
| `knowledge_entries_project_id_idx` | `project_id` | Filtro por proyecto. |
| `knowledge_entries_category_idx` | `category` | Filtro `?category=`. |
| `knowledge_entries_status_idx` | `status` | Filtro draft/published/archived. |
| `knowledge_entries_updated_at_idx` | `updated_at` | `ORDER BY updatedAt DESC`. |
| `knowledge_entries_source_task_id_idx` | `source_task_id` | Join con tasks (cascade set null). |
| `knowledge_entries_tags_gin_idx` | `tags` (jsonb) | Búsqueda por tag igual que en tasks. |

### `suggestion_feedback`

| Índice | Columna | Por qué |
|---|---|---|
| `suggestion_feedback_project_id_idx` | `project_id` | Filtros en `feedback-service.ts`. |
| `suggestion_feedback_task_id_idx` | `task_id` | Idem. |
| `suggestion_feedback_decision_idx` | `decision` | Métricas accepted/rejected/ignored. |
| `suggestion_feedback_created_at_idx` | `created_at` | `ORDER BY createdAt DESC`. |

### `system_insights`

| Índice | Columna | Por qué |
|---|---|---|
| `system_insights_project_id_idx` | `project_id` | Filtro principal de `insight-engine.ts`. |
| `system_insights_task_id_idx` | `task_id` | Lookups por tarea. |
| `system_insights_type_idx` | `type` | Dedup de insights por tipo. |
| `system_insights_status_idx` | `status` | `WHERE status = 'open'`. |
| `system_insights_created_at_idx` | `created_at` | Orden cronológico y ventanas `gte(createdAt, 1d)`. |

### `projects`

Sin índices nuevos. `id` (PK) y `slug` (UNIQUE) ya están indexados; no hay
filtros adicionales calientes hoy.

---

## 2. Advertencia: la migración 0002 también crea dos tablas

`drizzle/0002_pretty_toad.sql` incluye `CREATE TABLE suggestion_feedback` y
`CREATE TABLE system_insights`. Razón: esas tablas estaban declaradas en
`lib/db/schema.ts` pero nunca habían sido generadas en una migración formal.

Esto **no es un cambio de Fase 4A.5**, pero queda capturado aquí porque la
migración los agrupa. Dos escenarios:

- **Si tu base nunca corrió `db:push`**, esas tablas no existen — la
  migración las creará junto con los índices. Normal.
- **Si tu base sí corrió `db:push`** (recomendación del README en dev), las
  tablas ya existen. `db:migrate` fallará con
  `relation "suggestion_feedback" already exists`. Saltar la creación
  manualmente o usar la opción de aplicación segura más abajo.

---

## 3. Cómo aplicar en Neon / Render

### Opción A — Si la DB está en sync con `db:push` (dev local)

Más simple: volver a `db:push`. Es idempotente — Drizzle compara schema y
solo aplica diferencias. Creará todos los índices nuevos sin tocar tablas
existentes.

```bash
npm run db:push
```

### Opción B — `db:migrate` (producción Render)

Sólo si la DB no tiene `suggestion_feedback` / `system_insights` todavía.

```bash
npm run db:migrate
```

Si la DB ya tiene esas tablas, editar `drizzle/0002_pretty_toad.sql` antes
de aplicarlo y borrar los dos bloques `CREATE TABLE` y sus indices propios
de esas tablas (que igual conviene crear) — quedando solo `CREATE INDEX`
para tablas ya existentes.

### Opción C — Aplicación manual con `CREATE INDEX CONCURRENTLY` (recomendado en prod con datos)

`CREATE INDEX` toma un lock de escritura mientras corre. Para tablas grandes
en Neon, usar `CONCURRENTLY` para evitar bloqueos:

```sql
-- IMPORTANTE: CONCURRENTLY no puede correr dentro de transacción.
-- Ejecutar línea por línea en psql (no en un script con BEGIN).

CREATE INDEX CONCURRENTLY IF NOT EXISTS tasks_project_id_idx       ON tasks (project_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS tasks_status_idx           ON tasks (status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS tasks_priority_idx         ON tasks (priority);
CREATE INDEX CONCURRENTLY IF NOT EXISTS tasks_type_idx             ON tasks (type);
CREATE INDEX CONCURRENTLY IF NOT EXISTS tasks_blocked_idx          ON tasks (blocked);
CREATE INDEX CONCURRENTLY IF NOT EXISTS tasks_updated_at_idx       ON tasks (updated_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS tasks_created_at_idx       ON tasks (created_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS tasks_tags_gin_idx         ON tasks USING GIN (tags);

CREATE INDEX CONCURRENTLY IF NOT EXISTS task_checklist_task_id_idx ON task_checklist_items (task_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS card_comments_card_id_idx       ON card_comments (card_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS card_comments_created_at_idx    ON card_comments (created_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS events_created_at_idx ON events (created_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS events_type_idx       ON events (type);

CREATE INDEX CONCURRENTLY IF NOT EXISTS dock_commands_created_at_idx ON dock_commands (created_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS focus_sessions_state_idx       ON focus_sessions (state);
CREATE INDEX CONCURRENTLY IF NOT EXISTS focus_sessions_started_at_idx  ON focus_sessions (started_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS knowledge_entries_project_id_idx     ON knowledge_entries (project_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS knowledge_entries_category_idx       ON knowledge_entries (category);
CREATE INDEX CONCURRENTLY IF NOT EXISTS knowledge_entries_status_idx         ON knowledge_entries (status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS knowledge_entries_updated_at_idx     ON knowledge_entries (updated_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS knowledge_entries_source_task_id_idx ON knowledge_entries (source_task_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS knowledge_entries_tags_gin_idx       ON knowledge_entries USING GIN (tags);

CREATE INDEX CONCURRENTLY IF NOT EXISTS suggestion_feedback_project_id_idx ON suggestion_feedback (project_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS suggestion_feedback_task_id_idx    ON suggestion_feedback (task_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS suggestion_feedback_decision_idx   ON suggestion_feedback (decision);
CREATE INDEX CONCURRENTLY IF NOT EXISTS suggestion_feedback_created_at_idx ON suggestion_feedback (created_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS system_insights_project_id_idx ON system_insights (project_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS system_insights_task_id_idx    ON system_insights (task_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS system_insights_type_idx       ON system_insights (type);
CREATE INDEX CONCURRENTLY IF NOT EXISTS system_insights_status_idx     ON system_insights (status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS system_insights_created_at_idx ON system_insights (created_at);
```

---

## 4. Tuning opcional: `jsonb_path_ops`

Drizzle genera GIN con la operator class por defecto (`jsonb_ops`), que
indexa todas las claves y valores. Para los casos `tags @> '[...]'::jsonb`
basta con `jsonb_path_ops`, que produce índices **más pequeños y rápidos**
para containment puro:

```sql
DROP INDEX IF EXISTS tasks_tags_gin_idx;
CREATE INDEX CONCURRENTLY tasks_tags_gin_idx
  ON tasks USING GIN (tags jsonb_path_ops);

DROP INDEX IF EXISTS knowledge_entries_tags_gin_idx;
CREATE INDEX CONCURRENTLY knowledge_entries_tags_gin_idx
  ON knowledge_entries USING GIN (tags jsonb_path_ops);
```

No es bloqueante para Fase 4A.5. Aplicar cuando el volumen de tasks o
knowledge_entries justifique el ajuste.

---

## 5. Verificación post-aplicación

```sql
-- Verificar que los índices existen
SELECT schemaname, tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- Verificar uso después de cargar producción durante unos días
SELECT relname AS table, indexrelname AS index, idx_scan AS scans
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

Si algún índice queda con `idx_scan = 0` durante semanas, es candidato a
`DROP INDEX` — pero no antes de Fase 8 (telemetría de uso).

---

## 6. Lo que NO se agregó (por diseño)

- **Índices compuestos** (`(project_id, updated_at)` etc). Postgres combina
  índices vía bitmap, y agregar compuestos sin medir puede degradar
  escrituras sin ganar lectura. Revisar tras tener datos reales y
  `EXPLAIN ANALYZE` sobre queries calientes.
- **Índices funcionales** (`LOWER(title)`, etc). Las consultas usan `ILIKE`,
  que en Postgres puede usar `pg_trgm` con índice GIN/GiST. Postponer hasta
  que la búsqueda full-text sea un cuello real (Fase posterior).
- **Índices en `projects`**. `id` (PK) y `slug` (UNIQUE) ya están cubiertos.
- **Índices en `events.taskId` / `events.projectId`**. Esas columnas **no
  existen** en el schema actual; la spec las listaba como hipótesis. No se
  agregaron índices para columnas inexistentes.
- **`CREATE INDEX CONCURRENTLY` en la migración Drizzle**. drizzle-kit
  envuelve migraciones en una transacción, donde `CONCURRENTLY` no es
  válido. Para producción usar Opción C de §3.

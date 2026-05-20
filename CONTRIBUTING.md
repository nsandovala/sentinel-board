# Contributing to Sentinel Board

Gracias por tu interes en contribuir. Este documento explica como hacerlo de forma efectiva.

## Quick Start para desarrollo

```bash
git clone https://github.com/tu-usuario/sentinel-board.git
cd sentinel-board
npm install
npm run db:push && npm run db:seed
npm run dev
```

## Stack

- **Next.js 16** (App Router, TypeScript strict, Turbopack)
- **PostgreSQL (Neon) + Drizzle ORM**
- **Tailwind CSS 4** + shadcn/ui
- **@dnd-kit** para drag & drop
- **Zod** para validación server-side

## Estructura clave

```
app/api/          → API routes (REST). Body validado con Zod.
components/       → React components
lib/state/        → Reducer + Context (UI state, resync en error de persistencia)
lib/db/           → Schema + queries (Postgres / Neon)
lib/ai/           → AI router (Ollama → OpenRouter → Anthropic → heurístico)
lib/ai/models.ts  → Source of truth de modelos válidos por provider
lib/agents/       → Agent definitions + execution
lib/validation/   → Schemas Zod reutilizables
lib/server/       → Helpers de server (assemble-card, request-guard, sync-bus)
```

Antes de cambios no triviales, revisar [`AGENT.md`](AGENT.md) — son las
reglas operacionales que aplican a humanos y agentes IA por igual.

## Convenciones

### Commits

Usamos [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(scope): add new feature
fix(scope): fix bug
docs: update readme
refactor(scope): improve code without changing behavior
```

### Codigo

- TypeScript strict — no `any` sin justificacion
- Componentes: functional + hooks
- Estado UI: `useSentinel()` + `useSentinelDispatch()`
- Persistencia: siempre via API routes, nunca DB directa desde cliente

### Estilos

- Tailwind utility classes
- CSS custom properties en `globals.css` para theming
- Preferir clases semanticas (`sentinel-*`) para componentes complejos

## Workflow

1. Fork el repo
2. Crea branch: `git checkout -b feat/mi-feature`
3. Desarrolla con `npm run dev`
4. Verifica tipos: `npx tsc --noEmit`
5. Commit con mensaje convencional
6. Push y abre PR

## Areas donde ayudar

- [ ] Tests (aun no hay — Jest + Testing Library seria ideal)
- [ ] Touch support para drag & drop
- [ ] PWA / modo offline
- [ ] Internacionalizacion (i18n)
- [ ] Documentacion de agentes

## Preguntas

Abre un issue o discusion en GitHub.

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

- **Next.js 16** (App Router, TypeScript strict)
- **SQLite + Drizzle ORM** (local-first)
- **Tailwind CSS 4** + shadcn/ui
- **@dnd-kit** para drag & drop

## Estructura clave

```
app/api/          → API routes (REST)
components/       → React components
lib/state/        → Reducer + Context (UI state)
lib/db/           → Schema + queries (persistence)
lib/ai/           → AI router (Ollama → OpenRouter → Anthropic)
lib/agents/       → Agent definitions + execution
```

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

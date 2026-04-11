# Documentacion de Proyectos — Sentinel Board

Repositorio central de documentacion operativa para todos los proyectos gestionados en Sentinel Board.

## Estructura

```
docs/
  projects/
    tbb-amon-delivery/     → TBB Bot, delivery, Firebase sync
    sentinel-board/        → Este proyecto (board, persistencia, agentes)
    amon-agents/           → Agentes autonomos, outputs, pipelines
    amon-website/          → Website corporativo AMON
    jarvis-sentinel/       → Jarvis core, orquestacion
```

## Convenciones

- Cada proyecto tiene su carpeta en `docs/projects/<slug>/`
- Los resumenes ejecutivos van como `resumen-<tema>-<fecha>.md`
- Los ADRs (Architecture Decision Records) van como `adr-<numero>-<titulo>.md`
- Los postmortems van como `postmortem-<fecha>-<titulo>.md`

## Que guardar aqui

| Tipo | Ejemplo |
|------|---------|
| Resumenes ejecutivos | Lo que se hizo, decisiones, estado actual |
| ADRs | Por que se eligio SQLite en vez de Postgres |
| Postmortems | Que fallo, por que, como se arreglo |
| Handoffs | Contexto para retomar trabajo despues de una pausa |
| Specs tecnicas | Contratos de API, schemas, flujos |

## Que NO guardar aqui

- Credenciales o secrets (van en `.env`)
- Codigo ejecutable (va en `lib/`, `app/`, etc.)
- Documentacion auto-generada (va en `.next/`, `drizzle/`)

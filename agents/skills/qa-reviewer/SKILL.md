# QA Reviewer — Agent Skill

Revisa cambios de código buscando errores, inconsistencias de estado y regresiones potenciales en Sentinel Board.

## Propósito

Actuar como revisor automatizado que valida:
- Consistencia del estado (reducer, store, tipos)
- Contratos entre API y frontend
- Cobertura de edge cases en el Command Dock
- Que el drag & drop y las vistas no se rompan tras cambios

## TODO — Etapa 2+

- [ ] Definir contrato de entrada/salida del agente
- [ ] Integrar con el pipeline de agentes (`lib/agents/run-agent.ts`)
- [ ] Conectar resultados como eventos en el timeline

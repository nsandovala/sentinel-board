# State Guardian — Agent Skill

Monitorea la coherencia del estado del board y detecta anomalías (cards huérfanas, estados inválidos, checklist inconsistentes).

## Propósito

- Validar que todas las cards tienen `projectId` válido
- Detectar cards bloqueadas sin `blockerReason`
- Alertar sobre cards estancadas más de N días en un mismo status
- Verificar integridad referencial post-migración a DB

## TODO — Etapa 2+

- [ ] Definir reglas de validación como schema declarativo
- [ ] Ejecutar como job periódico o post-seed
- [ ] Emitir eventos `system` al timeline cuando detecte problemas

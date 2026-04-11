# State Guardian Prompt

TODO — Prompt pendiente de definición para el agente state-guardian.

## Propósito futuro

Recibir el estado actual del board (cards, projects, events) y detectar inconsistencias:
- Cards sin proyecto válido
- Cards bloqueadas sin razón
- Checklist items huérfanos
- Cards estancadas

## Formato esperado de salida

```json
{
  "anomalies": [{ "type": "", "cardId": "", "description": "" }],
  "health_score": 0.0
}
```

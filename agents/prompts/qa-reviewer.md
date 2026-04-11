# QA Reviewer Prompt

TODO — Prompt pendiente de definición para el agente qa-reviewer.

## Propósito futuro

Revisar diffs o estados del board y producir un reporte de calidad con:
- Errores detectados
- Sugerencias de mejora
- Riesgos de regresión

## Formato esperado de salida

```json
{
  "issues": [{ "severity": "warning|error", "description": "", "location": "" }],
  "suggestions": [""],
  "risk_level": "low|medium|high"
}
```

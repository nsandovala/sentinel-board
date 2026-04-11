# Planner — Agent Skill

Convierte ideas difusas o texto libre en planes estructurados y accionables para el board.

## Propósito

- Recibir texto libre del usuario (vía Command Dock → Analizar)
- Producir JSON con: summary, objective, hypothesis, risks, next_steps, backlog_tasks, codex_loop
- Alimentar la creación de cards y el panel Codex Loop

## Contrato de salida

```json
{
  "summary": "",
  "objective": "",
  "hypothesis": "",
  "risks": [],
  "next_steps": [],
  "backlog_tasks": [],
  "codex_loop": {
    "problem": "",
    "objective": "",
    "hypothesis": "",
    "solution": "",
    "validation": "",
    "next_step": ""
  }
}
```

## Flujo actual

1. Usuario escribe texto → click Analizar
2. POST /api/agents/run { agent: "planner", input }
3. ai-router: Ollama → OpenRouter → fallback heurístico
4. Resultado mostrado en AnalysisPreview
5. Acciones: crear cards, copiar informe

# Backlog Inteligente — Documentación de Implementación

> Última actualización: 2026-04-14  
> Estado: **COMPLETO** (Fase A + Fase B)

## Resumen

El "Backlog Inteligente" transforma la vista de backlog de pasiva a activa, con scoring automático y análisis por IA.

---

## Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                        FASE A (offline)                         │
├─────────────────────────────────────────────────────────────────┤
│  lib/scoring/backlog-scorer.ts                                  │
│    ├── scoreBacklogCard()      → calcula score 0-100            │
│    ├── scoreAndSortBacklog()   → ordena cards por score         │
│    ├── hasHighPriorityBacklogItems() → badge trigger            │
│    └── highPriorityBacklogCount()    → número para badge        │
│                                                                 │
│  Fórmula: score = age×0.35 + project×0.40 + urgency×0.25        │
│    - ageScore: 0→100 linear en 90 días                          │
│    - projectScore: 100 si proyecto tiene cards en progreso      │
│    - urgencyScore: 100 si tags urgentes/bloqueado, 50 si high   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        FASE B (con IA)                          │
├─────────────────────────────────────────────────────────────────┤
│  agents/definitions/backlog-analyzer.yaml                       │
│  lib/agents/load-agent.ts (registro "backlog-analyzer")         │
│                                                                 │
│  Flujo:                                                         │
│    1. Usuario clic "Analizar Backlog"                           │
│    2. POST /api/agents/run { agent: "backlog-analyzer", ... }   │
│    3. ai-router: Ollama → OpenRouter → Anthropic → heurístico   │
│    4. Respuesta: { suggestions: [...], reasoning: "..." }       │
│    5. UI muestra panel con botones "Promover"                   │
│    6. Promover → dispatch MOVE_CARD → card pasa a en_proceso    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Archivos Clave

| Archivo | Propósito |
|---------|-----------|
| `lib/scoring/backlog-scorer.ts` | Lógica de scoring (FASE A) |
| `agents/definitions/backlog-analyzer.yaml` | Definición del agente (FASE B) |
| `lib/agents/load-agent.ts` | Registro de agentes (incluye backlog-analyzer) |
| `components/board/board-view.tsx` | UI de BacklogView con análisis |
| `components/layout/app-sidebar.tsx` | Badge de alta prioridad en nav |

---

## Contrato del Agente backlog-analyzer

**Inputs:**
```typescript
{
  cards: Array<{
    id, title, description, status, projectId, 
    tags, blocked, priority, createdAt,
    score, ageScore, projectScore, urgencyScore
  }>,
  activeProject: { id, name } | null,
  allProjects: Array<{ id, name }>
}
```

**Outputs:**
```typescript
{
  suggestions: Array<{
    cardId: string,
    title: string,
    justification: string
  }>,  // máximo 3
  reasoning: string
}
```

---

## Notas para Futuras Sesiones

1. **El scoring funciona 100% offline** — no depende de IA.

2. **El análisis de IA es opcional** — si no hay proveedores, el botón falla graciosamente con mensaje de error.

3. **Para modificar los pesos del scoring**, editar las constantes en `backlog-scorer.ts`:
   ```typescript
   const AGE_WEIGHT = 0.35;
   const ACTIVE_PROJECT_WEIGHT = 0.4;
   const URGENCY_WEIGHT = 0.25;
   ```

4. **Para agregar nuevos tags de urgencia**, editar `URGENCY_TAGS` en `backlog-scorer.ts`.

5. **El threshold del badge** (default 70) se puede ajustar en las llamadas a `hasHighPriorityBacklogItems()` y `highPriorityBacklogCount()`.

---

## Testing Manual

1. Crear varias cards en estado `idea_bruta` con diferentes edades
2. Verificar que aparecen ordenadas por score en la vista Backlog
3. Verificar que el badge rojo aparece en el sidebar si hay cards ≥70
4. Clic "Analizar Backlog" (requiere Ollama corriendo o API keys)
5. Verificar que las sugerencias aparecen y el botón "Promover" funciona

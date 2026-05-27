# Sentinel Board + AMON Agents — Plan Operativo MVP

> Contexto estratégico y roadmap por sprints para transformar Sentinel Board en un cockpit operativo diario conectado a AMON Agents.

---

## 0. Decisión de arquitectura

### Roles del ecosistema

| Sistema | Rol |
|---------|-----|
| **AMON Agents / AMON CLI** | Runtime operativo de agentes |
| **Sentinel Board** | Memoria operacional + cockpit visual |
| **Neon / PostgreSQL** | Fuente única de verdad |
| **HEO Copilot** | Capa humana de asistencia, voz y notificaciones |
| **AMON Agents Extension** | Visualizador futuro tipo Pixel/VS Code |

### Principio clave

SB no debe convertirse en un monstruo que hace todo.

- **SB gobierna, visualiza y coordina.**
- **AA ejecuta, analiza y genera outputs.**
- **HEO Copilot comunica, resume y guía.**

---

## 1. Fase UX urgente — Operational Cockpit v0.3

### Objetivo
Reducir fricción visual y transformar SB en un workspace operacional cómodo para uso diario.

### Prioridades

#### Deep-link real de cards
- `/board?card=<id>`
- Scroll automático
- Highlight temporal
- Panel derecho abierto

#### Topbar clara
- Search
- Filters
- Command Palette
- Quick Create

#### Filtros oscuros compactos
- Eliminar modal blanco
- Usar popover dark/glass
- Chips activos y botón "clear all"

#### HEO Copilot Dock como única superficie operacional
Sin terminal paralela. Modos internos del dock:
- `EXECUTE`
- `ANALYZE`
- `FOCUS`
- `RUNTIME`

Input compartido (`CopilotInput`) abajo, output arriba, contexto HEO en el
right panel. Una sola superficie, un solo state machine.

#### Right Panel modular
- Codex Loop
- Código del Dinero
- Metadata AMON
- Timeline
- Comentarios
- Acciones sugeridas

#### Modo visual grafito / negro mate
- Reducir exceso de glass para modo dev
- Mantener glass premium para modo usuario/demo
- Crear tokens visuales:
  - `theme=dev-matte`
  - `theme=demo-glass`

### Criterio de éxito
SB debe sentirse como:
> **Linear + Cursor + Raycast + VS Code Panel System**
> No como dashboard SaaS genérico.

---

## 2. Fase funcional SB — Navegación, backlog y timeline

### Objetivo
Que SB no solo muestre información, sino que permita actuar rápido.

### Mejoras mínimas

#### Backlog inteligente
Agrupar por:
- impacto
- riesgo
- quick wins
- automation
- strategic fit

El botón "Abrir en board" debe enfocar la card real.

#### Timeline 2.0
Pasar de log plano a activity stream.

Cada evento debe mostrar:
- actor
- icono
- acción
- timestamp
- link a card

Ideal: guardar `taskId` en `events` para no depender de heurísticas por título.

#### Acciones sugeridas ejecutables
Cada sugerencia debe tener:
- label
- razón
- comando
- botón copiar
- botón ejecutar

---

## 3. Fase AA — Comandos operativos

### Estado actual
Ya existen o están estabilizados:
- `amon doctor`
- `amon run`
- `amon push`
- `amon status`

### Siguientes comandos

#### `amon ingest`
Convierte documentos `.md` en cards de SB.

```bash
amon ingest ./docs/ROADMAP.md --project amon-agents
```

Uso:
- roadmap
- ideas
- auditorías
- propuestas
- documentos de arquitectura

#### `amon scan`
Escanea un repo y detecta estado técnico.

```bash
amon scan --repo ../sentinel-board
```

Debe detectar:
- stack
- scripts
- dependencias
- TODO/FIXME
- archivos críticos
- riesgos visibles

#### `amon audit`
Auditoría más profunda.

```bash
amon audit --repo ../sentinel-board --focus security
amon audit --repo ../sentinel-board --focus architecture
```

Debe generar:
- reporte
- riesgos
- checklist
- cards en SB

### Después
Mejorar provider manager:
- Ollama
- OpenRouter
- Gemini
- OpenAI
- Anthropic
- LM Studio

Con:
- healthcheck
- fallback explícito
- circuit breaker
- timeout
- diagnóstico por `amon doctor`

---

## 4. Fase voz — HEO Copilot real

### Objetivo
Convertir HEO Copilot en una capa de voz operativa para SB.

### Capacidades

#### STT — voz a texto
Usuario dicta comandos o ideas.

> "HEO, analiza esta idea y crea una card en AMON Agents."

#### TTS — texto a voz
SB responde con voz.

> "Nelson, hay tres tareas críticas. La más rentable es implementar ingest markdown."

#### Notificaciones por voz
En vez de solo push notifications.

Categorías:
- crítica
- alta
- media
- informativa

#### Resumen hablado
Al iniciar sesión:
> "Hoy tienes 2 tareas críticas, 1 bloqueo y 3 quick wins."

#### Modo foco
Avisos suaves:
- inicio
- pausa
- término
- bloqueo
- siguiente paso

### Proveedores posibles
- OpenAI / Whisper o Speech-to-Text para transcripción.
- ElevenLabs TTS para voz natural.
- Ollama/local para razonamiento cuando no se requiera nube.
- Fallback navegador: Web Speech API para pruebas simples.

### MVP recomendado
Primero no hacer voz conversacional completa.

Implementar:
```
eventos SB → texto breve → TTS → audio notification
```

Ejemplos:
- `CARD_BLOCKED` → "La tarea X quedó bloqueada por falta de validación."
- `TASK_HIGH_SCORE` → "Hay una tarea con alto Código del Dinero lista para priorizar."
- `FOCUS_DONE` → "Sesión de foco terminada. Siguiente acción sugerida disponible."

### No hacer todavía
- Voice agent full duplex
- Conversaciones largas
- Clonación de voz
- Voz siempre activa
- Comandos destructivos por voz

> Primero voz como copiloto de notificaciones y resúmenes.

---

## 5. Fase observabilidad

### Objetivo
Saber si el sistema está sano.

### Status bar mínima
```
NEON ●    RENDER ●    OLLAMA ●    SB API ●    AA ●    VOICE ●
```

### Endpoints
- `/api/health`
- `/api/providers/status`
- `/api/agents/status`
- `/api/voice/status`

### Mostrar
- conectado
- degradado
- caído
- último error
- latencia aproximada

---

## 6. Fase seguridad

### Orden correcto
No meter auth antes de estabilizar UX y flujo.

### Después implementar
- Login
- Sesión
- Protección de escritura
- Roles mínimos
- Audit logs
- Tokens rotables para AA
- Secrets seguros

### MVP
- login simple
- proteger rutas críticas
- mantener modo dev local sin fricción

---

## 7. Fase futura — AMON Agents Extension

### No iniciar hasta que
- SB tenga UX estable
- AA tenga event stream
- `amon ingest`, `scan`, `audit` estén definidos
- los eventos de agentes estén tipados

### Flujo futuro
```
AMON Agents emite eventos
  ↓
~/.amon/events.jsonl o SSE/WebSocket
  ↓
AMON Agents Extension
  ↓
visualización live tipo Pixel
```

---

## Roadmap por Sprints

| Sprint | Enfoque | Entregables clave |
|--------|---------|-------------------|
| **Sprint 1** | SB UX urgente | Deep-link cards, filtros dark, topbar clara, HEO Copilot Dock como única superficie operacional, right panel modular, modo grafito/negro mate |
| **Sprint 2** | SB funcional | Backlog agrupado, timeline 2.0, acciones sugeridas ejecutables, status bar infraestructura |
| **Sprint 3** | AA commands | `amon ingest`, `amon scan`, `amon audit`, provider manager |
| **Sprint 4** | Voice MVP | Eventos → notificación hablada, TTS configurable, categorías de prioridad, modo foco con voz |
| **Sprint 5** | Seguridad | Login, tokens rotables, audit logs, health checks protegidos |
| **Sprint 6** | Extension | Event stream, VS Code panel, agentes vivos, integración visual |

---

## Decisión inmediata

La fase de mayor prioridad es:

> **Sprint 1 — SB UX urgente**

Porque el motor ya existe, pero la experiencia visual todavía debe convertirse en un cockpit usable todos los días.

Después:
1. SB funcional
2. AA ingest/scan/audit
3. Voz MVP
4. Seguridad
5. Extensión

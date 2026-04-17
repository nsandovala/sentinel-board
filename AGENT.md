## Sentinel Board - DocumentaciÃ³n para Agentes de Desarrollo

Este archivo serve como el "contrato de arquitectura" para todos los agentes que asisten el desarrollo de este workspace. Define las reglas de interacciÃ³n, componentes, y protocolos de comunicaciÃ³n entre los distintos mÃ³dulos del proyecto.

Su objetivo es garantizar que el trabajo sea cohesivo, desacoplado y productivo.

---

## I. VisiÃ³n General

**Sentinel Board** es una plataforma de gestiÃ³n de conocimiento y proyectos en tiempo real que visualiza el flujo de trabajo de las ideas y decisiones. Su enfoque no es solo cosÃ©tico, sino **productivo**, integrando acciones concretas y logs de actividad para mantener transacciones de conocimiento estructuradas.

**Principios GuaÃºa:**
1. **Desacoplamiento Total:** NingÃºn mÃ³dulo debe tener conocimiento directo de la implementaciÃ³n interna de otro mÃ³dulo (ej. el Board no debe hablar con la base de datos del Log).
2. **Unidireccionalidad del Flujo de Datos (State Flow):** El flujo debe ser: `User Action` -> `Service Layer` -> `Store Mutation` -> `Event Emission` -> `Component Reaction`.
3. **Escalabilidad:** La arquitectura debe soportar la integraciÃ³n de IA (LLM) sin requerir reestructuraciones masivas.

---

## II. Arquitectura de Componentes y Datos

### 1. Estado Central (The Source of Truth)
**Componente:** `BoardStore` (Gestiona el estado global del `Board`).
**FunciÃ³n:** Es Ãºnico lugar que puede mutar el estado de las `Cards` y del `Board`. Debe ser el centro de cualquier acciÃ³n de negocio (Mover, Eliminar, Comentar).
**Mecanismo:** Debe emitir **Eventos** para notificar a los *Subscribidores* (UI Components) de cualquier cambio crÃ­tico (`CARD_DELETED`, `CARD_MOVED`, `COMMENT_ADDED`, `ACTIVITY_UPDATED`).

### 2. MÃ³dulos (View Components)
**A. Board View (Canvas):** Componente responsable del renderizado de las Cards. Solo debe *escuchar* los eventos del `BoardStore` y gestionar su propia UI local (ej. el estado de *draggeable*).

**B. Right Panel (Side Panel):** Subsistema de consumo. Debe *suscribirse* a eventos especÃ­ficos (`COMMENT_ADDED`, `ACTIVITY_LOGGED`) para renderizar los comentarios e historial. Es totalmente reactivo.

**C. Command Dock:** Subsistema de input. Su funciÃ³n es validar y transformar la entrada del usuario en una **AcciÃ³n de Negocio** que es enviada al *Service Layer*.

### 3. Servicios deDominio (Service Layer)
**`ActivityService.ts`:**
- **Responsabilidad:** Gestionar la lÃ³gica de creaciÃ³n y almacenamiento de `Comments` y `ActivityLogs` (la lÃ³gica de negocio de "quiÃ©n hizo quÃ©").
- **Inputs:** `(cardId, type, body, author)`
- **Outputs:** EmisiÃ³n de eventos de tipo `COMMENT_ADDED` o `ACTIVITY_LOGGED` al `BoardStore`.

**`TerminalService.ts`:**
- **Responsabilidad:** Aislar por completo la ejecuciÃ³n de comandos. Esto incluye el manejo de logs, el prompt y el aislamiento de las llamadas a herramientas externas (ej. Ollama).
- **Aislamiento:** No debe interactuar con el `BoardStore`. Su estado debe ser completamente autÃ³nomo.

---

## III. Estructura de Datos (Schemas)

| Tipo | Campo | Tipo de Datos | Obligatorio | Observaciones |
| :---: | :--- | :--- | :---: | :--- |
| **Card** | `id` | UUID | SÃ | Identificador Ãºnico de la tarjeta. |
| | `status` | Enum | SÃ | Estado de la tarjeta. |
| | `notes` | String | SÃ | Notas de la tarjeta. |
| | `owner` | String | SÃ | Usuario responsable. |
| **Comment/Action** | `id` | UUID | SÃ | |
| | `cardId` | UUID | SÃ | Referencia a la tarjeta asociada. |
| | `author` | String | SÃ | Usuario que generÃ³ el evento. |
| | `body` | String | SÃ | Contenido del mensaje o acciÃ³n. |
| | `type` | Enum | SÃ | `comment`, `decision`, `system`, `agent`. |
| | `createdAt` | DateTime | SÃ | Timestamp del evento. |

---

## IV. Protocolos de InteracciÃ³n

Cada agente o mÃ³dulo debe seguir estos patrones de interacciÃ³n:

### 1. Modificar el Estado
**Regla de Oro:** Nunca modificar el estado directamente. Siempre a travÃ©s del `BoardStore.mutate(action)`.

### 2. Leer el Estado
Los componentes UI deben *escuchar* los eventos o *buscar* directamente en el estado global del `store`, nunca hacer llamadas a API directas para leer datos que ya estÃ¡n en memoria.

### 3. Manejo de Errores
Las acciones que alteran el estado (`BOARD_STORE`) deben tener la posibilidad de revertir la transacciÃ³n en caso de error.

---

## V. Estructura de Directorios (Propuesta)

```
src/
â store/
â store.boardStore.ts
â store.actions.ts
â store.types.ts
â services/
â services.activityService.ts
â services.terminalService.ts
â components/
â components.board/
â components.rightPanel/
â components.terminal/
```

---

## VI. Checklist de ValidaciÃ³n

Antes de realizar cambios, asegÃ¼rese de:

1. **Desacoplamiento:** Â¿El cambio afecta a la lÃ³gica de otros mÃ³dulos de forma directa?
2. **Eventos:** Â¿Se estÃ¡ usando el sistema reactiva para notificar cambios?
3. **Datos:** Â¿Se estÃ¡ utilizando la estructura definida en los Schemas?
4. **UI vs LÃ³gica:** Â¿No se estÃ¡ mezclando lÃ³gica de estado con lÃ³gica de presentaciÃ³n?

---

*Documento generado automÃ¡ticamente por el CTO (AI Model)*

# SEC-SB-AUTH-01 — Clerk y autorización de propietario único

Base: `d4d08d79c16f4e65dea0e2d332df8f9ceb91da4e`. Implementación local;
no implica aprobación de commit, PR, deploy, migraciones ni uso de credenciales reales.

## Identidad y denegación predeterminada

Clerk verifica criptográficamente la sesión. El proxy configura `authorizedParties`
desde `CLERK_AUTHORIZED_PARTIES`; cada handler vuelve a comprobar identidad
antes de leer body, PostgreSQL, NDJSON o AA Ops. Se aceptan solo session tokens,
con usuario, sesión, expiración y `azp` válidos. Una sesión pendiente no autoriza.
El propietario se compara por ID estable, nunca por email, cabeceras de red
o un rol enviado por el cliente. Otros usuarios autenticados reciben 403;
anónimos, sesiones inválidas y expiradas reciben 401.

El layout del dashboard comprueba la sesión antes de montar el shell actual.
El propietario conserva la UI; un usuario ajeno ve acceso denegado y cierre
de sesión. Sin sesión se redirige a `/sign-in`. Clerk maneja ingreso y salida.
No hay RBAC general, multi-workspace ni cambios de schema.

## Variables (solo nombres, sin credenciales)

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`: clave publicable de la instancia elegida.
- `CLERK_SECRET_KEY`: clave exclusivamente server-side.
- `AMON_OWNER_CLERK_USER_ID`: propietario único.
- `CLERK_AUTHORIZED_PARTIES`: lista separada por comas de orígenes exactos,
  sin paths, credenciales, queries o fragmentos. HTTPS obligatorio en producción;
  HTTP solo loopback fuera de producción. Ausencia o formato inválido cierra el acceso.
- `AMON_IMPORT_TOKEN`: secreto server-side para importación AA.
- `SENTINEL_API_TOKEN`: credencial legacy opcional durante rotación.
- `AMON_EVENTS_PATH`, `AMON_OPS_SNAPSHOT_URL`, `DATABASE_URL`: contratos existentes,
  sin cambios de valores ni acceso a su configuración privada en esta validación.

Sin claves explícitas, el proxy responde 503 y el layout no monta ClerkProvider;
se evita el aprovisionamiento automático keyless de desarrollo del SDK.
Se conserva `.env.example`. Las claves privadas nunca llevan prefijo
`NEXT_PUBLIC_`. No derivar orígenes autorizados del Host o de forwarded headers.
Next normaliza loopback IP a localhost; la comparación contempla esa
representación solo después de validar exactamente el Origin contra la lista.

## Matriz de métodos

| Ruta | Métodos humanos (solo propietario) | Servicio AA |
|---|---|---|
| `/api/tasks` | GET, POST | Denegado |
| `/api/tasks/[id]` | PATCH, DELETE | Denegado |
| `/api/tasks/[id]/comments` | GET, POST | Denegado |
| `/api/projects` | GET | Denegado |
| `/api/events` | GET, POST | Denegado |
| `/api/knowledge` | GET, POST | Denegado |
| `/api/search` | GET | Denegado |
| `/api/feedback` | GET, POST | Denegado |
| `/api/insights` | GET, PATCH | Denegado |
| `/api/insights/run` | POST | Denegado |
| `/api/focus-sessions` | GET, POST | Denegado |
| `/api/dock-commands` | GET, POST | Denegado |
| `/api/stream` | GET | Denegado |
| `/api/runtime/events` | GET | Denegado |
| `/api/runtime/ops` | GET + loopback, fuera de producción | Denegado |
| `/api/agents/run` | POST | Denegado |
| `/api/copilot/respond` | POST | Denegado |
| `/api/root-cause` | POST | Denegado |
| `/api/agents/import` | Denegado | POST |

Total: 19 rutas, 28 handlers explícitos. Métodos no listados, incluidos
HEAD/OPTIONS automáticos del framework, y rutas desconocidas se deniegan en
el proxy. Toda mutación humana requiere Origin autorizado coincidente con
el destino y Sec-Fetch-Site ausente o same-origin. Host, X-Forwarded-For y
X-Real-IP no conceden identidad ni permisos.

## Transición del consumidor AA

AA conserva `SENTINEL_BOARD_AGENT_TOKEN` y `Authorization: Bearer`.
Configurar el mismo secreto como `AMON_IMPORT_TOKEN` en SB. No cambia el payload:
`externalTaskId` ni la respuesta `ok/received/taskId/message`. Este endpoint
sigue siendo recepción/validación/log, sin persistencia en DB.

Durante rotación, SB acepta tanto el nuevo Bearer como el antiguo
`SENTINEL_API_TOKEN`, exclusivamente para POST import. El encabezado legacy
`x-sentinel-token` solo admite el secreto antiguo. Dos encabezados de
credenciales simultáneos se rechazan; una credencial inválida nunca cae a una
sesión humana. Retirar la variable legacy después de migrar el consumidor.
El viejo permiso de escritura general con token o localhost desaparece
intencionalmente. Consumidores sin token obtienen 401; no se conserva un bypass.

## Runtime y sesión

El puente Ops mantiene URL exacta de loopback, bloqueo en producción,
normalización, límites de tamaño y timeout. La identidad se comprueba antes
de evaluar Host. Los cinco archivos P2 permanecen iguales a main.
El Dock y NDJSON mantienen su contrato visual y operacional.

El SSE se cierra al expirar el JWT o a los 60 segundos como máximo; EventSource
reconecta con nueva autorización. Abort/cancel limpia listeners y temporizador.
Como ocurre con JWT verificados localmente, una copia de un token ya emitido
puede permanecer válida hasta su expiración tras un logout remoto. No se
promete revocación instantánea sin comprobación remota por solicitud.
La navegación de cierre desmonta el dashboard; cada API vuelve a verificar.

## Comparación con la rama Clerk original

Se recuperan permisos humanos/servicio, ClerkProvider, ingreso, propietario,
guards y salida. La política original cubría 27 handlers: se agrega Ops.
Se añaden validación de authorizedParties y claims, transición legacy de
importación, denegación de métodos heredados y duración acotada del SSE.
Se conserva el shell actualizado de main y sus correcciones de interacción;
no se copia la UI vieja ni se elimina .env.example. No se incorporan los
cambios originales que retiraban campos de Runtime de la interfaz.

Clerk se fija en 7.9.23, compatible por peer dependencies con Next 16.4.3
y React 19.2.3. Se inspeccionaron hooks antes de instalar; no hay nuevos
hooks de ciclo de vida. No se cambian versiones existentes deliberadamente.

## Validación y límites

`npm run test:auth` prueba la política, los 28 handlers reales con sesiones
simuladas y DB prohibida, proxy, layout, expiración, logout, origen,
spoofing, importación/rotación, Runtime/producción, NDJSON y cierre SSE.
Además usa el verificador criptográfico real de Clerk con RSA efímera,
sin red, comprobando firma, expiración y authorizedParties.

`npm run test:ops` conserva sus 13 casos; el fixture inyecta una sesión
autorizada en los tres tests de ruta sin omitir el guard.
`tsx --test lib/client/ops-polling.test.ts` conserva 20 casos.
`npm run test:ui` mantiene las 16 interacciones reales de main en Chromium;
solo el control alojado de cuenta Clerk se sustituye por un fixture sin red.
Esto no equivale a QA del flujo alojado de Clerk.

Antes de uso real: con una instancia Clerk de desarrollo autorizada, validar
ingreso propietario/ajeno, pestañas, refresh, expiración, salida, retorno a
ingreso, cookies, callback y orígenes HTTPS/locales. Probar una segunda pestaña
y reconexión SSE tras logout. Revisar configuración de registro y creación
de usuarios de la instancia Clerk. No utilizar credenciales de producción
ni conectar servicios reales sin aprobación adicional.

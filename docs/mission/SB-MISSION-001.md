# SB-MISSION-001 — Misiones de solo lectura

Base: 92b57b24d86f6c702d80da8c3f238b2a4c17e573 (autenticación de propietario ya integrada).

Se añade Misiones a Board, Timeline y Backlog. No se modifica su lógica ni se
sincronizan tarjetas. La nueva vista tiene alcance global, indicado en su título.
No incorpora acciones de aprobación, revocación, ejecución, voz ni edición.

## Fuente y límites

AA exporta el contrato `sb-mission/1` con `mission:export-board`. Este primer
adaptador representa **una inspección aislada de JARVIS-MISSION-001E** por archivo,
con seis candidatos, permisos, aprobaciones e historial de intentos. No es aún
un inventario de misiones arbitrarias o de BF/SB. La capacidad requerida proviene
del inspector fijo, nunca de instrucciones en texto.

El exportador verifica HMAC y vínculos misión/plan/base/autorización/recibo en el
host de AA. SB recibe únicamente campos permitidos: no recibe claves, texto de
misiones, identidades del sistema, rutas privadas ni registros completos.
El JSON público no lleva firma independiente: su integridad depende del archivo
local, su propietario y el directorio configurado por el operador. No pretende
proteger frente al mismo usuario del sistema o root. SB valida esquema y
consistencia; no puede autenticar una aprobación por sí mismo.

`AMON_MISSIONS_PATH` es una ruta absoluta canónica, configurada en el servidor,
a un archivo regular 0600, sin enlaces y del usuario del proceso. Su directorio
no debe permitir escritura a grupo/otros. No se acepta una ruta desde la petición.
No hay lectura del almacén privado, procesos secundarios ni solicitudes a AA.
En otro host (por ejemplo Render), debe existir una entrega segura del resumen;
esta entrega automática no forma parte del sprint. Sin configuración, el panel
muestra una fuente pendiente y no inventa progreso.

`GET /api/missions` requiere sesión de propietario con `runtime:read`, y responde
`no-store`. Tokens de integración y métodos de escritura quedan rechazados por
la política existente. Máximo 256 KiB. Un esquema inválido no se reenvía al cliente.
Se consulta cada 15 s mientras la vista está abierta; no hay peticiones solapadas,
y se cancelan al salir. Se limpian los datos anteriores si falla la lectura.

## Tiempo e historial

La hora es la de exportación, nunca se presenta como autoridad vigente. Tras cinco
minutos se avisa que el resumen es antiguo; fechas futuras fuera de una tolerancia
de 30 s se rechazan. El operador debe volver a exportar para reflejar una revocación.
La aprobación registrada y su vencimiento se muestran por separado del resultado:
una revocación no borra una inspección anterior. Un intento sin recibo completo se
muestra sin resultado verificable; una misión que declara `completed` no basta.
Todos los resúmenes tienen `executionAuthorized: false`.

## QA

- `npm run test:mission`: contrato, consistencia, archivos inseguros, frescura y renderizado.
- `npm run test:auth`: inventario de 29 handlers, acceso de propietario y denegación de tokens/métodos.
- `npm run test:ops`: compatibilidad con Runtime existente.
- `npm run test:ui`: navegador Chromium aislado, API simulada, incluye navegación,
  revocación/completado, pérdida de sesión, antigüedad y estados sin datos.
- `npx tsc --noEmit`, lint de archivos cambiados y `npm run build`.

`tests/mission/aa-export.json` fue generado por el exportador real de AA contra
un repositorio Git temporal, con confirmaciones **simuladas de prueba**. Sus
recibos no representan aprobación humana ni se usan en producción.

El QA local y los SHA exactos se registran en artefactos fuera del repositorio.
No se afirma que una prueba de navegador pasó cuando el entorno bloquea puertos.
El merge pertenece al operador.

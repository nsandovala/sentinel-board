# SB-DB-MIGRATION-CONSISTENCY

Corrección técnica acotada de 2026-11-16. No reabre SB-DB-QA-01 ni cambia
fases o prioridades. Base revisada: `e7157c617b15e82b484fce87b1b3c7e0eec015fe`.

## Dos cadenas con destinos explícitos

La configuración está en `migrations/chains.json`:

| Cadena | Carpeta | Uso permitido por el tooling incluido |
|---|---|---|
| `sb-qa-history` | `drizzle/` | Leer y comprobar el historial inmutable aplicado en QA. Sin ejecutor de escritura. |
| `fresh-disposable` | `migrations/fresh/` | Generar desde el schema y reproducir en una base PostgreSQL vacía en memoria. |

La cadena QA `0000`–`0002` ahora tiene todos sus SQL y snapshots. Se incorporan
los bytes exactos de `0002_pretty_toad.sql` y `0002_snapshot.json` preservados
en QA. No se cambia el journal, `0000`, `0001`, sus snapshots ni el ledger
remoto. Los SHA-256 de los siete archivos históricos están fijados en la
configuración y se verifican antes de cualquier prueba.

El hash de `0002` permanece
`938629cb4d087b74c91b3ca190cb876826c115964ea4ae5996179b724296cfe7`.
Sus guardas de rama Neon, wrapper y catálogo siguen intactas. Los comentarios
originales sobre preparación también se conservan para no modificar sus bytes;
SB-DB-QA-01 ya confirmó su aplicación. No es una migración universal ni una
instrucción para volver a ejecutarla. No se incluyen credenciales, catálogos
operacionales ni recibos privados; el identificador QA dentro del SQL se
conserva porque forma parte de la historia aplicada.

La cadena independiente para bases vacías se generó con la versión instalada
de Drizzle Kit desde `lib/db/schema.ts`. Tiene su propio `0000_fresh_baseline`,
journal, timestamp y snapshot raíz. No sustituye a `0002`, no se agrega al
ledger de QA y no puede usarse para actualizar bases existentes. La separación
es necesaria: la cadena QA depende de una identidad y un catálogo específicos;
una base vacía necesita crear todo el esquema, no omitir una migración histórica.

## Comandos según el entorno

```sh
npm run db:check
npm run test:migrations
npm run db:reproduce
```

- `db:check`: solo archivos. Verifica índices y timestamps del journal,
  SQL/snapshots requeridos, ascendencia de snapshots, archivos huérfanos,
  hashes históricos y lectura con `readMigrationFiles` del Drizzle instalado.
- `test:migrations`: pruebas negativas de integridad y reproducción en bases
  PGlite independientes, vacías, exclusivamente en memoria; se cierran al terminar.
- `db:reproduce`: crea una base PGlite nueva dentro del proceso, aplica solamente
  `fresh-disposable`, comprueba tablas, columnas, tipos, nulabilidad, defaults,
  índices, PK, FKs, filas vacías y ledger; repite migrate para comprobar que no
  hay una segunda aplicación y cierra la base. No recibe URL, conexión o ruta
  de datos, ni carga `.env`. Ignora `DATABASE_URL` aunque exista en el proceso.

PGlite es PostgreSQL compilado a WASM, usado aquí únicamente como dependencia
de desarrollo fijada en el lockfile. No se simula el catálogo en mocks ni se
abre un socket a Neon. La prueba demuestra reproducibilidad del esquema en
PostgreSQL embebido, no operación multiusuario, locks bajo carga ni compatibilidad
completa de servicio Neon. La base desechable local fue autorizada por Nelson.

Para generar cambios futuros de la cadena para bases vacías:

```sh
npm run db:generate
# Equivale a drizzle-kit generate --config=drizzle.fresh.config.ts
```

Esa configuración no carga credenciales y no permite por sí sola `migrate` o
`push` contra una base externa. Revisar siempre el SQL y su snapshot generado.
No generar cambios en la carpeta histórica QA. `drizzle.config.ts` y
`drizzle.config.js` rechazan destinos implícitos antes de cargar configuración
privada. `npm run db:migrate` también falla de forma explícita. Los comandos
que dependían de la configuración implícita, como `db:push` y `db:studio`, quedan
bloqueados hasta disponer de un procedimiento de entorno aprobado. El runtime
de la aplicación no cambia: estas restricciones son del tooling de migraciones.

## Integración y verificación

Los SQL/snapshots dejan de estar ignorados por Git. Deben incluirse junto con
sus journals y `migrations/chains.json` al revisar el diff; añadir solo un
journal es insuficiente. El workflow `migration-integrity.yml` comprueba la
integridad y ejecuta las pruebas en memoria en cada PR, sin secretos ni servicios
externos. La dependencia de prueba es `@electric-sql/pglite` 0.5.16; la validación
usa Drizzle ORM 0.45.2 y Drizzle Kit 0.31.10 instalados en esta revisión.

## Referencia histórica confiable (PR #8)

`db:check` exige que `sb-qa-history.immutableSha256` exista y contenga
exactamente los siete archivos históricos, con SHA-256 válidos. Quitar o
renombrar la propiedad, vaciarla o cambiar su conjunto de archivos falla.
`fresh-disposable` no necesita hashes históricos. La comprobación local del
manifiesto no es por sí sola una referencia independiente del PR.

Antes de instalar dependencias, CI compara tanto el manifiesto como los bytes
históricos con `github.event.pull_request.base.sha`. También ejecuta el
verificador de esa revisión base, no su reemplazo dentro del PR. Cambiar un SQL
y actualizar su hash en el mismo PR falla. No se usa `HEAD`, el merge sintético
ni una rama móvil como referencia confiable.

El PR #8 establece por primera vez esta referencia: su base
`e7157c617b15e82b484fce87b1b3c7e0eec015fe` aún carece del manifiesto y de los dos
artefactos de `0002`. Se cotejaron los siete hashes del commit revisado
`8a50d9d9184d6ccdb89b521878238ebeebf30535` con la copia preservada de SB-QA y,
para `0002`, con los checksums del paquete autorizado y la confirmación de COMMIT:

| Artefacto restaurado | SHA-256 autorizado |
|---|---|
| `0002_pretty_toad.sql` | `938629cb4d087b74c91b3ca190cb876826c115964ea4ae5996179b724296cfe7` |
| `meta/0002_snapshot.json` | `8a8ea47e236839c54c3603bbbf47169c26afeb388097dbe5ff68915320941667` |

Los cinco archivos ya presentes deben además coincidir byte a byte con la base.
Los recibos, catálogos y credenciales de QA permanecen privados; esta evidencia
es un cotejo de archivos locales preservados, no una nueva consulta a Neon.

Para el CI inicial, un mantenedor debe establecer **fuera del PR** la variable
de repositorio `SB_QA_HISTORY_BOOTSTRAP_COMMIT` al commit revisado completo
`8a50d9d9184d6ccdb89b521878238ebeebf30535`, después de aprobar ese cotejo.
Esta corrección local no configura la variable. Si falta, CI falla cerrado.
El verificador exige que esa referencia tenga exactamente la base como padre,
que solo se restauren los dos artefactos ausentes conocidos y que sus hashes
coincidan con sus bytes. Nunca toma el SHA inicial del checkout del PR.

Cuando la base ya contiene el manifiesto, la referencia inicial no se utiliza,
aunque la variable permanezca definida: manda exclusivamente el commit base.
Retirar la variable tras integrar el PR #8. No hay opción para omitir el control
ni aceptar hashes nuevos en un historial establecido. Los cambios del workflow
y este establecimiento inicial requieren revisión humana: un workflow editable
no sustituye las reglas de protección del repositorio.

La reproducción también contrasta cada FK con el snapshot: nombre, tabla y
columnas origen, esquema/tabla y columnas destino, `ON DELETE` y `ON UPDATE`,
preservando el orden de columnas compuestas. La regresión que cambia el SQL de
`card_comments` de `CASCADE` a `NO ACTION` debe fallar, aunque sigan existiendo
cinco FKs.

## Producción y otros entornos: pendiente

No se accedió a producción ni a Neon SB-QA durante esta corrección. No se alteró
ningún ledger. Las bases existentes no deben recibir la cadena `fresh-disposable`,
aunque un migrador por timestamps pudiera considerar su baseline como pendiente.
Antes de habilitar una migración externa se requiere inventario autorizado del
esquema e historial de ese entorno, conciliación de la `0002` histórica, un
procedimiento específico de avance y aceptación humana. No quitar guardas,
reescribir hashes, borrar entradas ni reemplazar migraciones por no-ops.

**GO para revisión de consistencia y reproducción local; NO-GO para ejecutar
cualquiera de estas cadenas en QA existente o producción.** Las pruebas locales
no constituyen aprobación de una estrategia de migración para esos destinos.

Referencias: [configuración Drizzle](https://orm.drizzle.team/docs/drizzle-config-file),
[PostgreSQL en memoria con PGlite](https://pglite.dev/docs/) y
[adaptador Drizzle](https://orm.drizzle.team/docs/connect-pglite).

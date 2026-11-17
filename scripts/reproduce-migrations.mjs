import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { checkMigrations, repositoryRoot } from "./check-migrations.mjs";

const normalizeDefault = (value) => value == null ? null : String(value).replace(/::(?:text|jsonb|integer|boolean)/g, "");

// Deliberately accepts no URL, connection, database path, or environment target.
export async function reproduceMigrations(root = repositoryRoot) {
  const checked = checkMigrations(root);
  const chain = checked["fresh-disposable"];
  const folder = resolve(root, "migrations/fresh");
  const last = String(chain.entries.length - 1).padStart(4, "0");
  const snapshot = JSON.parse(readFileSync(resolve(folder, `meta/${last}_snapshot.json`), "utf8"));
  const expectedTables = Object.values(snapshot.tables).map((table) => table.name).sort();
  const client = new PGlite(); // New empty in-memory Postgres, no socket or persistence.
  try {
    await client.waitReady;
    assert.equal((await client.query("SELECT count(*)::int AS n FROM pg_tables WHERE schemaname='public'")).rows[0].n, 0);
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: folder });
    const tables = (await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows.map((r) => r.tablename);
    assert.deepEqual(tables, expectedTables);
    const columns = (await client.query("SELECT table_name,column_name,data_type,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position")).rows;
    assert.equal(columns.length, Object.values(snapshot.tables).reduce((n, t) => n + Object.keys(t.columns).length, 0));
    for (const table of Object.values(snapshot.tables)) {
      for (const col of Object.values(table.columns)) {
        const actual = columns.find((r) => r.table_name === table.name && r.column_name === col.name);
        assert(actual, `${table.name}.${col.name} missing`);
        assert.equal(actual.data_type, col.type);
        assert.equal(actual.is_nullable, col.notNull ? "NO" : "YES");
        assert.equal(normalizeDefault(actual.column_default), normalizeDefault(col.default));
      }
    }
    const indexes = (await client.query("SELECT t.relname AS table_name,c.relname AS name,a.amname AS method,i.indisprimary AS primary,i.indisunique AS unique,i.indisvalid AS valid,i.indisready AS ready,pg_get_indexdef(i.indexrelid,1,true) AS key FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid JOIN pg_class t ON t.oid=i.indrelid JOIN pg_am a ON a.oid=c.relam WHERE t.relnamespace='public'::regnamespace ORDER BY c.relname")).rows;
    const expectedIndexes = Object.values(snapshot.tables).flatMap((t) => Object.values(t.indexes).map((i) => ({ ...i, table_name: t.name })));
    for (const index of expectedIndexes) {
      const actual = indexes.find((i) => i.name === index.name);
      assert(actual && actual.valid && actual.ready, index.name);
      assert.equal(actual.table_name, index.table_name);
      assert.equal(actual.method, index.method);
      assert.equal(actual.key, index.columns[0].expression);
      assert.equal(actual.unique, index.isUnique);
    }
    const expectedPK = Object.values(snapshot.tables).filter((t) => Object.values(t.columns).some((c) => c.primaryKey)).length;
    const expectedUnique = Object.values(snapshot.tables).reduce((n, t) => n + Object.keys(t.uniqueConstraints).length, 0);
    assert.equal(indexes.filter((i) => i.primary).length, expectedPK);
    assert.equal(indexes.length, expectedIndexes.length + expectedPK + expectedUnique);
    const actions = { a: "no action", r: "restrict", c: "cascade", n: "set null", d: "set default" };
    const fks = (await client.query(`
      SELECT c.conname AS name, source.relname AS "tableFrom", target.relname AS "tableTo",
        target_ns.nspname AS "schemaTo",
        ARRAY(SELECT a.attname FROM unnest(c.conkey) WITH ORDINALITY AS k(attnum, position)
          JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.attnum ORDER BY k.position) AS "columnsFrom",
        ARRAY(SELECT a.attname FROM unnest(c.confkey) WITH ORDINALITY AS k(attnum, position)
          JOIN pg_attribute a ON a.attrelid=c.confrelid AND a.attnum=k.attnum ORDER BY k.position) AS "columnsTo",
        c.confdeltype AS "onDelete", c.confupdtype AS "onUpdate"
      FROM pg_constraint c JOIN pg_class source ON source.oid=c.conrelid
      JOIN pg_class target ON target.oid=c.confrelid
      JOIN pg_namespace target_ns ON target_ns.oid=target.relnamespace
      WHERE source.relnamespace='public'::regnamespace AND c.contype='f'
    `)).rows.map((fk) => ({ ...fk, onDelete: actions[fk.onDelete], onUpdate: actions[fk.onUpdate] }));
    const expectedFKs = Object.values(snapshot.tables).flatMap((table) => Object.values(table.foreignKeys).map((fk) => ({
      name: fk.name, tableFrom: fk.tableFrom, tableTo: fk.tableTo, schemaTo: fk.schemaTo || "public",
      columnsFrom: fk.columnsFrom, columnsTo: fk.columnsTo,
      onDelete: (fk.onDelete || "no action").toLowerCase(), onUpdate: (fk.onUpdate || "no action").toLowerCase(),
    })));
    const byName = (a, b) => `${a.tableFrom}.${a.name}`.localeCompare(`${b.tableFrom}.${b.name}`);
    assert.deepEqual(fks.sort(byName), expectedFKs.sort(byName), "Foreign key definitions differ from snapshot");
    for (const table of tables) {
      assert(/^[a-z_]+$/.test(table));
      assert.equal((await client.query(`SELECT count(*)::int AS n FROM "${table}"`)).rows[0].n, 0);
    }
    const ledger = (await client.query("SELECT hash,created_at::text FROM drizzle.__drizzle_migrations ORDER BY created_at")).rows;
    assert.deepEqual(ledger, chain.entries.map(({ hash, when }) => ({ hash, created_at: String(when) })));
    await migrate(db, { migrationsFolder: folder });
    assert.deepEqual((await client.query("SELECT hash,created_at::text FROM drizzle.__drizzle_migrations ORDER BY created_at")).rows, ledger);
    return { result: "PASS", backend: "PGlite in-memory PostgreSQL", tables: tables.length, columns: columns.length, explicitIndexes: expectedIndexes.length, primaryKeys: expectedPK, totalIndexes: indexes.length, foreignKeys: fks.length, businessRows: 0, ledger, secondRun: "no pending migration", externalConnections: 0 };
  } finally { await client.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { console.log(JSON.stringify(await reproduceMigrations(), null, 2)); }
  catch (error) { console.error(`Disposable reproduction failed: ${error.message}`); process.exitCode = 1; }
}

import test from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { checkMigrations, repositoryRoot } from "../../scripts/check-migrations.mjs";
import { reproduceMigrations } from "../../scripts/reproduce-migrations.mjs";

function fixture(t) {
  const root = mkdtempSync(resolve(tmpdir(), "sb-migration-test-"));
  cpSync(resolve(repositoryRoot, "drizzle"), resolve(root, "drizzle"), { recursive: true });
  cpSync(resolve(repositoryRoot, "migrations"), resolve(root, "migrations"), { recursive: true });
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}
function mutateJson(file, change) {
  const value = JSON.parse(readFileSync(file)); change(value);
  writeFileSync(file, JSON.stringify(value));
}
test("both configured chains are readable with installed Drizzle", () => {
  const result = checkMigrations();
  assert.equal(result["sb-qa-history"].entries.length, 3);
  assert.equal(result["fresh-disposable"].entries.length, 1);
});
for (const name of ["drizzle/0002_pretty_toad.sql", "drizzle/meta/0002_snapshot.json", "migrations/fresh/0000_fresh_baseline.sql", "migrations/fresh/meta/0000_snapshot.json"]) {
  test(`missing ${name} fails`, (t) => {
    const root = fixture(t); rmSync(resolve(root, name));
    assert.throws(() => checkMigrations(root), /ENOENT/);
  });
}
test("modified QA-applied bytes fail even when the journal is readable", (t) => {
  const root = fixture(t), file = resolve(root, "drizzle/0002_pretty_toad.sql");
  writeFileSync(file, readFileSync(file, "utf8") + "\n-- mutation\n");
  assert.throws(() => checkMigrations(root), /Applied history changed/);
});
test("broken snapshot ancestry fails", (t) => {
  const root = fixture(t); mutateJson(resolve(root, "drizzle/meta/0002_snapshot.json"), (v) => { v.prevId = "wrong"; });
  assert.throws(() => checkMigrations(root), /Broken snapshot ancestry/);
});
test("invalid journal order and unsafe tags fail", (t) => {
  const root = fixture(t); mutateJson(resolve(root, "drizzle/meta/_journal.json"), (v) => { v.entries[2].tag = "../../escape"; });
  assert.throws(() => checkMigrations(root), /Unsafe or unordered/);
});
test("unreferenced SQL fails", (t) => {
  const root = fixture(t); writeFileSync(resolve(root, "migrations/fresh/0001_orphan.sql"), "SELECT 1;");
  assert.throws(() => checkMigrations(root), /SQL not referenced/);
});
test("implicit migrations are rejected even with a database URL", () => {
  const result = spawnSync(process.execPath, [resolve(repositoryRoot, "scripts/block-implicit-migrations.mjs")], { env: { ...process.env, DATABASE_URL: "postgresql://fixture:fixture@invalid.example/forbidden" }, encoding: "utf8" });
  assert.equal(result.status, 1); assert.match(result.stderr, /BLOCKED/);
});
test("two independent empty databases reproduce the chain and ignore ambient URLs", async () => {
  const prior = process.env.DATABASE_URL;
  process.env.DATABASE_URL = "postgresql://fixture:fixture@invalid.example/forbidden";
  try {
    const first = await reproduceMigrations(), second = await reproduceMigrations();
    assert.deepEqual(first, second);
    assert.equal(first.tables, 10); assert.equal(first.explicitIndexes, 31);
    assert.equal(first.primaryKeys, 10); assert.equal(first.externalConnections, 0);
  } finally { if (prior === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = prior; }
});
test("both default config files block implicit targets without loading credentials", () => {
  for (const name of ["drizzle.config.js", "drizzle.config.ts"]) {
    const config = readFileSync(resolve(repositoryRoot, name), "utf8");
    assert(!config.includes("dotenv"));
    assert(!config.includes("process.env"));
    assert.match(config, /throw new Error/);
  }
  const run = spawnSync(process.execPath, [resolve(repositoryRoot, "drizzle.config.js")], { encoding: "utf8" });
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /No implicit migration target/);
});
test("duplicate migration timestamps fail", (t) => {
  const root = fixture(t);
  mutateJson(resolve(root, "drizzle/meta/_journal.json"), (v) => { v.entries[2].when = v.entries[1].when; });
  assert.throws(() => checkMigrations(root), /Timestamps must increase/);
});
test("missing journal and unreferenced snapshot fail", (t) => {
  const root = fixture(t); rmSync(resolve(root, "migrations/fresh/meta/_journal.json"));
  assert.throws(() => checkMigrations(root), /ENOENT/);
  cpSync(resolve(repositoryRoot, "migrations/fresh/meta/_journal.json"), resolve(root, "migrations/fresh/meta/_journal.json"));
  cpSync(resolve(root, "migrations/fresh/meta/0000_snapshot.json"), resolve(root, "migrations/fresh/meta/0001_snapshot.json"));
  assert.throws(() => checkMigrations(root), /Snapshot not referenced/);
});
test("unaltered QA migration refuses an empty non-QA database", async () => {
  const { PGlite } = await import("@electric-sql/pglite");
  const client = new PGlite();
  try {
    const sql = readFileSync(resolve(repositoryRoot, "drizzle/0002_pretty_toad.sql"), "utf8");
    await assert.rejects(client.exec(sql), /not the authorized SB-QA/);
    assert.equal((await client.query("SELECT count(*)::int AS n FROM pg_tables WHERE schemaname='public'")).rows[0].n, 0);
  } finally { await client.close(); }
});

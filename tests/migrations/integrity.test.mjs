import test from "node:test";
import { createHash } from "node:crypto";
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

test("regression: coordinated QA SQL and manifest changes fail against trusted history", (t) => {
  const root = fixture(t);
  const trustedHistory = JSON.parse(readFileSync(resolve(repositoryRoot, "migrations/chains.json"))).chains["sb-qa-history"].immutableSha256;
  const file = resolve(root, "drizzle/0002_pretty_toad.sql");
  writeFileSync(file, readFileSync(file, "utf8") + "\n-- coordinated mutation\n");
  mutateJson(resolve(root, "migrations/chains.json"), (v) => {
    v.chains["sb-qa-history"].immutableSha256["0002_pretty_toad.sql"] = createHash("sha256").update(readFileSync(file)).digest("hex");
  });
  assert.throws(() => checkMigrations(root, { trustedHistory }), /Trusted history/);
});
for (const mutation of ["missing", "renamed", "empty", "invalid hash", "missing file", "extra file"]) {
  test(`regression: QA manifest ${mutation} fails closed`, (t) => {
    const root = fixture(t);
    mutateJson(resolve(root, "migrations/chains.json"), (v) => {
      const chain = v.chains["sb-qa-history"];
      if (mutation === "renamed") chain.renamedHashes = chain.immutableSha256;
      if (["missing", "renamed"].includes(mutation)) delete chain.immutableSha256;
      if (mutation === "empty") chain.immutableSha256 = {};
      if (mutation === "invalid hash") chain.immutableSha256["0002_pretty_toad.sql"] = "not-sha256";
      if (mutation === "missing file") delete chain.immutableSha256["0002_pretty_toad.sql"];
      if (mutation === "extra file") chain.immutableSha256["extra.sql"] = "a".repeat(64);
    });
    assert.throws(() => checkMigrations(root), /immutableSha256|Immutable history file set/);
  });
}
test("regression: changing FK CASCADE to NO ACTION fails reproduction", async (t) => {
  const root = fixture(t), file = resolve(root, "migrations/fresh/0000_fresh_baseline.sql");
  const sql = readFileSync(file, "utf8");
  const changed = sql.replace(/(card_comments_card_id_tasks_id_fk[^;]*ON DELETE )cascade/i, "$1no action");
  assert.notEqual(changed, sql, "Fixture must change the card_comments FK");
  writeFileSync(file, changed);
  await assert.rejects(reproduceMigrations(root), /Foreign key definitions differ/);
});

test("trusted history accepts unchanged files and fresh needs no historical hashes", () => {
  const config = JSON.parse(readFileSync(resolve(repositoryRoot, "migrations/chains.json")));
  assert.equal(config.chains["fresh-disposable"].immutableSha256, undefined);
  assert.equal(checkMigrations(repositoryRoot, { trustedHistory: config.chains["sb-qa-history"].immutableSha256 })["sb-qa-history"].entries.length, 3);
});
for (const field of ["tableFrom", "columnsFrom", "tableTo", "columnsTo", "onUpdate"]) {
  test(`foreign key ${field} must match the snapshot`, async (t) => {
    const root = fixture(t);
    mutateJson(resolve(root, "migrations/fresh/meta/0000_snapshot.json"), (v) => {
      const fk = v.tables["public.card_comments"].foreignKeys.card_comments_card_id_tasks_id_fk;
      fk[field] = { tableFrom: "tasks", columnsFrom: ["id"], tableTo: "projects", columnsTo: ["slug"], onUpdate: "cascade" }[field];
    });
    await assert.rejects(reproduceMigrations(root), /Foreign key definitions differ/);
  });
}

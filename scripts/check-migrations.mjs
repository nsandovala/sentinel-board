import assert from "node:assert/strict";
import { validateImmutableManifest, compareTrustedHistory } from "./check-history-reference.mjs";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, realpathSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readMigrationFiles } from "drizzle-orm/migrator";

export const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
const sha256 = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");

function containedFile(folder, name) {
  const base = realpathSync(folder);
  const file = realpathSync(resolve(folder, name));
  assert(file.startsWith(base + sep), `Migration path escapes folder: ${name}`);
  return file;
}

export function checkChain(folder, immutable = {}) {
  const journal = readJson(containedFile(folder, "meta/_journal.json"));
  assert.equal(journal.dialect, "postgresql", "Unexpected journal dialect");
  assert.equal(journal.version, "7", "Unexpected journal format");
  assert(Array.isArray(journal.entries) && journal.entries.length, "Empty journal");
  const files = new Set(["meta/_journal.json"]);
  const tags = new Set();
  const snapshotIds = new Set();
  let previousId = "00000000-0000-0000-0000-000000000000";
  let previousTime = 0;
  for (const [index, entry] of journal.entries.entries()) {
    const prefix = String(index).padStart(4, "0");
    assert.equal(entry.idx, index, "Non-contiguous journal index");
    assert.equal(entry.version, "7", "Unexpected entry format");
    assert.equal(typeof entry.breakpoints, "boolean", "Invalid breakpoints flag");
    assert(new RegExp(`^${prefix}_[a-zA-Z0-9_]+$`).test(entry.tag), "Unsafe or unordered migration tag");
    assert(!tags.has(entry.tag), "Duplicate migration tag");
    assert(Number.isSafeInteger(entry.when) && entry.when > previousTime, "Timestamps must increase");
    tags.add(entry.tag);
    previousTime = entry.when;
    const sqlName = `${entry.tag}.sql`;
    const snapshotName = `meta/${prefix}_snapshot.json`;
    const sql = readFileSync(containedFile(folder, sqlName), "utf8");
    assert(sql.trim().length, `Empty migration: ${sqlName}`);
    const snapshot = readJson(containedFile(folder, snapshotName));
    assert.equal(snapshot.dialect, "postgresql", "Unexpected snapshot dialect");
    assert.equal(snapshot.version, "7", "Unexpected snapshot format");
    assert.equal(snapshot.prevId, previousId, "Broken snapshot ancestry");
    assert(typeof snapshot.id === "string" && snapshot.id !== previousId && !snapshotIds.has(snapshot.id), "Invalid snapshot ID");
    assert(snapshot.tables && typeof snapshot.tables === "object", "Missing snapshot tables");
    snapshotIds.add(snapshot.id);
    previousId = snapshot.id;
    files.add(sqlName);
    files.add(snapshotName);
  }
  for (const name of readdirSync(folder).filter((name) => name.endsWith(".sql"))) {
    assert(files.has(name), `SQL not referenced by journal: ${name}`);
  }
  for (const name of readdirSync(resolve(folder, "meta")).filter((name) => name.endsWith("_snapshot.json"))) {
    assert(files.has(`meta/${name}`), `Snapshot not referenced by journal: ${name}`);
  }
  if (Object.keys(immutable).length) {
    assert.deepEqual([...files].sort(), Object.keys(immutable).sort(), "Immutable history file set changed");
    for (const [name, expected] of Object.entries(immutable)) {
      assert.equal(sha256(containedFile(folder, name)), expected, `Applied history changed: ${name}`);
    }
  }
  const migrations = readMigrationFiles({ migrationsFolder: folder });
  assert.equal(migrations.length, journal.entries.length);
  return { entries: journal.entries.map((entry, i) => ({ tag: entry.tag, when: entry.when, hash: migrations[i].hash })), files: [...files].sort() };
}

export function checkMigrations(root = repositoryRoot, { trustedHistory } = {}) {
  const config = readJson(resolve(root, "migrations/chains.json"));
  assert.equal(config.version, 1);
  assert.deepEqual(Object.keys(config.chains).sort(), ["fresh-disposable", "sb-qa-history"]);
  assert.equal(config.chains["sb-qa-history"].mode, "history-only");
  assert.equal(config.chains["fresh-disposable"].mode, "memory-only");
  assert.equal(config.chains["sb-qa-history"].folder, "drizzle");
  assert.equal(config.chains["fresh-disposable"].folder, "migrations/fresh");
  validateImmutableManifest(config.chains["sb-qa-history"].immutableSha256);
  if (trustedHistory !== undefined) compareTrustedHistory(root, trustedHistory);
  const results = {};
  for (const [name, chain] of Object.entries(config.chains)) {
    const folder = realpathSync(resolve(root, chain.folder));
    assert(folder.startsWith(realpathSync(root) + sep), "Chain escapes repository");
    results[name] = { mode: chain.mode, ...checkChain(folder, chain.immutableSha256) };
  }
  return results;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { console.log(JSON.stringify({ result: "PASS", chains: checkMigrations() }, null, 2)); }
  catch (error) { console.error(`Migration integrity failed: ${error.message}`); process.exitCode = 1; }
}

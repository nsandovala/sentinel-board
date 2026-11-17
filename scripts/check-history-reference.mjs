import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const historicalFiles = [
  "0000_thankful_venus.sql", "0001_lively_daimon_hellstrom.sql", "0002_pretty_toad.sql",
  "meta/0000_snapshot.json", "meta/0001_snapshot.json", "meta/0002_snapshot.json", "meta/_journal.json",
].sort();
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
export function validateImmutableManifest(manifest) {
  assert(manifest && typeof manifest === "object" && !Array.isArray(manifest), "sb-qa-history requires immutableSha256");
  assert.deepEqual(Object.keys(manifest).sort(), historicalFiles, "Immutable history file set changed");
  for (const hash of Object.values(manifest)) {
    assert(typeof hash === "string" && /^[a-f0-9]{64}$/.test(hash), "immutableSha256 requires valid SHA-256 hashes");
  }
  return manifest;
}
export function compareTrustedHistory(root, trustedHistory) {
  validateImmutableManifest(trustedHistory);
  const config = JSON.parse(readFileSync(resolve(root, "migrations/chains.json"), "utf8"));
  const actual = validateImmutableManifest(config.chains?.["sb-qa-history"]?.immutableSha256);
  assert.deepEqual(actual, trustedHistory, "Trusted history manifest changed");
  for (const file of historicalFiles) {
    assert.equal(digest(readFileSync(resolve(root, "drizzle", file))), trustedHistory[file], `Trusted history bytes changed: ${file}`);
  }
}

// The base SHA and optional bootstrap SHA must come from outside the PR checkout.
// This standalone checker is executed from the base revision once established.
export function checkHistoryReference(root, baseRevision, bootstrapRevision = "") {
  const git = (...args) => execFileSync("git", ["-C", root, ...args], { stdio: ["ignore", "pipe", "pipe"] });
  const requireCommit = (sha) => {
    assert(/^[a-f0-9]{40}$/.test(sha), "Trusted reference requires a full commit SHA");
    git("cat-file", "-e", `${sha}^{commit}`);
  };
  requireCommit(baseRevision);
  const show = (sha, file) => git("show", `${sha}:${file}`);
  const hasManifest = git("ls-tree", "--name-only", baseRevision, "--", "migrations/chains.json").toString().trim() !== "";
  let reference = baseRevision;
  if (!hasManifest) {
    assert(bootstrapRevision, "Initial history baseline requires an externally approved bootstrap commit");
    requireCommit(bootstrapRevision);
    assert.equal(git("show", "-s", "--format=%P", bootstrapRevision).toString().trim(), baseRevision, "Bootstrap must have exactly the PR base as its parent");
    reference = bootstrapRevision;
  }
  const config = JSON.parse(show(reference, "migrations/chains.json"));
  const chain = config.chains?.["sb-qa-history"];
  assert.equal(chain?.folder, "drizzle", "Trusted history folder changed");
  assert.equal(chain?.mode, "history-only", "Trusted history mode changed");
  const trustedHistory = validateImmutableManifest(chain.immutableSha256);
  for (const file of historicalFiles) {
    assert.equal(digest(show(reference, `drizzle/${file}`)), trustedHistory[file], `Trusted reference hash mismatch: ${file}`);
  }
  if (!hasManifest) {
    // Initial restoration may only supply the two known missing 0002 artifacts.
    const existing = git("ls-tree", "-r", "--name-only", baseRevision, "--", "drizzle").toString().trim().split("\n");
    const restored = new Set(["0002_pretty_toad.sql", "meta/0002_snapshot.json"]);
    assert.deepEqual(existing.sort(), historicalFiles.filter((f) => !restored.has(f)).map((f) => `drizzle/${f}`).sort(), "Unexpected pre-baseline history");
    for (const file of existing) {
      assert.equal(digest(show(baseRevision, file)), trustedHistory[file.slice("drizzle/".length)], `Bootstrap changed existing history: ${file}`);
    }
  }
  compareTrustedHistory(root, trustedHistory);
  return { result: "PASS", source: hasManifest ? "PR base commit" : "externally approved initial reference", baseRevision, reference, files: historicalFiles.length };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { console.log(JSON.stringify(checkHistoryReference(...process.argv.slice(2)), null, 2)); }
  catch (error) { console.error(`Trusted history check failed: ${error.message}`); process.exitCode = 1; }
}

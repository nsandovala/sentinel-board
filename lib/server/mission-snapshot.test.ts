import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { readMissionSnapshot } from "./mission-snapshot";
const raw = readFileSync("tests/mission/aa-export.json", "utf8");
const now = Date.parse(JSON.parse(raw).generatedAt);
async function fixture(run: (file: string, dir: string) => Promise<void>) {
  const dir = await fs.realpath(await fs.mkdtemp(path.join(tmpdir(), "sb-mission-")));
  const file = path.join(dir, "snapshot.json");
  try { await fs.writeFile(file, raw, {mode: 0o600}); await run(file, dir); }
  finally { await fs.rm(dir, {recursive: true, force: true}); }
}
test("configured file returns only the validated contract and never its path", () => fixture(async file => {
  const result = await readMissionSnapshot(file, now);
  assert.equal(result.status, "available"); assert.ok(!JSON.stringify(result).includes(file));
  assert.equal((await readMissionSnapshot(file, now + 300001)).status, "stale");
}));
test("unconfigured and missing are explicit, not empty success", async () => {
  assert.deepEqual(await readMissionSnapshot(""), {status: "unconfigured"});
  await fixture(async (_, dir) => assert.deepEqual(await readMissionSnapshot(path.join(dir, "missing")), {status: "unavailable"}));
});
for (const mode of ["symlink", "hardlink", "public", "oversized", "malformed", "private", "future", "directory"]) {
  test(`rejects ${mode} source without exposing contents`, () => fixture(async (file, dir) => {
    let target = file;
    if (mode === "symlink") { target = path.join(dir, "link"); await fs.symlink(file, target); }
    if (mode === "hardlink") await fs.link(file, path.join(dir, "hard"));
    if (mode === "public") await fs.chmod(file, 0o644);
    if (mode === "oversized") await fs.writeFile(file, " ".repeat(256 * 1024 + 1));
    if (mode === "malformed") await fs.writeFile(file, "{PRIVATE_SECRET");
    if (mode === "private") await fs.writeFile(file, JSON.stringify({payload: "PRIVATE_SECRET", mac: "x"}));
    if (mode === "directory") target = dir;
    const response = await readMissionSnapshot(target, mode === "future" ? now - 30001 : now);
    assert.deepEqual(response, {status: "invalid"});
  }));
}

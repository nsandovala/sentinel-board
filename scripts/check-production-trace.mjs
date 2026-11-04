// Validate the actual production package selected by Next's output-file tracing.
// Run after a build from a source copy without local QA/environment directories.
import { readFile, readdir, realpath } from "node:fs/promises";
import path from "node:path";

const root = await realpath(process.cwd());
async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => {
    const name = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(name) : [name];
  }));
  return nested.flat();
}
const manifests = (await walk(path.join(root, ".next"))).filter(f => f.endsWith(".nft.json")).sort();
if (!manifests.length) throw new Error("No production trace manifests found; run the build first.");
const files = new Set();
const violations = [];
for (const manifest of manifests) {
  const trace = JSON.parse(await readFile(manifest, "utf8"));
  if (trace.additionalRoots?.length) violations.push({ file: path.relative(root, manifest), reason: "Unexpected additional tracing root" });
  for (const entry of trace.files) {
    const absolute = path.resolve(path.dirname(manifest), entry);
    const resolved = await realpath(absolute);
    const relative = path.relative(root, resolved).split(path.sep).join("/");
    if (relative.startsWith("../") || path.isAbsolute(relative)) {
      violations.push({ file: path.relative(root, manifest), reason: "Trace escapes the clean source root" });
      continue;
    }
    files.add(relative);
  }
}
// Agent definitions, prompts and skills are runtime assets, not developer docs.
const agentAssets = (await walk(path.join(root, "agents")))
  .map(file => path.relative(root, file).split(path.sep).join("/"));
for (const file of agentAssets) {
  if (!files.has(file)) violations.push({ file, reason: "Required agent asset missing from production trace" });
}
const firstParty = [...files].filter(f => !f.startsWith("node_modules/") && !f.startsWith(".next/")).sort();
const forbiddenPath = /(^|\/)(\.env(?:\.|$)|\.claude(?:\/|$)|\.codex(?:\/|$)|\.git(?:\/|$)|\.qa-[^/]*|\.patch-[^/]*|outputs(?:\/|$)|certificates(?:\/|$))|\.(?:pem|key|p12|pfx)$/i;
const developmentFile = /^(?:tests|docs|scripts)\/|\.test\.[^/]+$|^[^/]+\.md$/i;
const credentialMarker = /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----|\b(?:sk_live_|sk-proj-|ghp_|github_pat_)[A-Za-z0-9_]{20,}|\bAKIA[A-Z0-9]{16}\b/;
for (const file of firstParty) {
  if (forbiddenPath.test(file)) {
    // Do not read a potentially private file; record only its path.
    violations.push({ file, reason: "Private or laboratory path" });
  } else if (developmentFile.test(file)) {
    violations.push({ file, reason: "Development/test/documentation file in production trace" });
  } else if (/\.(?:[cm]?[jt]sx?|json|ya?ml)$/.test(file)) {
    if (credentialMarker.test(await readFile(path.join(root, file), "utf8"))) {
      violations.push({ file, reason: "Credential marker (value withheld)" });
    }
  }
}
console.log(JSON.stringify({
  manifests: manifests.length, uniqueFiles: files.size, agentAssetsChecked: agentAssets.length,
  firstPartyFiles: firstParty, violations,
  scope: "Every .nft.json; physical paths stay inside the clean tree. First-party credential markers checked without printing values.",
}, null, 2));
process.exitCode = violations.length ? 1 : 0;

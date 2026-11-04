// Browser regression harness using the React/esbuild versions already in the lockfile.
// Usage: BROWSER_BIN=/path/to/chromium node scripts/test-ui.mjs
// No database, application server, browser profile, or real API is used.
import { build } from "esbuild";
import { createServer } from "node:http";
import { spawn, execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const executable = process.env.BROWSER_BIN ?? [
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome",
].find(existsSync);
if (!executable) throw new Error("Set BROWSER_BIN to an installed Chromium browser; this test does not install one.");
const baseline = process.argv.includes("--baseline");
const comparedComponents = new Set([
  "components/layout/topbar.tsx",
  "components/modals/create-task-modal.tsx",
  "components/console/dock/dock-context.tsx",
]);
const compiled = await build({
  entryPoints: ["tests/ui/interactions.browser.tsx"], bundle: true, write: false,
  format: "iife", platform: "browser", jsx: "automatic",
  define: { "process.env.NODE_ENV": '"development"' },
  plugins: [{
    name: "isolated-clerk-account-control",
    setup(plugin) {
      plugin.onResolve({ filter: /^@clerk\/nextjs$/ }, () => ({ path: path.resolve("tests/ui/clerk-fixture.tsx") }));
    },
  }, ...(baseline ? [{
    name: "compare-main-components",
    setup(plugin) {
      plugin.onLoad({ filter: /\.tsx$/ }, args => {
        const relative = path.relative(process.cwd(), args.path).split(path.sep).join("/");
        if (!comparedComponents.has(relative)) return;
        return { contents: execFileSync("git", ["show", "HEAD:" + relative], { encoding: "utf8" }), loader: "tsx", resolveDir: path.dirname(args.path) };
      });
    },
  }] : [])],
});
const bundle = compiled.outputFiles[0].contents;
const server = createServer((req, res) => {
  res.setHeader("Content-Security-Policy", "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'none'");
  if (req.url === "/tests.js") { res.setHeader("Content-Type", "text/javascript"); res.end(bundle); return; }
  if (req.url === "/" || req.url?.startsWith("/?")) {
    res.setHeader("Content-Type", "text/html");
    res.end('<!doctype html><html><head><meta charset="utf-8"><title>Sentinel UI regressions</title></head><body><div id="fixture"></div><pre id="results">Running fixtures…</pre><script src="/tests.js"></script></body></html>');
    return;
  }
  res.writeHead(404).end();
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
const profile = await mkdtemp(path.join(tmpdir(), "sentinel-ui-"));
const browser = spawn(executable, [
  "--headless=new", "--remote-debugging-pipe", "--no-first-run", "--no-default-browser-check",
  "--disable-background-networking", "--disable-component-update", "--disable-sync",
  "--disable-default-apps", "--disable-extensions", "--disable-features=MediaRouter",
  "--metrics-recording-only", "--proxy-server=http://127.0.0.1:1", "--proxy-bypass-list=127.0.0.1",
  "--user-data-dir=" + profile, "about:blank",
], { stdio: ["ignore", "ignore", "pipe", "pipe", "pipe"] });
let seq = 0, buffer = "";
const pending = new Map();
let stderr = "";
browser.stderr.on("data", chunk => { stderr = (stderr + chunk).slice(-4000); });
browser.stdio[4].on("data", chunk => {
  buffer += chunk.toString();
  let end;
  while ((end = buffer.indexOf("\0")) >= 0) {
    const message = JSON.parse(buffer.slice(0, end)); buffer = buffer.slice(end + 1);
    const waiter = pending.get(message.id);
    if (waiter) {
      pending.delete(message.id); clearTimeout(waiter.timeout);
      if (message.error) waiter.reject(new Error(JSON.stringify(message.error)));
      else waiter.resolve(message.result);
    }
  }
});
function cdp(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const id = ++seq;
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error("CDP timeout: " + method)); }, 15000);
    pending.set(id, { resolve, reject, timeout });
    browser.stdio[3].write(JSON.stringify({ id, method, params, sessionId }) + "\0");
  });
}
try {
  const version = await cdp("Browser.getVersion");
  const { targetId } = await cdp("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp("Target.attachToTarget", { targetId, flatten: true });
  await cdp("Page.enable", {}, sessionId);
  await cdp("Page.navigate", { url: "http://127.0.0.1:" + port }, sessionId);
  const deadline = Date.now() + 60000;
  let result;
  while (Date.now() < deadline) {
    const response = await cdp("Runtime.evaluate", { expression: "globalThis.uiTestResult", returnByValue: true }, sessionId);
    result = response.result?.value;
    if (result) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  if (!result) throw new Error("UI suite did not finish. Browser stderr: " + stderr);
  if (process.env.UI_SCREENSHOT) {
    const capture = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: true }, sessionId);
    await writeFile(process.env.UI_SCREENSHOT, Buffer.from(capture.data, "base64"));
  }
  console.log(JSON.stringify({ browser: version.product, baseline, ...result }, null, 2));
  process.exitCode = result.failed ? 1 : 0;
} finally {
  for (const p of pending.values()) { clearTimeout(p.timeout); p.reject(new Error("Browser closed")); }
  pending.clear();
  browser.kill("SIGTERM"); // Only this isolated child, never an existing browser.
  await new Promise(resolve => { if (browser.exitCode !== null) resolve(); else browser.once("exit", resolve); });
  await new Promise(resolve => server.close(resolve));
  await rm(profile, { recursive: true, force: true });
}

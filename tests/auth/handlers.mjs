// Test-only bundling: real handlers and policy, simulated Clerk and a forbidden DB.
// No production module imports this harness.
import { build } from "esbuild";
import { readdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { tmpdir } from "node:os";

export const origin = "http://127.0.0.1:3012";
export function ownerSession(overrides = {}) {
  const now = Math.floor(Date.now() / 1000);
  return { isAuthenticated: true, userId: "user_fixture_owner", sessionId: "sess_fixture",
    sessionClaims: { sub: "user_fixture_owner", sid: "sess_fixture", azp: origin, exp: now + 60, nbf: now - 1, sts: "active" },
    ...overrides };
}
export async function loadHandlers() {
  process.env.CLERK_AUTHORIZED_PARTIES = origin;
  process.env.AMON_OWNER_CLERK_USER_ID = "user_fixture_owner";
  process.env.AMON_IMPORT_TOKEN = "fixture-import-only";
  process.env.SENTINEL_API_TOKEN = "fixture-legacy-only";
  process.env.NODE_ENV = "test";
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_fixture_mock_only";
  process.env.CLERK_SECRET_KEY = "sk_test_fixture_mock_only";
  const root = process.cwd();
  const routes = [];
  async function walk(dir) {
    for (const file of await readdir(dir, { withFileTypes: true })) {
      const p = path.join(dir, file.name);
      if (file.isDirectory()) await walk(p);
      else if (file.name === "route.ts") routes.push(path.relative(root, p));
    }
  }
  await walk(path.join(root, "app/api")); routes.sort();
  const entry = routes.map((p, i) => 'import * as r' + i + ' from "./' + p + '";').join("\n") +
    '\nexport const routes = {' + routes.map((p,i) => JSON.stringify("/" + p.slice(4,-9)) + ':r' + i).join(",") + '};' +
    '\nexport * from "@clerk/nextjs/server";\nexport * from "./lib/server/api-auth";\nexport { default as proxy } from "./proxy";\nexport { syncBus } from "./lib/server/sync-bus";\nexport { default as DashboardLayout } from "./app/(dashboard)/layout";\nexport { default as SignInPage } from "./app/sign-in/[[...sign-in]]/page";\nexport { default as RootLayout } from "./app/layout";';
  const temp = await mkdtemp(path.join(tmpdir(), "sentinel-auth-"));
  const outfile = path.join(temp, "handlers.cjs");
  try {
    const compiled = await build({
      stdin: { contents: entry, resolveDir: root, sourcefile: "auth-fixture.ts" },
      absWorkingDir: root, bundle: true, write: false, platform: "node", format: "cjs",
      packages: "external", plugins: [{
        name: "isolated-auth-fixture",
        setup(plugin) {
          plugin.onResolve({ filter: /\.css$/ }, () => ({ path: "css", namespace: "css-fixture" }));
          plugin.onLoad({ filter: /.*/, namespace: "css-fixture" }, () => ({ contents: "", loader: "js" }));
          plugin.onResolve({ filter: /^@clerk\/nextjs$|^\.\/dashboard-client$/ }, args => ({ path: args.path, namespace: "ui-fixture" }));
          plugin.onLoad({ filter: /.*/, namespace: "ui-fixture" }, () => ({ contents: `
            export const ClerkProvider = () => null;
            export const SignOutButton = () => null;
            export const SignIn = () => null;
            export default function DashboardClient() { return null; }
          `, loader: "js" }));
          plugin.onResolve({ filter: /^@clerk\/nextjs\/server$/ }, () => ({ path: "clerk", namespace: "fixture" }));
          plugin.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: `
            let session = { isAuthenticated: false };
            export let middlewareOptions;
            export const setSession = value => { session = value; };
            export const auth = async options => {
              if (options?.acceptsToken !== "session_token") throw Error("Must require a user session token");
              if (session instanceof Error) throw session;
              return session;
            };
            export const clerkMiddleware = (handler, options) => {
              middlewareOptions = options;
              return async req => (await handler(auth, req)) ?? new Response(null, {status: 200});
            };
          `, loader: "js" }));
          plugin.onResolve({ filter: /^@\/lib\/db$/ }, () => ({ path: "db", namespace: "forbidden-db" }));
          plugin.onLoad({ filter: /.*/, namespace: "forbidden-db" }, () => ({ contents: `
            export const db = new Proxy({}, { get() { throw Error("TEST: database access forbidden"); } });
            export const pool = { query() { throw Error("TEST: database access forbidden"); } };
          `, loader: "js" }));
        },
      }],
    });
    // The temporary bundle resolves installed packages from this worktree only.
    await writeFile(outfile, compiled.outputFiles[0].contents);
    const require = createRequire(path.join(root, "package.json"));
    const Module = require("node:module");
    const fixture = new Module(outfile);
    fixture.filename = outfile;
    fixture.paths = Module._nodeModulePaths(root);
    fixture._compile(compiled.outputFiles[0].text, outfile);
    return fixture.exports;
  } finally { await rm(temp, { recursive: true, force: true }); }
}

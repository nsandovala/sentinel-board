import assert from "node:assert/strict";
import { after, test } from "node:test";
import { NextRequest } from "next/server";
import { GET } from "./route";

const originalFetch = globalThis.fetch;
const originalUrl = process.env.AMON_OPS_SNAPSHOT_URL;
after(() => {
  globalThis.fetch = originalFetch;
  if (originalUrl === undefined) delete process.env.AMON_OPS_SNAPSHOT_URL;
  else process.env.AMON_OPS_SNAPSHOT_URL = originalUrl;
});

const request = (host: string) => new NextRequest("http://127.0.0.1:3000/api/runtime/ops", { headers: { host } });

test("refuses public host without contacting AA", async () => {
  process.env.AMON_OPS_SNAPSHOT_URL = "http://127.0.0.1:4785/api/ops/snapshot";
  globalThis.fetch = async () => { throw new Error("must not fetch"); };
  const response = await GET(request("board.example.com"));
  assert.equal(response.status, 403);
  assert.equal((await response.json()).status, "offline");
});

test("misconfigured URL and failed upstream return empty offline projection", async () => {
  process.env.AMON_OPS_SNAPSHOT_URL = "http://example.com/api/ops/snapshot";
  assert.deepEqual((await (await GET(request("localhost:3000"))).json()).jobs, []);
  process.env.AMON_OPS_SNAPSHOT_URL = "http://127.0.0.1:4785/api/ops/snapshot";
  globalThis.fetch = async () => { throw new Error("ECONNREFUSED /secret/path"); };
  const response = await GET(request("localhost:3000"));
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal((await response.json()).status, "offline");
});

test("upstream errors and malformed snapshots never expose error body", async () => {
  process.env.AMON_OPS_SNAPSHOT_URL = "http://127.0.0.1:4785/api/ops/snapshot";
  globalThis.fetch = async () => new Response("/secret/path", { status: 500 });
  assert.doesNotMatch(await (await GET(request("localhost:3000"))).text(), /secret/);
  globalThis.fetch = async () => new Response(JSON.stringify({ workers: [] }), { status: 200 });
  assert.equal((await (await GET(request("localhost:3000"))).json()).status, "offline");
});

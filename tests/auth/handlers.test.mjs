import assert from "node:assert/strict";
import { test, before, after } from "node:test";
import { readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server.js";
import { loadHandlers, ownerSession, origin } from "./handlers.mjs";
import { permissionFor } from "../../lib/server/api-policy.mjs";

let app;
let inventory;
const savedFetch = globalThis.fetch;
before(async () => {
  app = await loadHandlers();
  inventory = Object.entries(app.routes).flatMap(([url, route]) =>
    Object.keys(route).filter(method => /^(GET|POST|PATCH|DELETE|PUT|HEAD|OPTIONS)$/.test(method))
      .map(method => ({url,method,handler:route[method]})));
  globalThis.fetch = async () => { throw Error("TEST: external request forbidden"); };
});
after(() => { globalThis.fetch = savedFetch; });
const request = (url, method="GET", headers={}, body) => new NextRequest(origin+url.replace("[id]","fixture"), {
  method, headers: { host:"127.0.0.1:3012", ...headers }, ...(body === undefined ? {} : { body }),
});
const invoke = (entry, headers={}) => entry.handler(request(entry.url,entry.method,headers),{params:Promise.resolve({id:"fixture"})});

test("inventory covers exactly 28 explicit handlers and every method guards before side effects", async () => {
  assert.equal(inventory.length,28);
  assert.equal(Object.keys(app.routes).length,19);
  for (const e of inventory) {
    assert.ok(permissionFor(e.url.replace("[id]","fixture"),e.method), e.method+" "+e.url);
    const source = await readFile("app"+e.url+"/route.ts","utf8");
    assert.match(source,new RegExp("export async function "+e.method+"\\([^\\n]*\\) \\{\\s*(?:let expiresAt = 0;\\s*)?const denied = await authorizeApi\\(req"));
  }
});

test("all 28 direct handlers deny anonymous, expired, signed-out, foreign and spoofed identities", async () => {
  const owner = ownerSession();
  const cases = [
    [{isAuthenticated:false},401],
    [ownerSession({sessionClaims:{...owner.sessionClaims,exp:Date.now()/1000-1}}),401],
    [ownerSession({sessionId:null,isAuthenticated:false}),401],
    [ownerSession({userId:"foreign",sessionClaims:{...owner.sessionClaims,sub:"foreign"}}),403],
    [new Error("SDK unavailable"),401],
  ];
  for (const [session,status] of cases) {
    app.setSession(session);
    for (const e of inventory) {
      const response = await invoke(e, {"x-forwarded-for":"127.0.0.1","x-real-ip":"::1",host:"localhost:3012"});
      assert.equal(response.status,status,e.method+" "+e.url);
      assert.equal(response.headers.get("cache-control"),"no-store");
    }
  }
});

test("owner policy covers every human handler; service import stays separate", async () => {
  app.setSession(ownerSession());
  for (const e of inventory) {
    const response = await app.authorizeApi(request(e.url,e.method,{origin,"sec-fetch-site":"same-origin"}));
    if (e.url === "/api/agents/import") assert.equal(response.status,403);
    else assert.equal(response,null,e.method+" "+e.url);
  }
});

test("every browser mutation rejects missing, foreign, null or cross-site origins before body or DB", async () => {
  app.setSession(ownerSession());
  for (const e of inventory.filter(e => e.method!=="GET" && e.url!=="/api/agents/import")) {
    for (const headers of [{},{origin:"https://evil.invalid"},{origin:"null"},{origin,"sec-fetch-site":"cross-site"}]) {
      assert.equal((await invoke(e,headers)).status,403,e.method+" "+e.url);
    }
  }
});

test("service and legacy tokens work only on import, with no fallback to owner on bad credentials", async () => {
  app.setSession(ownerSession());
  for (const header of [
    {authorization:"Bearer fixture-import-only"}, {authorization:"Bearer fixture-legacy-only"},
    {"x-sentinel-token":"fixture-legacy-only"},
  ]) {
    for (const e of inventory.filter(e=>e.url!=="/api/agents/import")) assert.equal((await invoke(e,header)).status,403);
    const response=await app.routes["/api/agents/import"].POST(request("/api/agents/import","POST",header,JSON.stringify({externalTaskId:"fixture-task"})));
    assert.equal(response.status,200);
    assert.deepEqual(await response.json(),{ok:true,received:true,taskId:"fixture-task",message:"Payload recibido y logueado. La persistencia en DB se habilitará en una fase posterior."});
  }
  for (const header of [
    {authorization:"Bearer bad"}, {"x-sentinel-token":"fixture-import-only"},
    {authorization:"Bearer fixture-import-only","x-sentinel-token":"fixture-legacy-only"},
  ]) assert.equal((await app.authorizeApi(request("/api/agents/import","POST",header))).status,401);
  delete process.env.SENTINEL_API_TOKEN;
  assert.equal((await app.authorizeApi(request("/api/agents/import","POST",{authorization:"Bearer fixture-legacy-only"}))).status,401);
  assert.equal(await app.authorizeApi(request("/api/agents/import","POST",{authorization:"Bearer fixture-import-only"})),null);
  process.env.SENTINEL_API_TOKEN="fixture-legacy-only";
});

test("proxy denies unknown and implicit methods, passes authorizedParties, and isolates service credentials", async () => {
  app.setSession(ownerSession());
  for (const method of ["HEAD","OPTIONS","TRACE","PUT"]) {
    // NextRequest rejects TRACE itself; use a plain request-shaped value for the policy boundary.
    const req = request("/api/tasks");
    Object.defineProperty(req,"method",{value:method});
    assert.equal((await app.proxy(req,{})).status,403);
  }
  assert.equal((await app.proxy(request("/api/unknown"),{})).status,403);
  assert.equal((await app.proxy(request("/api/runtime/ops"),{})).status,200);
  assert.deepEqual(app.middlewareOptions.authorizedParties,[origin]);
  const key=process.env.CLERK_SECRET_KEY;
  delete process.env.CLERK_SECRET_KEY;
  assert.equal((await app.proxy(request("/api/tasks"),{})).status,503);
  process.env.CLERK_SECRET_KEY=key;
  process.env.CLERK_AUTHORIZED_PARTIES="";
  assert.equal((await app.proxy(request("/api/tasks"),{})).status,503);
  assert.equal((await app.proxy(request("/api/agents/import","POST",{authorization:"Bearer fixture-import-only"}),{})).status,200);
  assert.equal((await app.proxy(request("/api/tasks","GET",{authorization:"Bearer fixture-import-only"}),{})).status,403);
  process.env.CLERK_AUTHORIZED_PARTIES=origin;
});

test("Runtime requires owner, loopback URL and host, and stays blocked in production", async () => {
  app.setSession(ownerSession());
  process.env.AMON_OPS_SNAPSHOT_URL="http://127.0.0.1:4785/api/ops/snapshot";
  let calls=0;
  globalThis.fetch = async (_url, options) => {
    calls++; assert.equal(options.redirect,"error"); assert.ok(options.signal);
    const now=new Date().toISOString();
    return Response.json({generatedAt:now,systemStatus:"ok",workers:[{workerId:"fixture",status:"online",lastHeartbeat:now}],jobs:[],guardianReviews:[],agents:[]});
  };
  const route=app.routes["/api/runtime/ops"].GET;
  assert.equal((await (await route(request("/api/runtime/ops"))).json()).status,"connected");
  assert.equal(calls,1);
  const forged = new NextRequest("https://evil.invalid/api/runtime/ops",{headers:{host:"127.0.0.1:3012","x-forwarded-for":"127.0.0.1"}});
  assert.equal((await route(forged)).status,403);
  process.env.NODE_ENV="production";
  process.env.CLERK_AUTHORIZED_PARTIES="https://board.example";
  app.setSession(ownerSession({sessionClaims:{...ownerSession().sessionClaims,azp:"https://board.example"}}));
  assert.equal((await route(request("/api/runtime/ops"))).status,403);
  assert.equal(calls,1);
  process.env.NODE_ENV="test";process.env.CLERK_AUTHORIZED_PARTIES=origin;
  globalThis.fetch = async () => { throw Error("TEST: external request forbidden"); };
});

test("authenticated NDJSON preserves the existing file contract using an isolated fixture", async () => {
  app.setSession(ownerSession());
  const dir=await mkdtemp(path.join(tmpdir(),"sentinel-ndjson-auth-"));
  try {
    process.env.AMON_EVENTS_PATH=path.join(dir,"fixture.jsonl");
    await writeFile(process.env.AMON_EVENTS_PATH,JSON.stringify({type:"agent.started",ts:new Date().toISOString(),agent:"guardian",runId:"lab"})+"\n");
    const response=await app.routes["/api/runtime/events"].GET(request("/api/runtime/events"));
    const body=await response.json();
    assert.equal(response.status,200);assert.equal(body.source,"ndjson");assert.equal(body.exists,true);
    assert.equal(body.events.length,1);assert.doesNotMatch(JSON.stringify(body),new RegExp(dir));
  } finally {delete process.env.AMON_EVENTS_PATH;await rm(dir,{recursive:true,force:true});}
});

test("SSE expires with the session; abort and consumer cancellation remove all listeners", async () => {
  const route=app.routes["/api/stream"].GET;
  const baseline=app.syncBus.listenerCount("event");
  const s=ownerSession();s.sessionClaims.exp=Date.now()/1000+0.1;app.setSession(s);
  const response=await route(request("/api/stream"));
  const reader=response.body.getReader();
  assert.match(new TextDecoder().decode((await reader.read()).value),/"type":"refresh"/);
  assert.equal((await reader.read()).done,true);
  assert.equal(app.syncBus.listenerCount("event"),baseline);
  app.setSession(ownerSession());
  const controller=new AbortController();
  const aborted=await route(new NextRequest(origin+"/api/stream",{signal:controller.signal}));
  controller.abort();await aborted.body.cancel();
  assert.equal(app.syncBus.listenerCount("event"),baseline);
  const cancelled=await route(request("/api/stream"));await cancelled.body.cancel();
  assert.equal(app.syncBus.listenerCount("event"),baseline);
  app.setSession({isAuthenticated:false});
  assert.equal((await route(request("/api/stream"))).status,401);
});

test("dashboard gates owner, foreign user, login and sign-out without mounting its data providers", async () => {
  app.setSession(ownerSession());
  const owner = await app.DashboardLayout({children:"fixture"});
  assert.equal(owner.type.name,"DashboardClient");
  assert.equal(owner.props.children,"fixture");
  const s=ownerSession();
  app.setSession(ownerSession({userId:"foreign",sessionClaims:{...s.sessionClaims,sub:"foreign"}}));
  const denied=await app.DashboardLayout({children:"must not appear"});
  assert.equal(denied.type,"main");
  assert.equal(denied.props.children[0].props.children,"Acceso denegado");
  assert.equal(denied.props.children[1].props.redirectUrl,"/sign-in");
  assert.equal(denied.props.children[1].props.children.props.children,"Cerrar sesión");
  app.setSession({isAuthenticated:false});
  await assert.rejects(app.DashboardLayout({children:"must not appear"}),error=>error.digest?.includes("/sign-in"));
  assert.equal(app.SignInPage().props.children.props.children.props.fallbackRedirectUrl,"/board");
});

test("root layout does not provision keyless Clerk or render private children when keys are absent", () => {
  const key=process.env.CLERK_SECRET_KEY;
  const configured=app.RootLayout({children:"private"});
  assert.equal(configured.props.children.props.children.props.children,"private");
  assert.equal(configured.props.children.props.children.props.afterSignOutUrl,"/sign-in");
  delete process.env.CLERK_SECRET_KEY;
  const fallback=app.RootLayout({children:"private"}).props.children.props.children;
  assert.equal(fallback.type,"main");
  assert.equal(fallback.props.children,"Configuración de autenticación pendiente.");
  process.env.CLERK_SECRET_KEY=key;
});

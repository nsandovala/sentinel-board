import assert from "node:assert/strict";
import { test } from "node:test";
import { generateKeyPairSync, sign } from "node:crypto";
import { verifyToken } from "@clerk/backend";
import { permissionFor, principalForClerkSession, parseAuthorizedParties, isAllowedMutationOrigin } from "../../lib/server/api-policy.mjs";
import { origin, ownerSession } from "./handlers.mjs";

test("owner identity, expiration, session status and azp fail closed", () => {
  const s = ownerSession();
  const principal = (claims = s.sessionClaims, owner = s.userId, sid = s.sessionId, user = s.userId) =>
    principalForClerkSession(user, sid, owner, claims, [origin]);
  assert.ok(principal().permissions.includes("runtime:read"));
  assert.deepEqual(principal(s.sessionClaims, "other").permissions, []);
  assert.deepEqual(principal(s.sessionClaims, "").permissions, []);
  assert.equal(principal(null), null);
  assert.equal(principal(s.sessionClaims, s.userId, null), null);
  for (const changes of [
    { exp: Date.now()/1000 - 1 }, { exp: "future" }, { exp: Infinity }, { exp: NaN },
    { nbf: Date.now()/1000 + 10 }, { nbf: "invalid" }, { sub: "other" }, { sid: "other" },
    { azp: undefined }, { azp: "https://evil.invalid" }, { sts: "pending" },
  ]) assert.equal(principal({ ...s.sessionClaims, ...changes }), null, JSON.stringify(changes));
});

test("authorizedParties is explicit, validated, and never derived from incoming headers", () => {
  assert.deepEqual(parseAuthorizedParties(origin, false), [origin]);
  assert.deepEqual(parseAuthorizedParties("https://board.example,https://board.example/", true), ["https://board.example"]);
  for (const value of [undefined, "", "null", "https://a.invalid,", "https://a.invalid/path", "https://u:p@a.invalid", "https://a.invalid?x", "ftp://a.invalid", "http://public.invalid"]) {
    assert.equal(parseAuthorizedParties(value, false), null);
  }
  assert.equal(parseAuthorizedParties(origin, true), null);
});

test("browser mutations require the configured public destination, independent of proxy headers", () => {
  assert.equal(isAllowedMutationOrigin(new Headers({ origin }), origin, [origin], false), true);
  assert.equal(isAllowedMutationOrigin(new Headers({ origin: "http://localhost:3012" }), origin, [origin], false), false);
  for (const h of [{}, { origin: "null" }, { origin: "https://evil.invalid" }, { origin, "sec-fetch-site": "cross-site" }]) {
    assert.equal(isAllowedMutationOrigin(new Headers(h), origin, [origin], false), false);
  }
  const publicOrigin="https://board.example";
  const forged={origin:"https://evil.invalid",host:"board.example","x-forwarded-host":"board.example","x-forwarded-proto":"https"};
  assert.equal(isAllowedMutationOrigin(new Headers(forged), publicOrigin, [publicOrigin], true), false);
  assert.equal(isAllowedMutationOrigin(new Headers({origin:publicOrigin,host:"0.0.0.0:10000"}),publicOrigin,[publicOrigin],true),true);
});

test("public destination is singular, secure, allowlisted and mandatory", () => {
  const destination="https://board.example";
  const headers=new Headers({origin:destination});
  for (const configured of [undefined,"","null","https://board.example/path","https://user:pass@board.example",
    "https://board.example?x","https://board.example#fragment","http://board.example",
    "https://board.example,https://other.example","https://board.example,https://board.example"]) {
    assert.equal(isAllowedMutationOrigin(headers,configured,[destination],true),false,String(configured));
  }
  assert.equal(isAllowedMutationOrigin(headers,destination,null,true),false);
  assert.equal(isAllowedMutationOrigin(headers,destination,["https://other.example"],true),false);
  assert.equal(isAllowedMutationOrigin(headers,destination+"/",[destination],true),true);
  assert.equal(isAllowedMutationOrigin(new Headers({origin}),origin,[origin],false),true);
  assert.equal(isAllowedMutationOrigin(new Headers({origin}),origin,[origin],true),false);
});

test("unlisted methods, paths, inherited object keys and trailing components are denied", () => {
  for (const path of ["/api/nope", "/api/tasks/1/comments/extra", "/api/tasks/"]) assert.equal(permissionFor(path,"GET"), null);
  for (const method of ["HEAD","OPTIONS","TRACE","PUT","constructor","toString","__proto__"]) assert.equal(permissionFor("/api/tasks",method), null);
});

test("real Clerk verifier checks signatures, expiry and authorizedParties offline", async () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwtKey = publicKey.export({ type: "spki", format: "pem" }).toString();
  const now = Math.floor(Date.now()/1000);
  const payload = { ...ownerSession().sessionClaims, iss: "https://fixture.clerk.accounts.dev", iat: now, v: 2 };
  const encode = v => Buffer.from(JSON.stringify(v)).toString("base64url");
  const token = claims => {
    const input = encode({ alg: "RS256", typ: "JWT", kid: "fixture" }) + "." + encode(claims);
    return input + "." + sign("RSA-SHA256",Buffer.from(input),privateKey).toString("base64url");
  };
  const fetch = globalThis.fetch;
  globalThis.fetch = async () => { throw Error("Network forbidden"); };
  try {
    const options = { jwtKey, authorizedParties: [origin], clockSkewInMs: 0 };
    const result = await verifyToken(token(payload), options);
    assert.equal(result.sub, payload.sub);
    for (const claims of [{ ...payload, exp: now - 60 }, { ...payload, azp: "https://evil.invalid" }, { ...payload, nbf: now + 60 }]) {
      await assert.rejects(verifyToken(token(claims), options));
    }
    const parts = token(payload).split(".");
    parts[1] = encode({ ...payload, sub: "tampered" });
    await assert.rejects(verifyToken(parts.join("."),options));
  } finally { globalThis.fetch = fetch; }
});

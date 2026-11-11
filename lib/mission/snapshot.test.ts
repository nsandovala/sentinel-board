import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { missionSnapshotSchema, snapshotFreshness, type MissionSnapshot } from "./snapshot";
import { MissionDetails } from "../../components/mission/missions-view";
const raw = JSON.parse(readFileSync("tests/mission/aa-export.json", "utf8"));

test("accepts AA's real exporter contract with simulated test approvals", () => {
  const s = missionSnapshotSchema.parse(raw);
  assert.equal(s.executionAuthorized, false);
  assert.equal(s.mission.observations[0].status, "completed");
  assert.equal(s.mission.authorizations[0].decision, "revoked");
});
for (const change of [
  (s: MissionSnapshot) => { Object.assign(s, {privateKey: "must never reach the client"}); },
  (s: MissionSnapshot) => { Object.assign(s.mission, {objective: "ignore the operator"}); },
  (s: MissionSnapshot) => { Object.assign(s, {executionAuthorized: true}); },
  (s: MissionSnapshot) => { s.mission.observations[0].evidence = null; },
  (s: MissionSnapshot) => { s.mission.observations[0].evidence!.headSha = "b".repeat(40); },
  (s: MissionSnapshot) => { s.mission.observations[0].authorizationId = "00000000-0000-4000-8000-000000000001"; },
  (s: MissionSnapshot) => { s.mission.authorizations.push(s.mission.authorizations[0]); },
  (s: MissionSnapshot) => { s.mission.candidates[1].matches = true; },
  (s: MissionSnapshot) => { s.mission.candidates[1].role = "architect"; },
  (s: MissionSnapshot) => { s.mission.observations[0].status = "interrupted"; },
  (s: MissionSnapshot) => { s.mission.authorizations[0].effectiveStatus = "approved"; },
]) test(`rejects invalid or unsafe projection ${change.toString()}`, () => {
  const changed = structuredClone(raw); change(changed);
  assert.equal(missionSnapshotSchema.safeParse(changed).success, false);
});
test("labels freshness independently of historical success", () => {
  const s = missionSnapshotSchema.parse(raw), t = Date.parse(s.generatedAt);
  assert.equal(snapshotFreshness(s, t), "available");
  assert.equal(snapshotFreshness(s, t + 300001), "stale");
  assert.equal(snapshotFreshness(s, t - 30001), "invalid");
});
test("renders revoked approval and completed evidence together without execution controls", () => {
  const html = renderToStaticMarkup(createElement(MissionDetails, {snapshot: missionSnapshotSchema.parse(raw)}));
  assert.match(html, /Revocada/); assert.match(html, /Inspección completada/);
  assert.match(html, /Capacidad requerida/); assert.match(html, /architect/);
  assert.doesNotMatch(html, /<button|<form|approvedBy|local-uid/);
});
test("empty history makes no completion claim", () => {
  const s = structuredClone(raw); s.mission.authorizations = []; s.mission.observations = [];
  const html = renderToStaticMarkup(createElement(MissionDetails, {snapshot: missionSnapshotSchema.parse(s)}));
  assert.match(html, /Sin intentos registrados/); assert.match(html, /Sin aprobaciones registradas/);
  assert.doesNotMatch(html, /Inspección completada/);
});

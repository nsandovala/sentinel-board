import { z } from "zod";

const time = z.string().datetime({ precision: 3 }).refine(s => Number.isFinite(Date.parse(s)) && new Date(s).toISOString() === s);
const uuid = z.string().uuid();
const sha = z.string().regex(/^[a-f0-9]{40}$/);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const role = z.enum(["architect", "security", "qa", "ops", "designer", "dev"]);
const capability = z.enum(["architecture-plan", "security-review", "plan-qa", "readiness-assessment", "plan-review", "ui-design", "code-implementation"]);
const evidence = z.object({ reference: z.string().regex(/^INSPECTION-[a-f0-9-]{36}$/), headSha: sha,
  branch: z.literal("mission-test"), readmeSha256: hash }).strict();
const observation = z.object({ authorizationId: uuid, status: z.enum(["completed", "blocked", "interrupted"]),
  startedAt: time, finishedAt: time.nullable(), evidence: evidence.nullable() }).strict();
export const missionSnapshotSchema = z.object({
  schemaVersion: z.literal("sb-mission/1"), generatedAt: time, source: z.literal("aa-isolated-inspector"), executionAuthorized: z.literal(false),
  mission: z.object({ id: z.string().regex(/^SUPERVISED-[a-f0-9-]{36}$/), repositoryAlias: z.literal("MISSION-TEST"), planHash: hash,
    baseSha: sha, branch: z.literal("mission-test"), assignmentId: z.literal("inspect-fixture"), action: z.literal("diagnose"),
    requiredCapability: z.literal("architecture-plan"), proposedRole: role.nullable(), proposalStatus: z.enum(["proposed", "blocked"]),
    permissions: z.object({ host: z.boolean(), mission: z.boolean(), assignment: z.boolean() }).strict(),
    candidates: z.array(z.object({ role, available: z.boolean(), actionCompatible: z.boolean(),
      missingCapabilities: z.array(capability).max(7), matches: z.boolean() }).strict()).length(6),
    authorizations: z.array(z.object({ id: uuid, decision: z.enum(["pending", "approved", "denied", "revoked"]),
      effectiveStatus: z.enum(["pending", "approved", "denied", "revoked", "expired", "invalid"]),
      approvedAt: time.nullable(), expiresAt: time }).strict()).max(100),
    observations: z.array(observation).max(100),
  }).strict(),
}).strict().superRefine((s, ctx) => {
  const fail = () => ctx.addIssue({code: "custom", message: "Inconsistent mission observation"});
  const m = s.mission, at = Date.parse(s.generatedAt);
  if (new Set(m.candidates.map(c => c.role)).size !== 6 || new Set(m.authorizations.map(a => a.id)).size !== m.authorizations.length ||
      new Set(m.observations.map(o => o.authorizationId)).size !== m.observations.length) fail();
  for (const c of m.candidates) if (c.matches !== (c.available && c.actionCompatible && !c.missingCapabilities.length)) fail();
  const matches = m.candidates.filter(c => c.matches);
  if (m.proposalStatus === "proposed" && (matches.length !== 1 || matches[0].role !== m.proposedRole || !Object.values(m.permissions).every(Boolean))) fail();
  if (m.proposalStatus === "blocked" && m.proposedRole !== null) fail();
  for (const a of m.authorizations) {
    if (a.approvedAt && (Date.parse(a.approvedAt) > at || Date.parse(a.approvedAt) >= Date.parse(a.expiresAt))) fail();
    if (a.effectiveStatus === "approved" && (a.decision !== "approved" || !a.approvedAt || Date.parse(a.expiresAt) <= at)) fail();
    if (a.decision === "revoked" && !["revoked", "expired"].includes(a.effectiveStatus)) fail();
  }
  for (const o of m.observations) {
    const a = m.authorizations.find(a => a.id === o.authorizationId);
    if (!a?.approvedAt || Date.parse(o.startedAt) < Date.parse(a.approvedAt) || Date.parse(o.startedAt) >= Date.parse(a.expiresAt) || Date.parse(o.startedAt) > at) fail();
    if (o.status === "interrupted" ? o.finishedAt !== null : !o.finishedAt) fail();
    if (o.finishedAt && (Date.parse(o.finishedAt) < Date.parse(o.startedAt) || Date.parse(o.finishedAt) > at)) fail();
    if (o.status === "completed") {
      if (!o.evidence || o.evidence.headSha !== m.baseSha || o.evidence.reference !== `INSPECTION-${o.authorizationId}` ||
          !o.finishedAt || (a && Date.parse(o.finishedAt) >= Date.parse(a.expiresAt))) fail();
    } else if (o.evidence !== null) fail();
  }
});
export type MissionSnapshot = z.infer<typeof missionSnapshotSchema>;
export type MissionResponse = {status: "available" | "stale"; snapshot: MissionSnapshot} |
  {status: "unconfigured" | "unavailable" | "invalid"};
export function snapshotFreshness(s: MissionSnapshot, now = Date.now()): "available" | "stale" | "invalid" {
  const age = now - Date.parse(s.generatedAt);
  return age < -30_000 ? "invalid" : age > 300_000 ? "stale" : "available";
}

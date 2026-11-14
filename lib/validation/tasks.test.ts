import assert from "node:assert/strict";
import { test } from "node:test";
import { getTasksQuerySchema } from "./tasks";

const query = (search: string) => Object.fromEntries(new URLSearchParams(search));

test("supplies numeric defaults when both pagination parameters are absent", () => {
  assert.deepEqual(getTasksQuerySchema.parse(query("")), { limit: 200, offset: 0 });
});

test("defaults each absent pagination parameter independently", () => {
  assert.deepEqual(getTasksQuerySchema.parse(query("limit=20")), { limit: 20, offset: 0 });
  assert.deepEqual(getTasksQuerySchema.parse(query("offset=40")), { limit: 200, offset: 40 });
  assert.deepEqual(getTasksQuerySchema.parse({ limit: undefined, offset: undefined }), {
    limit: 200, offset: 0,
  });
});

for (const [search, expected] of [
  ["limit=20&offset=0", { limit: 20, offset: 0 }],
  ["limit=20&offset=40", { limit: 20, offset: 40 }],
  ["limit=1&offset=0", { limit: 1, offset: 0 }],
  ["limit=200&offset=100000", { limit: 200, offset: 100_000 }],
  ["limit=020&offset=000", { limit: 20, offset: 0 }],
] as const) {
  test(`preserves explicit pagination: ${search}`, () => {
    assert.deepEqual(getTasksQuerySchema.parse(query(search)), expected);
  });
}

for (const [field, value] of [
  ["limit", "0"], ["limit", "201"], ["limit", "-1"],
  ["offset", "-1"], ["offset", "100001"],
  ["offset", "9007199254740992"],
] as const) {
  test(`rejects out-of-range ${field}=${value}`, () => {
    const result = getTasksQuerySchema.safeParse({ limit: "20", offset: "0", [field]: value });
    assert.equal(result.success, false);
    if (!result.success) assert.ok(result.error.issues.some((issue) => issue.path[0] === field));
  });
}

for (const value of ["", " ", "1.5", "1e2", "20x", "Infinity", null, 20]) {
  test(`does not replace invalid explicit pagination with defaults: ${JSON.stringify(value)}`, () => {
    for (const field of ["limit", "offset"]) {
      assert.equal(getTasksQuerySchema.safeParse({ limit: "20", offset: "0", [field]: value }).success, false);
    }
  });
}

test("continues rejecting unknown query parameters with or without pagination", () => {
  for (const search of ["extra=1", "limit=20&offset=0&extra=1"]) {
    const result = getTasksQuerySchema.safeParse(query(search));
    assert.equal(result.success, false);
    if (!result.success) assert.ok(result.error.issues.some((issue) => issue.code === "unrecognized_keys"));
  }
});

test("preserves all valid filters with default and explicit pagination", () => {
  const filters = {
    q: "50% coverage", projectId: "project-qa", status: "en_proceso",
    priority: "high", type: "bug", tag: "frontend", blocked: "true",
  };
  assert.deepEqual(getTasksQuerySchema.parse(filters), {
    ...filters, blocked: true, limit: 200, offset: 0,
  });
  assert.deepEqual(getTasksQuerySchema.parse({ ...filters, limit: "20", offset: "40" }), {
    ...filters, blocked: true, limit: 20, offset: 40,
  });
});

for (const [blocked, expected] of [["true", true], ["1", true], ["false", false], ["0", false]] as const) {
  test(`preserves boolean filter blocked=${blocked}`, () => {
    assert.deepEqual(getTasksQuerySchema.parse({ blocked }), { blocked: expected, limit: 200, offset: 0 });
  });
}

test("continues rejecting invalid filters", () => {
  for (const invalid of [
    { q: "" }, { projectId: "" }, { tag: "" }, { status: "invalid" },
    { priority: "invalid" }, { type: "invalid" }, { blocked: "yes" },
  ]) {
    assert.equal(getTasksQuerySchema.safeParse({ limit: "20", offset: "0", ...invalid }).success, false);
  }
});

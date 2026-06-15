import test from "node:test";
import assert from "node:assert/strict";
import {
  buildMswHandler,
  compareResponses,
  createScenario,
  exportMockDefinition,
  regenerateMockBody,
  responseToMockDraft,
  restoreFixedMockBody,
  type RequestSnapshot,
  type ResponseSnapshot,
} from "../src-svelte/lib/api-debug-workflow";

const request: RequestSnapshot = {
  url: "https://api.example.com/v1/users?page=1",
  method: "GET",
  headers: [],
  params: [],
  bodyMode: "none",
  bodyFields: [],
  bodyText: "",
  timeoutMs: 30000,
};

const response: ResponseSnapshot = {
  status: 200,
  statusText: "OK",
  finalUrl: request.url,
  headers: { "content-type": "application/json" },
  body: '{"data":[{"id":1,"name":"Ada"}],"ok":true}',
  durationMs: 120,
  sizeBytes: 46,
};

test("creates a reusable scenario with request and baseline", () => {
  const scenario = createScenario("用户列表", request, response, 1000);
  assert.equal(scenario.name, "用户列表");
  assert.equal(scenario.request.url, request.url);
  assert.equal(scenario.baseline?.status, 200);
  assert.equal(scenario.createdAt, 1000);
});

test("turns a real JSON response into a fixed mock and can regenerate it", () => {
  const draft = responseToMockDraft(request, response);
  assert.equal(draft.path, "/v1/users");
  assert.equal(draft.mode, "fixed");
  assert.ok(draft.schema);
  assert.deepEqual(JSON.parse(draft.body), JSON.parse(response.body));

  const generated = regenerateMockBody({ ...draft, arrayLength: 4 });
  assert.equal(generated.mode, "generated");
  assert.equal(JSON.parse(generated.body).data.length, 4);
  assert.equal(restoreFixedMockBody(generated).body, draft.realBody);
});

test("builds MSW handlers with status and optional delay", () => {
  const draft = { ...responseToMockDraft(request, response), status: 503, delayMs: 800 };
  const code = buildMswHandler(draft);
  assert.match(code, /http\.get\("\*\*\/v1\/users"/);
  assert.match(code, /await delay\(800\)/);
  assert.match(code, /status: 503/);
  assert.equal(JSON.parse(exportMockDefinition(draft)).status, 503);
});

test("diffs added, removed, changed and type-changed JSON fields", () => {
  const current: ResponseSnapshot = {
    ...response,
    status: 201,
    durationMs: 180,
    body: '{"data":[{"id":"1","email":"a@example.com"}],"extra":true}',
  };
  const diff = compareResponses(response, current);
  assert.equal(diff.statusChanged, true);
  assert.equal(diff.durationDeltaMs, 60);
  assert.ok(diff.items.some((item) => item.path === "$.data[0].id" && item.kind === "type"));
  assert.ok(diff.items.some((item) => item.path === "$.data[0].name" && item.kind === "removed"));
  assert.ok(diff.items.some((item) => item.path === "$.data[0].email" && item.kind === "added"));
  assert.ok(diff.items.some((item) => item.path === "$.extra" && item.kind === "added"));
});

test("falls back to text diff for non-JSON responses", () => {
  const baseline = { ...response, body: "hello" };
  const current = { ...response, body: "world" };
  const diff = compareResponses(baseline, current);
  assert.equal(diff.bodyKind, "text");
  assert.equal(diff.bodyChanged, true);
  assert.equal(diff.items.length, 1);
});

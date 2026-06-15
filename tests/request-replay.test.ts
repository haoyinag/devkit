import test from "node:test";
import assert from "node:assert/strict";
import { entriesToObject, parseReplayRequest } from "../src-svelte/lib/request-replay";

test("parses the recommended interceptor output", () => {
  const result = parseReplayRequest(JSON.stringify({
    url: "https://api.example.com/users",
    method: "POST",
    headers: {
      Authorization: "Bearer token",
      "Content-Type": "application/json",
    },
    params: { page: 1, active: true },
    body: { name: "Tom", code: "123", active: true, profile: { level: 2 } },
    timeout: 12000,
  }));

  assert.equal(result.url, "https://api.example.com/users");
  assert.equal(result.method, "POST");
  assert.equal(result.timeoutMs, 12000);
  assert.deepEqual(entriesToObject(result.params), { page: "1", active: "true" });
  assert.deepEqual(entriesToObject(result.bodyFields), {
    name: "Tom",
    code: "123",
    active: true,
    profile: { level: 2 },
  });
});

test("normalizes an Axios config and parses stringified data", () => {
  const result = parseReplayRequest(JSON.stringify({
    baseURL: "https://api.example.com/v1",
    url: "users",
    method: "post",
    headers: {
      common: { Accept: "application/json" },
      post: { "Content-Type": "application/json" },
      "X-Trace": "abc",
    },
    data: JSON.stringify({ name: "Ada", roles: ["admin"] }),
  }));

  assert.equal(result.url, "https://api.example.com/v1/users");
  assert.equal(result.method, "POST");
  assert.deepEqual(entriesToObject(result.bodyFields), { name: "Ada", roles: ["admin"] });
  assert.deepEqual(
    Object.fromEntries(result.headers.map((entry) => [entry.key, entry.value])),
    {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Trace": "abc",
    },
  );
});

test("supports repeatedly stringified JSON", () => {
  const raw = JSON.stringify(JSON.stringify({
    url: "https://api.example.com/ping",
    method: "get",
  }));
  const result = parseReplayRequest(raw);
  assert.equal(result.url, "https://api.example.com/ping");
  assert.equal(result.method, "GET");
});

test("supports config JSON followed by body JSON", () => {
  const result = parseReplayRequest(`
    request config:
    {"url":"https://api.example.com/users","method":"PATCH"}
    request body:
    {"enabled":false,"count":3}
  `);

  assert.equal(result.method, "PATCH");
  assert.deepEqual(entriesToObject(result.bodyFields), { enabled: false, count: 3 });
});

test("keeps relative URLs editable and emits a warning", () => {
  const result = parseReplayRequest('{"url":"/api/users","method":"GET"}');
  assert.equal(result.url, "/api/users");
  assert.equal(result.warnings.length, 1);
});

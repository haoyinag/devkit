import test from "node:test";
import assert from "node:assert/strict";
import { generateTypeDefinitions } from "../src-svelte/lib/ts-type-generator";
import { detectContent } from "../src-svelte/lib/clipboard-detect";

test("resolves $ref, allOf and nullable in OpenAPI schema", () => {
  const input = JSON.stringify({
    openapi: "3.0.3",
    paths: {},
    components: {
      schemas: {
        UserBase: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "integer" },
            nickname: { type: "string", nullable: true },
          },
        },
        UserDetail: {
          allOf: [
            { $ref: "#/components/schemas/UserBase" },
            {
              type: "object",
              required: ["email"],
              properties: {
                email: { type: "string" },
              },
            },
          ],
        },
      },
    },
  });

  const result = generateTypeDefinitions(input, "UserDetail");
  assert.match(result.code, /export interface UserDetail/);
  assert.match(result.code, /id: number;/);
  assert.match(result.code, /nickname\?: string \| null;/);
  assert.match(result.code, /email: string;/);
});

test("adds deterministic warnings when OpenAPI has multiple choices", () => {
  const input = JSON.stringify({
    openapi: "3.0.3",
    paths: {
      "/users": {
        get: {
          responses: {
            "200": {
              content: {
                "application/json": {
                  schema: { type: "object", properties: { id: { type: "integer" } } },
                },
                "application/vnd.api+json": {
                  schema: { type: "object", properties: { ignored: { type: "string" } } },
                },
              },
            },
            "201": {
              content: {
                "application/json": {
                  schema: { type: "object", properties: { created: { type: "boolean" } } },
                },
              },
            },
          },
        },
      },
      "/users/create": {
        post: {
          responses: {
            "200": {
              content: {
                "application/json": {
                  schema: { type: "object", properties: { postOnly: { type: "boolean" } } },
                },
              },
            },
          },
        },
      },
    },
  });

  const result = generateTypeDefinitions(input, "Response");
  assert.ok(result.warnings.some((w) => w.includes("检测到 2 个接口")));
  assert.ok(result.warnings.some((w) => w.includes("检测到多个响应码")));
  assert.ok(result.warnings.some((w) => w.includes("检测到多个 JSON 响应类型")));
  assert.match(result.code, /id\?: number;/);
});

test("parses swagger tsv table for ts type generation", () => {
  const table = [
    "字段名\t字段说明\t字段类型",
    "recordId\t记录ID\tinteger(int64)",
    "recordType\t记录类型\tstring",
  ].join("\n");
  const result = generateTypeDefinitions(table, "RecordInfo");
  assert.equal(result.mode, "table");
  assert.match(result.code, /export interface RecordInfo/);
  assert.match(result.code, /recordId: number;/);
});

test("routes OpenAPI JSON to ts type generator in detection", () => {
  const sample = JSON.stringify({
    openapi: "3.0.1",
    paths: {},
    components: {},
  });
  const detection = detectContent(sample);
  assert.ok(detection);
  assert.equal(detection?.tool, "ts-type-generator");
  assert.equal(detection?.confidence, "high");
});

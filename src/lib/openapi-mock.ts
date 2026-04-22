import { dereference as dereferenceRefs } from "@apidevtools/json-schema-ref-parser";
import { createGenerator, type JsonSchema } from "json-schema-faker";
import { parse as parseYaml } from "yaml";

export type HttpMethod = "get" | "post" | "put" | "patch" | "delete" | "options" | "head";

const HTTP_METHODS: HttpMethod[] = ["get", "post", "put", "patch", "delete", "options", "head"];

export interface OperationRef {
  path: string;
  method: HttpMethod;
  operationId?: string;
  summary?: string;
}

export type SpecKind = "openapi3" | "swagger2" | "unknown";

export function parseOpenApiDocument(raw: string): unknown {
  const t = raw.trim();
  if (!t) throw new Error("文档为空");
  if (t.startsWith("{") || t.startsWith("[")) {
    try {
      return JSON.parse(t);
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : "JSON 解析失败");
    }
  }
  try {
    return parseYaml(t);
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : "YAML 解析失败");
  }
}

export function detectSpecKind(spec: unknown): SpecKind {
  if (!spec || typeof spec !== "object") return "unknown";
  const o = spec as Record<string, unknown>;
  if (typeof o.openapi === "string" && o.openapi.startsWith("3.")) return "openapi3";
  if (o.swagger === "2.0") return "swagger2";
  return "unknown";
}

export function isProbablyHtml(body: string, contentType?: string | null): boolean {
  const ct = contentType?.toLowerCase() ?? "";
  if (ct.includes("text/html")) return true;
  const s = body.trimStart();
  if (s.startsWith("<!") || s.toLowerCase().startsWith("<html")) return true;
  return false;
}

export function listOperations(spec: unknown): OperationRef[] {
  if (!spec || typeof spec !== "object") return [];
  const paths = (spec as Record<string, unknown>).paths;
  if (!paths || typeof paths !== "object") return [];
  const out: OperationRef[] = [];
  for (const path of Object.keys(paths as Record<string, unknown>)) {
    const item = (paths as Record<string, Record<string, unknown>>)[path];
    if (!item || typeof item !== "object") continue;
    for (const method of HTTP_METHODS) {
      const op = item[method];
      if (op && typeof op === "object") {
        const o = op as Record<string, unknown>;
        out.push({
          path,
          method,
          operationId: typeof o.operationId === "string" ? o.operationId : undefined,
          summary: typeof o.summary === "string" ? o.summary : undefined,
        });
      }
    }
  }
  return out.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
}

export function listResponseStatusKeys(spec: unknown, path: string, method: HttpMethod): string[] {
  const op = getOperationObject(spec, path, method);
  if (!op) return [];
  const responses = op.responses;
  if (!responses || typeof responses !== "object") return [];
  const keys = Object.keys(responses as Record<string, unknown>);
  const rank = (k: string) => {
    if (k === "default") return 999;
    const n = Number.parseInt(k, 10);
    return Number.isFinite(n) ? n : 500;
  };
  return keys.sort((a, b) => rank(a) - rank(b));
}

function getOperationObject(
  spec: unknown,
  path: string,
  method: HttpMethod,
): Record<string, unknown> | null {
  if (!spec || typeof spec !== "object") return null;
  const paths = (spec as Record<string, unknown>).paths as Record<string, Record<string, unknown>> | undefined;
  if (!paths) return null;
  const pathItem = paths[path];
  if (!pathItem || typeof pathItem !== "object") return null;
  const op = pathItem[method];
  return op && typeof op === "object" ? (op as Record<string, unknown>) : null;
}

// Prefer application/json, then types ending with +json, then generic JSON-like types.
export function listJsonMediaTypes(spec: unknown, path: string, method: HttpMethod, status: string): string[] {
  const op = getOperationObject(spec, path, method);
  if (!op) return [];
  const responses = op.responses as Record<string, unknown> | undefined;
  if (!responses) return [];
  const resp = (responses[status] ?? responses.default) as Record<string, unknown> | undefined;
  if (!resp || typeof resp !== "object") return [];

  const kind = detectSpecKind(spec);
  if (kind === "openapi3") {
    const content = resp.content as Record<string, unknown> | undefined;
    if (!content || typeof content !== "object") return [];
    const keys = Object.keys(content);
    return sortMediaTypes(keys);
  }
  if (kind === "swagger2") {
    if (resp.schema) return ["application/json"];
    return [];
  }
  return [];
}

function sortMediaTypes(keys: string[]): string[] {
  const score = (k: string) => {
    const lower = k.toLowerCase();
    if (lower === "application/json") return 0;
    if (lower.endsWith("+json")) return 1;
    if (lower.includes("json")) return 2;
    if (lower === "*/*") return 4;
    return 5;
  };
  return [...keys].filter((k) => score(k) < 5).sort((a, b) => score(a) - score(b));
}

export interface ResolvedResponseBody {
  /** JSON Schema for response body (may include composition keywords) */
  schema: JsonSchema | null;
  /** OpenAPI `example` on media type or response */
  example?: unknown;
}

export function getResponseBodyInfo(
  spec: unknown,
  path: string,
  method: HttpMethod,
  status: string,
  mediaType: string,
): ResolvedResponseBody {
  const op = getOperationObject(spec, path, method);
  if (!op) return { schema: null };
  const responses = op.responses as Record<string, unknown> | undefined;
  if (!responses) return { schema: null };
  const resp = (responses[status] ?? responses.default) as Record<string, unknown> | undefined;
  if (!resp || typeof resp !== "object") return { schema: null };

  const kind = detectSpecKind(spec);
  if (kind === "openapi3") {
    const content = resp.content as Record<string, unknown> | undefined;
    const mt = content?.[mediaType] as Record<string, unknown> | undefined;
    if (!mt || typeof mt !== "object") return { schema: null };
    const schema = mt.schema as JsonSchema | undefined;
    const ex = extractExampleFromMediaTypeOrResponse(mt, resp);
    return { schema: schema ?? null, example: ex };
  }
  if (kind === "swagger2") {
    const schema = resp.schema as JsonSchema | undefined;
    const ex = resp.example;
    return {
      schema: schema ?? null,
      example: ex !== undefined ? ex : undefined,
    };
  }
  return { schema: null };
}

function extractExampleFromMediaTypeOrResponse(
  mediaTypeObj: Record<string, unknown>,
  responseObj: Record<string, unknown>,
): unknown | undefined {
  if ("example" in mediaTypeObj && mediaTypeObj.example !== undefined) {
    return mediaTypeObj.example;
  }
  const examples = mediaTypeObj.examples as Record<string, { value?: unknown }> | undefined;
  if (examples && typeof examples === "object") {
    for (const k of Object.keys(examples)) {
      const entry = examples[k];
      if (entry && typeof entry === "object" && "value" in entry) {
        return (entry as { value: unknown }).value;
      }
    }
  }
  if ("example" in responseObj && responseObj.example !== undefined) {
    return responseObj.example;
  }
  return undefined;
}

function cloneJson<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

export async function dereferenceSpec(spec: unknown): Promise<unknown> {
  const base = cloneJson(spec);
  try {
    return await dereferenceRefs(base as object);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`$ref 解析失败: ${msg}`);
  }
}

const defaultGen = createGenerator({
  alwaysFakeOptionals: true,
  useExamplesValue: true,
  useDefaultValue: true,
  fillProperties: true,
  maxDepth: 14,
  refDepthMax: 12,
  minItems: 0,
  maxItems: 6,
});

export async function generateMockFromJsonSchema(schema: JsonSchema): Promise<unknown> {
  return defaultGen.generate(schema);
}

export async function generateResponseMock(opts: {
  schema: JsonSchema | null;
  example?: unknown;
  preferExample: boolean;
}): Promise<unknown> {
  const { schema, example, preferExample } = opts;
  if (preferExample && example !== undefined) {
    return cloneJson(example);
  }
  if (!schema) {
    if (example !== undefined) return cloneJson(example);
    return null;
  }
  try {
    return await defaultGen.generate(schema);
  } catch (e) {
    if (example !== undefined) return cloneJson(example);
    throw e;
  }
}

export function formatOperationLabel(op: OperationRef): string {
  const tail = op.operationId ? ` · ${op.operationId}` : op.summary ? ` · ${op.summary}` : "";
  return `${op.method.toUpperCase()} ${op.path}${tail}`;
}

export function buildMswSnippet(opts: {
  method: HttpMethod;
  /** e.g. **\/api/v1/users */
  urlPattern: string;
  bodyObject: unknown;
}): string {
  const { method, urlPattern, bodyObject } = opts;
  const m = method.toLowerCase();
  const json = JSON.stringify(bodyObject, null, 2);
  return `import { http, HttpResponse } from 'msw';

// 按需调整 url 匹配模式
export const devkitMock = http.${m}('${urlPattern.replace(/'/g, "\\'")}', () => {
  return HttpResponse.json(
${json
  .split("\n")
  .map((line) => `    ${line}`)
  .join("\n")}
  );
});
`;
}

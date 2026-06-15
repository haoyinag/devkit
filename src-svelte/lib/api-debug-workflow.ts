import { generateMock, inferSchema } from "@/lib/json-mock-infer";
import type { EditableValueType, RequestBodyMode } from "@/lib/request-replay";

export interface StoredEntry {
  key: string;
  value: string;
  enabled: boolean;
  valueType: EditableValueType;
}

export interface RequestSnapshot {
  url: string;
  method: string;
  headers: StoredEntry[];
  params: StoredEntry[];
  bodyMode: RequestBodyMode;
  bodyFields: StoredEntry[];
  bodyText: string;
  timeoutMs: number;
}

export interface ResponseSnapshot {
  status: number;
  statusText: string;
  finalUrl: string;
  headers: Record<string, string>;
  body: string;
  durationMs: number;
  sizeBytes: number;
}

export interface DebugScenario {
  id: string;
  name: string;
  request: RequestSnapshot;
  baseline?: ResponseSnapshot;
  createdAt: number;
  updatedAt: number;
}

export type MockMode = "fixed" | "generated";

export interface MockDraft {
  sourceScenarioId?: string;
  method: string;
  path: string;
  status: number;
  delayMs: number;
  mode: MockMode;
  realBody: string;
  body: string;
  schema?: Record<string, unknown>;
  arrayLength: number;
}

export type DiffKind = "added" | "removed" | "changed" | "type";

export interface JsonDiffItem {
  path: string;
  kind: DiffKind;
  before?: unknown;
  after?: unknown;
}

export interface ResponseDiff {
  statusChanged: boolean;
  durationDeltaMs: number;
  bodyKind: "json" | "text";
  bodyChanged: boolean;
  items: JsonDiffItem[];
}

function parseJson(text: string): unknown {
  return JSON.parse(text);
}

function valueType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function joinPath(parent: string, key: string | number): string {
  if (typeof key === "number") return `${parent}[${key}]`;
  return parent === "$" ? `$.${key}` : `${parent}.${key}`;
}

function walkDiff(before: unknown, after: unknown, path: string, output: JsonDiffItem[]) {
  const beforeType = valueType(before);
  const afterType = valueType(after);
  if (beforeType !== afterType) {
    output.push({ path, kind: "type", before, after });
    return;
  }

  if (Array.isArray(before) && Array.isArray(after)) {
    const length = Math.max(before.length, after.length);
    for (let index = 0; index < length; index += 1) {
      const itemPath = joinPath(path, index);
      if (index >= before.length) output.push({ path: itemPath, kind: "added", after: after[index] });
      else if (index >= after.length) output.push({ path: itemPath, kind: "removed", before: before[index] });
      else walkDiff(before[index], after[index], itemPath, output);
    }
    return;
  }

  if (before && after && typeof before === "object" && typeof after === "object") {
    const beforeRecord = before as Record<string, unknown>;
    const afterRecord = after as Record<string, unknown>;
    const keys = new Set([...Object.keys(beforeRecord), ...Object.keys(afterRecord)]);
    for (const key of keys) {
      const itemPath = joinPath(path, key);
      if (!(key in beforeRecord)) output.push({ path: itemPath, kind: "added", after: afterRecord[key] });
      else if (!(key in afterRecord)) output.push({ path: itemPath, kind: "removed", before: beforeRecord[key] });
      else walkDiff(beforeRecord[key], afterRecord[key], itemPath, output);
    }
    return;
  }

  if (!Object.is(before, after)) output.push({ path, kind: "changed", before, after });
}

export function createScenario(
  name: string,
  request: RequestSnapshot,
  baseline?: ResponseSnapshot,
  now = Date.now(),
): DebugScenario {
  return {
    id: crypto.randomUUID?.() ?? `${now}-${Math.random()}`,
    name: name.trim() || `${request.method} ${request.url}`,
    request,
    baseline,
    createdAt: now,
    updatedAt: now,
  };
}

export function cloneScenario(source: DebugScenario, now = Date.now()): DebugScenario {
  return {
    ...structuredClone(source),
    id: crypto.randomUUID?.() ?? `${now}-${Math.random()}`,
    name: `${source.name} - 副本`,
    createdAt: now,
    updatedAt: now,
  };
}

export function responseToMockDraft(
  request: RequestSnapshot,
  response: ResponseSnapshot,
  sourceScenarioId?: string,
): MockDraft {
  let schema: Record<string, unknown> | undefined;
  let body = response.body;
  try {
    const parsed = parseJson(response.body);
    schema = inferSchema(parsed) as Record<string, unknown>;
    body = JSON.stringify(parsed, null, 2);
  } catch {
    // Non-JSON responses remain fixed text mocks.
  }

  let path = request.url;
  try {
    path = new URL(request.url).pathname;
  } catch {
    // Keep relative or manually edited URLs as-is.
  }

  return {
    sourceScenarioId,
    method: request.method.toUpperCase(),
    path,
    status: response.status,
    delayMs: 0,
    mode: "fixed",
    realBody: body,
    body,
    schema,
    arrayLength: 2,
  };
}

export function regenerateMockBody(draft: MockDraft): MockDraft {
  if (!draft.schema) throw new Error("当前响应无法推断 JSON Schema");
  const generated = generateMock(draft.schema, {
    arrayLength: Math.max(1, Math.min(100, Math.round(draft.arrayLength))),
    arrayDepthLimit: 8,
  });
  return { ...draft, mode: "generated", body: JSON.stringify(generated, null, 2) };
}

export function restoreFixedMockBody(draft: MockDraft): MockDraft {
  return { ...draft, mode: "fixed", body: draft.realBody };
}

export function buildMswHandler(draft: MockDraft): string {
  const method = draft.method.toLowerCase();
  const escapedPath = draft.path.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const delayLine = draft.delayMs > 0 ? `  await delay(${Math.round(draft.delayMs)});\n` : "";
  const parsed = (() => {
    try {
      return { json: true, value: parseJson(draft.body) };
    } catch {
      return { json: false, value: draft.body };
    }
  })();
  const responseExpression = parsed.json
    ? `HttpResponse.json(${JSON.stringify(parsed.value, null, 2)}, { status: ${draft.status} })`
    : `new HttpResponse(${JSON.stringify(String(parsed.value))}, { status: ${draft.status} })`;
  const imports = draft.delayMs > 0 ? "http, HttpResponse, delay" : "http, HttpResponse";

  return `import { ${imports} } from "msw";

export const devkitMock = http.${method}("**${escapedPath}", async () => {
${delayLine}  return ${responseExpression};
});
`;
}

export function exportMockDefinition(draft: MockDraft): string {
  return JSON.stringify(draft, null, 2);
}

export function compareResponses(baseline: ResponseSnapshot, current: ResponseSnapshot): ResponseDiff {
  const items: JsonDiffItem[] = [];
  let bodyKind: ResponseDiff["bodyKind"] = "json";
  let bodyChanged = false;
  try {
    walkDiff(parseJson(baseline.body), parseJson(current.body), "$", items);
    bodyChanged = items.length > 0;
  } catch {
    bodyKind = "text";
    bodyChanged = baseline.body !== current.body;
    if (bodyChanged) items.push({ path: "$", kind: "changed", before: baseline.body, after: current.body });
  }

  return {
    statusChanged: baseline.status !== current.status,
    durationDeltaMs: current.durationMs - baseline.durationMs,
    bodyKind,
    bodyChanged,
    items,
  };
}

export type RequestBodyMode = "none" | "json" | "text" | "form";
export type EditableValueType = "string" | "number" | "boolean" | "null" | "json";

export interface EditableEntry {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
  valueType: EditableValueType;
}

export interface ParsedReplayRequest {
  url: string;
  method: string;
  headers: EditableEntry[];
  params: EditableEntry[];
  bodyMode: RequestBodyMode;
  bodyFields: EditableEntry[];
  bodyText: string;
  timeoutMs: number;
  warnings: string[];
}

let entrySequence = 0;

export function createEditableEntry(
  key = "",
  value = "",
  enabled = true,
  valueType: EditableValueType = "string",
): EditableEntry {
  entrySequence += 1;
  return { id: `request-entry-${entrySequence}`, key, value, enabled, valueType };
}

function parseJsonLayers(value: unknown): unknown {
  let current = value;
  for (let depth = 0; depth < 3 && typeof current === "string"; depth += 1) {
    const trimmed = current.trim();
    if (!trimmed) return current;
    try {
      current = JSON.parse(trimmed);
    } catch {
      return current;
    }
  }
  return current;
}

function extractJsonValues(input: string): unknown[] {
  const trimmed = input.trim().replace(/^```(?:json|javascript|js)?\s*/i, "").replace(/\s*```$/, "");
  if (!trimmed) throw new Error("请粘贴请求 JSON");

  try {
    return [parseJsonLayers(JSON.parse(trimmed))];
  } catch {
    // Continue with a small scanner so "config JSON + body JSON" can be pasted together.
  }

  const values: unknown[] = [];
  let start = -1;
  let depth = 0;
  let quote = "";
  let escaped = false;

  for (let i = 0; i < trimmed.length; i += 1) {
    const char = trimmed[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === "{" || char === "[") {
      if (depth === 0) start = i;
      depth += 1;
    } else if (char === "}" || char === "]") {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        const candidate = trimmed.slice(start, i + 1);
        try {
          values.push(parseJsonLayers(JSON.parse(candidate)));
        } catch {
          // Keep scanning; the final error below is more useful than a partial parser error.
        }
        start = -1;
      }
    }
  }

  if (values.length === 0) throw new Error("未找到有效的请求 JSON");
  return values;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function editableValue(value: unknown): Pick<EditableEntry, "value" | "valueType"> {
  if (typeof value === "string") return { value, valueType: "string" };
  if (typeof value === "number") return { value: String(value), valueType: "number" };
  if (typeof value === "boolean") return { value: String(value), valueType: "boolean" };
  if (value === null) return { value: "null", valueType: "null" };
  if (typeof value === "object") return { value: JSON.stringify(value), valueType: "json" };
  return { value: "", valueType: "string" };
}

function entriesFromRecord(value: unknown, preserveTypes = false): EditableEntry[] {
  if (typeof value === "string") {
    const params = new URLSearchParams(value);
    return Array.from(params.entries(), ([key, item]) => createEditableEntry(key, item));
  }
  if (!isRecord(value)) return [];
  return Object.entries(value).map(([key, item]) => {
    const editable = editableValue(item);
    return createEditableEntry(
      key,
      editable.value,
      true,
      preserveTypes ? editable.valueType : "string",
    );
  });
}

function normalizeHeaders(value: unknown, method: string): Record<string, unknown> {
  if (!isRecord(value)) return {};
  const output: Record<string, unknown> = {};
  const methodKey = method.toLowerCase();

  const merge = (candidate: unknown) => {
    if (!isRecord(candidate)) return;
    for (const [key, item] of Object.entries(candidate)) {
      if (item !== undefined && item !== null) output[key] = item;
    }
  };

  merge(value.common);
  merge(value[methodKey]);
  for (const [key, item] of Object.entries(value)) {
    if (["common", "get", "post", "put", "patch", "delete", "head", "options"].includes(key.toLowerCase())) continue;
    if (item !== undefined && item !== null) output[key] = item;
  }
  return output;
}

function resolveUrl(urlValue: unknown, baseUrlValue: unknown, warnings: string[]): string {
  const url = typeof urlValue === "string" ? urlValue.trim() : "";
  const baseUrl = typeof baseUrlValue === "string" ? baseUrlValue.trim() : "";
  if (!url) return baseUrl;
  try {
    if (baseUrl) return new URL(url, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`).toString();
    return new URL(url).toString();
  } catch {
    if (!baseUrl) warnings.push("URL 是相对路径，请补充完整域名后再发送");
    return url;
  }
}

function inferBody(
  rawBody: unknown,
  headers: EditableEntry[],
): Pick<ParsedReplayRequest, "bodyMode" | "bodyFields" | "bodyText"> {
  if (rawBody === undefined || rawBody === null || rawBody === "") {
    return { bodyMode: "none", bodyFields: [], bodyText: "" };
  }

  const contentType = headers.find((entry) => entry.key.toLowerCase() === "content-type")?.value.toLowerCase() ?? "";
  const parsedBody = parseJsonLayers(rawBody);

  if (contentType.includes("application/x-www-form-urlencoded")) {
    return {
      bodyMode: "form",
      bodyFields: entriesFromRecord(parsedBody),
      bodyText: "",
    };
  }
  if (isRecord(parsedBody)) {
    return {
      bodyMode: "json",
      bodyFields: entriesFromRecord(parsedBody, true),
      bodyText: "",
    };
  }
  if (Array.isArray(parsedBody)) {
    return {
      bodyMode: "json",
      bodyFields: [],
      bodyText: JSON.stringify(parsedBody, null, 2),
    };
  }
  return {
    bodyMode: contentType.includes("application/json") ? "json" : "text",
    bodyFields: [],
    bodyText: editableValue(parsedBody).value,
  };
}

export function parseReplayRequest(input: string): ParsedReplayRequest {
  const values = extractJsonValues(input);
  const source = parseJsonLayers(values[0]);
  if (!isRecord(source)) throw new Error("请求配置必须是 JSON 对象");

  const warnings: string[] = [];
  const method = String(source.method ?? source.methods ?? "GET").toUpperCase();
  const headers = entriesFromRecord(normalizeHeaders(source.headers, method));
  const rawBody = source.body ?? source.data ?? values[1];
  const body = inferBody(rawBody, headers);

  return {
    url: resolveUrl(source.url, source.baseURL ?? source.baseUrl, warnings),
    method,
    headers,
    params: entriesFromRecord(source.params ?? source.query),
    timeoutMs: Number(source.timeout ?? source.timeoutMs ?? 30000) || 30000,
    warnings,
    ...body,
  };
}

export function entriesToObject(entries: EditableEntry[]): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const entry of entries) {
    const key = entry.key.trim();
    if (!entry.enabled || !key) continue;
    const raw = entry.value.trim();
    switch (entry.valueType) {
      case "string":
        output[key] = entry.value;
        break;
      case "number": {
        const numberValue = Number(raw);
        if (!Number.isFinite(numberValue)) throw new Error(`字段 ${key} 不是有效数字`);
        output[key] = numberValue;
        break;
      }
      case "boolean":
        if (raw !== "true" && raw !== "false") throw new Error(`字段 ${key} 只能是 true 或 false`);
        output[key] = raw === "true";
        break;
      case "null":
        output[key] = null;
        break;
      case "json":
        try {
          output[key] = JSON.parse(raw);
        } catch {
          throw new Error(`字段 ${key} 不是有效 JSON`);
        }
    }
  }
  return output;
}

export function entriesToStringRecord(entries: EditableEntry[]): Record<string, string> {
  const output: Record<string, string> = {};
  for (const entry of entries) {
    const key = entry.key.trim();
    if (entry.enabled && key) output[key] = entry.value;
  }
  return output;
}

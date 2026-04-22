/**
 * 解析 Knife4j / Swagger UI「复制文档」类 Markdown，提取路径、方法、JSON 示例与响应参数表，
 * 用于在无法拿到 raw OpenAPI 时生成近似 Mock。
 */

import { inferSchema } from "@/lib/json-mock-infer";

export type SwaggerMdExampleKind = "request" | "response" | "unknown";

export interface SwaggerMdJsonBlock {
  kind: SwaggerMdExampleKind;
  /** 原始围栏内文本 */
  raw: string;
  parsed: unknown;
}

export interface ParsedSwaggerMarkdown {
  /** 首个 ## 标题 */
  title?: string;
  path?: string;
  method?: string;
  /** 接口描述等首段纯文本（弱） */
  descriptionSnippet?: string;
  jsonBlocks: SwaggerMdJsonBlock[];
  /** 从「响应参数」表格推断的 JSON Schema（可能为 null） */
  responseTableSchema: Record<string, unknown> | null;
  warnings: string[];
}

const ENTITY_EM = "&emsp;";

function stripHtmlEntities(s: string): string {
  return s
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"');
}

/** `**接口地址**:`/path` 或反引号包裹 */
export function extractApiPath(text: string): string | undefined {
  const m1 = text.match(/\*\*接口地址\*\*[:：]\s*`([^`\r\n]+)`/);
  if (m1) return m1[1].trim();
  const m2 = text.match(/\*\*接口地址\*\*[:：]\s*([^\s\r\n`|]+)/);
  if (m2) return m2[1].trim();
  return undefined;
}

export function extractHttpMethod(text: string): string | undefined {
  const m = text.match(/\*\*请求方式\*\*[:：]\s*`?\s*([A-Za-z]+)\s*`?/m);
  if (!m) return undefined;
  const v = m[1].toLowerCase();
  if (["get", "post", "put", "patch", "delete", "options", "head"].includes(v)) return v;
  return v;
}

function extractFirstHeading(text: string): string | undefined {
  const m = text.match(/^#\s+(.+)$/m);
  if (m) return m[1].trim();
  const m2 = text.match(/^##\s+(.+)$/m);
  if (m2) return m2[1].trim();
  return undefined;
}

type LineSection = "none" | "request_example" | "response_example";

function parseMarkdownJsonBlocks(text: string): { blocks: SwaggerMdJsonBlock[]; warnings: string[] } {
  const warnings: string[] = [];
  const blocks: SwaggerMdJsonBlock[] = [];
  const lines = text.split(/\r?\n/);
  let section: LineSection = "none";
  let inFence = false;
  const buf: string[] = [];

  const flushFence = () => {
    const raw = buf.join("\n").trim();
    buf.length = 0;
    inFence = false;
    if (!raw) return;
    const t = raw.trim();
    if (!(t.startsWith("{") || t.startsWith("["))) return;
    try {
      const parsed = JSON.parse(t) as unknown;
      const kind: SwaggerMdExampleKind =
        section === "request_example" ? "request" : section === "response_example" ? "response" : "unknown";
      blocks.push({ kind, raw: t, parsed });
    } catch {
      warnings.push("某段代码围栏内容不是合法 JSON，已跳过");
    }
    section = "none";
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^\*\*请求示例\*\*/.test(trimmed)) {
      section = "request_example";
      continue;
    }
    if (/^\*\*响应示例\*\*/.test(trimmed)) {
      section = "response_example";
      continue;
    }
    if (/^\*\*请求参数\*\*/.test(trimmed) || /^\*\*响应参数\*\*/.test(trimmed)) {
      if (inFence) flushFence();
      section = "none";
      continue;
    }

    if (trimmed.startsWith("```")) {
      if (!inFence) {
        inFence = true;
        buf.length = 0;
        continue;
      }
      flushFence();
      continue;
    }
    if (inFence) buf.push(line);
  }
  if (inFence && buf.length) flushFence();

  return { blocks, warnings };
}

export interface ParamTableRow {
  name: string;
  /** 逻辑缩进：0 为根字段，1 为子字段（常见于数组元素对象） */
  depth: number;
  typeCell: string;
  schemaCell: string;
}

function parseParamNameCell(cell: string): { name: string; depth: number } {
  let c = stripHtmlEntities(cell).trim();
  let entities = 0;
  while (c.startsWith(ENTITY_EM)) {
    entities++;
    c = c.slice(ENTITY_EM.length);
  }
  const depth = entities === 0 ? 0 : Math.max(1, Math.floor(entities / 2));
  return { name: c.trim(), depth };
}

function mapTypeCellToSchema(typeCell: string, schemaCell: string): Record<string, unknown> {
  const raw = `${typeCell} ${schemaCell}`.trim().toLowerCase();

  if (/\barray\b/.test(raw)) {
    return { type: "array", items: { type: "object", properties: {}, required: [] as string[] } };
  }
  if (/\bboolean\b/.test(raw)) return { type: "boolean" };
  if (/\bnumber\b/.test(raw) && !/\binteger\b/.test(raw)) return { type: "number" };
  if (/\binteger\b|\bint\d+\b|\bint32\b|\bint64\b/.test(raw)) return { type: "integer" };
  if (/\bstring\s*\(\s*date\s*\)/.test(raw) || /\bdate\b.*\bstring\b/.test(raw)) {
    return { type: "string", format: "date" };
  }
  if (/\bstring\b/.test(raw)) return { type: "string" };
  return { type: "string" };
}

function isTableSeparatorRow(parts: string[]): boolean {
  if (parts.length < 2) return false;
  return parts.every((p) => /^-+$/.test(p.replace(/\s/g, "")) || /^:?-+:?$/.test(p.trim()));
}

/** 从「响应参数」标题后解析 Markdown 表格为 JSON Schema（根为 object） */
export function parseResponseParamTable(markdown: string): Record<string, unknown> | null {
  const idx = markdown.search(/\*\*响应参数\*\*/);
  if (idx < 0) return null;
  const after = markdown.slice(idx);
  const lines = after.split(/\r?\n/);
  const rows: ParamTableRow[] = [];
  let headerCols: string[] | null = null;

  for (const line of lines.slice(1)) {
    const t = line.trim();
    if (!t.startsWith("|")) {
      if (rows.length > 0 && /^\*\*/.test(t)) break;
      if (rows.length > 0) break;
      continue;
    }
    const parts = t
      .split("|")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (parts.length < 3) continue;

    const joinedHeader = parts.join(" ").toLowerCase();
    if (joinedHeader.includes("参数名称") && joinedHeader.includes("类型")) {
      headerCols = parts;
      continue;
    }
    if (headerCols && isTableSeparatorRow(parts)) continue;

    const nameCell = parts[0] ?? "";
    const typeCell = parts[headerCols && headerCols.length >= 4 ? 2 : Math.min(2, parts.length - 2)] ?? "";
    const schemaCell = parts[headerCols && headerCols.length >= 4 ? 3 : parts.length - 1] ?? "";
    if (/参数名称|类型|schema|说明/.test(nameCell) && parts.length <= 6) continue;

    const { name, depth } = parseParamNameCell(nameCell);
    if (!name || name === "参数名称") continue;
    rows.push({ name, depth, typeCell, schemaCell });
  }

  if (rows.length === 0) return null;

  const root: Record<string, unknown> = { type: "object", properties: {}, required: [] as string[] };
  const rootProps = root.properties as Record<string, unknown>;
  const rootReq = root.required as string[];

  let i = 0;
  const consumeChildren = (parentDepth: number): Record<string, unknown> => {
    const obj: Record<string, unknown> = { type: "object", properties: {}, required: [] as string[] };
    const props = obj.properties as Record<string, unknown>;
    const req = obj.required as string[];
    while (i < rows.length && rows[i].depth > parentDepth) {
      const r = rows[i];
      if (r.depth !== parentDepth + 1) break;
      const sch = mapTypeCellToSchema(r.typeCell, r.schemaCell);
      i++;
      if (sch.type === "array") {
        const items = sch.items as Record<string, unknown>;
        const itemObj = consumeChildren(parentDepth + 1);
        items.properties = (itemObj.properties as Record<string, unknown>) ?? {};
        items.required = (itemObj.required as string[]) ?? [];
        props[r.name] = sch;
        req.push(r.name);
      } else {
        props[r.name] = sch;
        req.push(r.name);
      }
    }
    return obj;
  };

  while (i < rows.length) {
    const r = rows[i];
    if (r.depth !== 0) {
      i++;
      continue;
    }
    const sch = mapTypeCellToSchema(r.typeCell, r.schemaCell);
    i++;
    if (sch.type === "array") {
      const items = sch.items as Record<string, unknown>;
      const itemObj = consumeChildren(0);
      items.properties = (itemObj.properties as Record<string, unknown>) ?? {};
      items.required = (itemObj.required as string[]) ?? [];
      rootProps[r.name] = sch;
      rootReq.push(r.name);
    } else {
      rootProps[r.name] = sch;
      rootReq.push(r.name);
    }
  }

  return root;
}

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/** 用表格推断的类型覆盖样本推断结果（同名字段） */
export function mergeInferredWithTableSchema(
  inferred: Record<string, unknown>,
  table: Record<string, unknown> | null,
): Record<string, unknown> {
  if (!table || table.type !== "object") return inferred;
  const out = deepClone(inferred) as Record<string, unknown>;
  const walk = (node: Record<string, unknown>, tbl: Record<string, unknown>) => {
    if (node.type !== "object" || !node.properties) return;
    const np = node.properties as Record<string, Record<string, unknown>>;
    const tp = tbl.properties as Record<string, Record<string, unknown>> | undefined;
    if (!tp) return;
    for (const key of Object.keys(tp)) {
      const tSch = tp[key];
      const nSch = np[key];
      if (!tSch || !nSch) continue;

      if (tSch.type === "integer" && (nSch.type === "number" || nSch.type === "integer")) {
        nSch.type = "integer";
      } else if (tSch.type === "number" && nSch.type === "integer") {
        nSch.type = "number";
      } else if (tSch.type === "boolean" && nSch.type !== "object" && nSch.type !== "array") {
        nSch.type = "boolean";
      } else if (tSch.type === "string") {
        nSch.type = "string";
        if (tSch.format) nSch.format = tSch.format;
      }

      if (tSch.type === "array" && nSch.type === "array") {
        const ti = (tSch.items ?? {}) as Record<string, unknown>;
        const ni = (nSch.items ?? {}) as Record<string, unknown>;
        if (ti.properties && typeof ti.properties === "object" && ni.type === "object") {
          walk(ni, ti);
        } else if (ti.properties && typeof ti.properties === "object" && Object.keys(ni).length === 0) {
          nSch.items = deepClone(ti);
        }
      } else if (tSch.type === "object" && nSch.type === "object") {
        walk(nSch, tSch);
      }
    }
  };
  walk(out, table);
  return out;
}

export function parseSwaggerMarkdownDoc(text: string): ParsedSwaggerMarkdown {
  const warnings: string[] = [];
  const title = extractFirstHeading(text);
  const path = extractApiPath(text);
  const method = extractHttpMethod(text);
  const { blocks, warnings: w2 } = parseMarkdownJsonBlocks(text);
  warnings.push(...w2);

  let responseTableSchema: Record<string, unknown> | null = null;
  try {
    responseTableSchema = parseResponseParamTable(text);
  } catch {
    warnings.push("「响应参数」表格解析失败，已忽略表格增强");
    responseTableSchema = null;
  }

  if (!path) warnings.push("未识别到「接口地址」，MSW 路径需手动填写");
  if (!method) warnings.push("未识别到「请求方式」，MSW 将默认使用 post");
  if (blocks.filter((b) => b.kind === "response").length === 0 && blocks.filter((b) => b.kind === "request").length === 0) {
    if (blocks.length > 0) warnings.push("未找到「请求示例 / 响应示例」标题下的 JSON，已使用文档中的其它 JSON 代码块");
  }

  return {
    title,
    path,
    method,
    jsonBlocks: blocks,
    responseTableSchema,
    warnings,
  };
}

export function pickExampleBlock(
  blocks: SwaggerMdJsonBlock[],
  kind: "response" | "request",
): SwaggerMdJsonBlock | undefined {
  const pref = blocks.filter((b) => b.kind === kind);
  if (pref.length) return kind === "request" ? pref[0] : pref[pref.length - 1];
  if (kind === "response") {
    const anyObj = [...blocks].reverse().find((b) => b.parsed !== null && typeof b.parsed === "object");
    return anyObj;
  }
  const req = blocks.find((b) => b.kind === "request");
  return req ?? blocks[0];
}

/** 从示例 + 可选表格得到用于 generateMock 的 Schema */
export function buildMockSchemaFromParsed(
  parsed: ParsedSwaggerMarkdown,
  target: "response" | "request",
  useTable: boolean,
): Record<string, unknown> {
  const block = pickExampleBlock(parsed.jsonBlocks, target);
  if (!block) return { type: "object", properties: {} };
  const inferred = inferSchema(block.parsed) as Record<string, unknown>;
  if (useTable && target === "response" && parsed.responseTableSchema) {
    return mergeInferredWithTableSchema(inferred, parsed.responseTableSchema);
  }
  return inferred;
}

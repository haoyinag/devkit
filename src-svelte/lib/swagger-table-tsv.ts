/**
 * 解析从 Swagger / Knife4j 等复制的「制表符表格」行，生成 JSON Schema（object + properties）。
 * 典型列：字段名、中文说明、integer(int64) 等类型（可有第 4 列空列）。
 */

const IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/** 最后一格是否为文档里的类型写法 */
export function isSwaggerTypeCell(cell: string): boolean {
  const s = cell.trim().replace(/\s+/g, " ");
  return /^(integer|int|long|number|float|double|string|boolean|bool)(?:\s*\([^)]*\))?\s*$/i.test(s);
}

function looksLikeHeaderRow(parts: string[]): boolean {
  if (parts.length < 2) return false;
  const joined = parts.join(" ").toLowerCase();
  if (/参数名|参数名称|字段名|字段|名称|类型|说明|描述/.test(joined)) return true;
  if (parts.some((p) => /^(name|field|type|description)$/i.test(p.trim()))) return true;
  return false;
}

function splitTableLine(line: string): string[] {
  if (line.includes("\t")) {
    const parts = line.split("\t").map((s) => s.trim());
    while (parts.length > 0 && parts[parts.length - 1] === "") parts.pop();
    return parts;
  }
  return line
    .split(/\s{2,}/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** 空格分隔兜底：含 union 写法时不猜测，交给上层通用表格解析 */
function parseSpaceSeparatedSwaggerRow(line: string): string[] | null {
  const s = line.trim();
  if (/\|\s*(null|string|number|boolean|integer|int)\b/i.test(s)) return null;
  const tight = s.match(
    /^([a-zA-Z_][a-zA-Z0-9_]*)\s+(integer|number|string|boolean|int|long|float|double)(\s*\([^)]*\))?\s*$/i,
  );
  if (tight) {
    const name = tight[1];
    const typeSpec = `${tight[2]}${tight[3] ?? ""}`.trim();
    if (isSwaggerTypeCell(typeSpec)) return [name, "", typeSpec];
  }
  const typeRe = /\b(integer|number|string|boolean|int|long|float|double)(\s*\([^)]*\))?\s*$/i;
  const m = s.match(typeRe);
  if (!m || m.index === undefined || m.index === 0) return null;
  const typeSpec = s.slice(m.index).trim();
  if (!isSwaggerTypeCell(typeSpec)) return null;
  const rest = s.slice(0, m.index).trim();
  const nm = rest.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s+([\s\S]+)$/);
  if (!nm) return null;
  const name = nm[1];
  const desc = nm[2].trim();
  if (!IDENT.test(name)) return null;
  return [name, desc, typeSpec];
}

/** 统一拆成 [字段名, ...说明片段, 类型] */
export function parseTableRowParts(line: string): string[] | null {
  const parts = splitTableLine(line);
  if (parts.length >= 2 && isSwaggerTypeCell(parts[parts.length - 1] ?? "")) {
    return parts;
  }
  return parseSpaceSeparatedSwaggerRow(line);
}

function normalizeTypeSpec(typeSpec: string): { jsonType: "integer" | "number" | "string" | "boolean"; format?: string } {
  const s = typeSpec.replace(/\s+/g, " ").trim();
  const paren = s.match(/\(\s*([^)]+?)\s*\)/);
  const inner = paren ? paren[1].trim().toLowerCase() : "";
  const head = s.replace(/\(\s*[^)]*\s*\)/, "").trim().toLowerCase();

  if (head === "boolean" || head === "bool") return { jsonType: "boolean" };
  if (head === "string") return { jsonType: "string" };
  if (head === "number" || head === "float" || head === "double") return { jsonType: "number" };

  if (head === "long") return { jsonType: "integer", format: "int64" };
  if (head === "int") return { jsonType: "integer", format: "int32" };
  if (head === "integer") {
    if (inner === "int64" || inner === "long") return { jsonType: "integer", format: "int64" };
    if (inner === "int32" || inner === "int") return { jsonType: "integer", format: "int32" };
    if (/^int\d+$/i.test(inner)) return { jsonType: "integer", format: inner.toLowerCase() };
    return { jsonType: "integer" };
  }
  return { jsonType: "string" };
}

/** 从说明里抽取「1-xxx 2-yyy」形式的整数枚举（常见于尿布状态等） */
export function tryParseNumericEnumFromDescription(desc: string): number[] | null {
  if (!desc || !/\d+\s*-\s*/.test(desc)) return null;
  const re = /(\d+)\s*-\s*[A-Za-z\u4e00-\u9fff]/g;
  const seen = new Set<number>();
  const order: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(desc)) !== null) {
    const n = Number.parseInt(m[1], 10);
    if (!Number.isFinite(n) || seen.has(n)) continue;
    seen.add(n);
    order.push(n);
  }
  return order.length >= 2 ? order : null;
}

function propertyFromTypeAndDescription(
  typeSpec: string,
  description: string,
): Record<string, unknown> {
  const { jsonType, format } = normalizeTypeSpec(typeSpec);
  const prop: Record<string, unknown> = { type: jsonType };
  if (format) prop.format = format;
  if (description) prop.description = description;

  if (jsonType === "integer" || jsonType === "number") {
    const en = tryParseNumericEnumFromDescription(description);
    if (en) prop.enum = en;
  }
  return prop;
}

export interface ParseSwaggerTsvResult {
  schema: {
    type: "object";
    properties: Record<string, Record<string, unknown>>;
    required: string[];
  };
  warnings: string[];
}

/**
 * 若无法识别为表格（无有效行），返回 null。
 */
export function parseSwaggerTsvTable(raw: string): ParseSwaggerTsvResult | null {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return null;

  let start = 0;
  const firstParts = parseTableRowParts(lines[0]) ?? splitTableLine(lines[0]);
  if (firstParts.length >= 2 && looksLikeHeaderRow(firstParts)) {
    start = 1;
  }

  const properties: Record<string, Record<string, unknown>> = {};
  const required: string[] = [];
  const warnings: string[] = [];

  for (let i = start; i < lines.length; i++) {
    const parts = parseTableRowParts(lines[i]);
    if (!parts || parts.length < 2) {
      warnings.push(`第 ${i + 1} 行无法识别（需 Tab 分隔或「字段名 说明 … 类型」格式），已跳过`);
      continue;
    }
    const typeSpec = parts[parts.length - 1];
    if (!isSwaggerTypeCell(typeSpec)) {
      warnings.push(`第 ${i + 1} 行未识别到类型列（末尾应为 integer(int64) 等），已跳过`);
      continue;
    }
    const name = parts[0];
    if (!IDENT.test(name)) {
      warnings.push(`第 ${i + 1} 行字段名无效「${name}」，已跳过`);
      continue;
    }
    const desc = parts.length > 2 ? parts.slice(1, -1).join(" ").trim() : "";
    properties[name] = propertyFromTypeAndDescription(typeSpec, desc);
    required.push(name);
  }

  if (Object.keys(properties).length === 0) return null;

  return {
    schema: { type: "object", properties, required },
    warnings,
  };
}

/** 整段文本是否更像 TSV 表格而非 JSON */
export function looksLikeSwaggerTsvTable(raw: string): boolean {
  const t = raw.trim();
  if (!t || t.startsWith("{") || t.startsWith("[")) return false;
  const lines = t.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return false;
  const hit = lines.filter((l) => {
    const p = parseTableRowParts(l);
    return p !== null && p.length >= 2 && isSwaggerTypeCell(p[p.length - 1] ?? "");
  });
  return hit.length >= Math.min(2, lines.length);
}

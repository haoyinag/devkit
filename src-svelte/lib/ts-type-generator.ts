import {
  detectSpecKind,
  getResponseBodyInfo,
  listJsonMediaTypes,
  listOperations,
  listResponseStatusKeys,
  parseOpenApiDocument,
  type JsonSchema,
} from "@/lib/openapi-mock";
import { parseSwaggerMarkdownDoc, pickExampleBlock } from "@/lib/swagger-doc-markdown";
import { parseSwaggerTsvTable } from "@/lib/swagger-table-tsv";

type ParseMode = "table" | "json" | "object-literal" | "openapi";

type TypeNode =
  | { kind: "primitive"; name: string }
  | { kind: "literal"; value: string | number | boolean | null }
  | { kind: "array"; element: TypeNode }
  | { kind: "object"; fields: FieldNode[]; indexSignature?: TypeNode }
  | { kind: "union"; members: TypeNode[] }
  | { kind: "named"; name: string };

interface FieldNode {
  name: string;
  optional: boolean;
  description?: string;
  type: TypeNode;
}

interface ParsedModel {
  rootName: string;
  rootType: TypeNode;
  namedTypes: Array<{ name: string; type: TypeNode; description?: string }>;
  warnings: string[];
  mode: ParseMode;
}

export interface TsTypeGeneratorResult {
  code: string;
  warnings: string[];
  mode: ParseMode;
}

const TABLE_HEADER_TOKENS = new Set([
  "参数名称",
  "参数说明",
  "请求类型",
  "是否必须",
  "数据类型",
  "schema",
  "字段名",
  "字段说明",
  "字段类型",
  "参数",
  "类型",
  "说明",
  "必须",
]);

const DEFAULT_ROOT_NAME = "GeneratedType";
const RECORD_TYPE_FIELD = "recordType";
const METHOD_PRIORITY: Record<string, number> = {
  get: 0,
  post: 1,
  put: 2,
  patch: 3,
  delete: 4,
  options: 5,
  head: 6,
};

const RECORD_TYPE_KEYWORDS: Record<string, string[]> = {
  pumping: ["pumping"],
  sleep: ["sleep", "nap"],
  mood: ["mood"],
  weight: ["weight"],
  feeding: ["feeding"],
  breastfeeding: ["breastfeed", "breast"],
  diaper: ["diaper", "stool", "urine"],
  period: ["period", "menstruation"],
  supplement: ["supplement", "vitamin"],
};

export function generateTypeDefinitions(input: string, rootName = DEFAULT_ROOT_NAME): TsTypeGeneratorResult {
  const model = parseInputToModel(input, rootName);
  return {
    code: emitTypeScript(model),
    warnings: model.warnings,
    mode: model.mode,
  };
}

function parseInputToModel(input: string, preferredRootName: string): ParsedModel {
  const raw = input.trim();
  if (!raw) throw new Error("请输入内容");

  const openapi = tryParseOpenApi(raw, preferredRootName);
  if (openapi) return openapi;

  const json = tryParseJson(raw, preferredRootName);
  if (json) return json;

  const objectLiteral = tryParseObjectLiteral(raw, preferredRootName);
  if (objectLiteral) return objectLiteral;

  const swaggerMarkdown = tryParseSwaggerMarkdown(raw, preferredRootName);
  if (swaggerMarkdown) return swaggerMarkdown;

  const table = tryParseTableLike(raw, preferredRootName);
  if (table) return table;

  throw new Error("无法识别输入格式：请粘贴 JSON、字段表格、对象片段或 OpenAPI/Swagger 文本");
}

function tryParseJson(raw: string, preferredRootName: string): ParsedModel | null {
  if (!(raw.startsWith("{") || raw.startsWith("["))) return null;
  try {
    const parsed = JSON.parse(raw);
    return {
      rootName: toTypeName(preferredRootName),
      rootType: inferTypeFromValue(parsed),
      namedTypes: [],
      warnings: [],
      mode: "json",
    };
  } catch {
    return null;
  }
}

function tryParseObjectLiteral(raw: string, preferredRootName: string): ParsedModel | null {
  if (!raw.includes("{") || !raw.includes(":")) return null;
  const bodyMatch = raw.match(/\{([\s\S]+)\}/);
  if (!bodyMatch) return null;

  const lines = bodyMatch[1]
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const fields: FieldNode[] = [];
  for (const line of lines) {
    const withoutTrailingComma = line.replace(/,$/, "");
    const match = withoutTrailingComma.match(/^([A-Za-z_$][\w$]*)\s*:\s*(.+)$/);
    if (!match) continue;
    const [, key, expr] = match;
    fields.push({
      name: key,
      optional: false,
      type: inferTypeFromExpression(expr),
    });
  }

  if (fields.length === 0) return null;
  return {
    rootName: toTypeName(preferredRootName),
    rootType: { kind: "object", fields },
    namedTypes: [],
    warnings: [],
    mode: "object-literal",
  };
}

function tryParseTableLike(raw: string, preferredRootName: string): ParsedModel | null {
  const swaggerTsv = parseSwaggerTsvTable(raw);
  if (swaggerTsv) {
    return {
      rootName: toTypeName(preferredRootName),
      rootType: typeFromJsonSchema(swaggerTsv.schema as JsonSchema, { warnings: swaggerTsv.warnings }),
      namedTypes: [],
      warnings: dedupeStrings(swaggerTsv.warnings),
      mode: "table",
    };
  }

  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return null;

  const fields: FieldNode[] = [];
  const namedTypes: Array<{ name: string; type: TypeNode; description?: string }> = [];
  const warnings: string[] = [];
  const typeNameCandidates: string[] = [];
  const namedTypeMap = new Map<string, { name: string; type: TypeNode; description?: string }>();

  for (const line of lines) {
    if (TABLE_HEADER_TOKENS.has(line)) continue;
    if (/^[A-Z][A-Za-z0-9_]*$/.test(line)) {
      typeNameCandidates.push(line);
      continue;
    }

    const cols = splitColumns(line);
    if (cols.length < 2) continue;

    const name = cols[0];
    if (!/^[A-Za-z_$][\w$]*$/.test(name)) continue;

    const requiredCol = cols.find((c) => /^(true|false|是|否|required|optional)$/i.test(c));
    const explicitTypeCol = findTypeColumn(cols);
    if (!explicitTypeCol) continue;

    const optional = requiredCol ? !/^(true|是|required)$/i.test(requiredCol) : true;
    const description = findDescriptionColumn(cols);
    const parsedType = parseTypeText(explicitTypeCol);
    const enumFromDescription = description
      ? inferEnumTypeFromDescription(description, parsedType.type)
      : null;
    const fieldType = enumFromDescription?.type ?? parsedType.type;
    if (enumFromDescription?.type) {
      const enumName = `${toTypeName(name)}Enum`;
      namedTypeMap.set(enumName, {
        name: enumName,
        type: enumFromDescription.type,
        description: `${name} 枚举值`,
      });
    }
    fields.push({
      name,
      optional,
      description: description ?? undefined,
      type:
        enumFromDescription?.type && name !== RECORD_TYPE_FIELD
          ? { kind: "named", name: `${toTypeName(name)}Enum` }
          : fieldType,
    });
    warnings.push(...parsedType.warnings);
    if (enumFromDescription?.warnings.length) warnings.push(...enumFromDescription.warnings);
  }

  if (fields.length === 0) return null;

  const rootName = toTypeName(typeNameCandidates[0] ?? preferredRootName);
  for (const item of namedTypeMap.values()) {
    namedTypes.push(item);
  }
  for (const candidate of typeNameCandidates.slice(1)) {
    const named = toTypeName(candidate);
    if (named !== rootName) {
      namedTypes.push({
        name: named,
        type: { kind: "named", name: rootName },
      });
    }
  }

  const unionModel = buildRecordTypeUnionModel(rootName, fields);
  if (unionModel) {
    namedTypes.push(...unionModel.namedTypes);
    return {
      rootName,
      rootType: unionModel.rootType,
      namedTypes,
      warnings: dedupeStrings([...warnings, ...unionModel.warnings]),
      mode: "table",
    };
  }

  return {
    rootName,
    rootType: { kind: "object", fields },
    namedTypes,
    warnings: dedupeStrings(warnings),
    mode: "table",
  };
}

function tryParseSwaggerMarkdown(raw: string, preferredRootName: string): ParsedModel | null {
  if (!/(\*\*响应参数\*\*|\*\*响应示例\*\*|\*\*请求示例\*\*)/.test(raw)) return null;
  const parsed = parseSwaggerMarkdownDoc(raw);
  if (parsed.responseTableSchema) {
    return {
      rootName: toTypeName(preferredRootName),
      rootType: typeFromJsonSchema(parsed.responseTableSchema as JsonSchema, { warnings: parsed.warnings }),
      namedTypes: [],
      warnings: dedupeStrings(parsed.warnings),
      mode: "table",
    };
  }
  const block = pickExampleBlock(parsed.jsonBlocks, "response") ?? pickExampleBlock(parsed.jsonBlocks, "request");
  if (!block) return null;
  return {
    rootName: toTypeName(preferredRootName),
    rootType: inferTypeFromValue(block.parsed),
    namedTypes: [],
    warnings: dedupeStrings(parsed.warnings),
    mode: "json",
  };
}

function splitColumns(line: string): string[] {
  if (line.includes("\t")) {
    return line
      .split("\t")
      .map((part) => part.trim())
      .filter(Boolean);
  }
  return line
    .split(/\s{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function findDescriptionColumn(cols: string[]): string | null {
  const candidates = cols.filter((col) => !looksLikeTypeToken(col) && !/^(true|false|是|否|required|optional)$/i.test(col));
  if (candidates.length < 2) return null;
  return candidates[1] ?? null;
}

function findTypeColumn(cols: string[]): string | null {
  for (let i = cols.length - 1; i >= 0; i -= 1) {
    if (looksLikeTypeToken(cols[i])) return cols[i];
  }
  return null;
}

function looksLikeTypeToken(text: string): boolean {
  const t = text.trim();
  const primitiveLike = /^(integer|int|number|string|boolean|bool|array|object)(\(.+\)|\[\])?$/i.test(t);
  const namedLike = /^[A-Z][A-Za-z0-9_]*(\[\])?$/.test(t);
  return primitiveLike || namedLike;
}

function parseTypeText(typeText: string): { type: TypeNode; warnings: string[] } {
  const t = typeText.trim();
  const warnings: string[] = [];
  const lower = t.toLowerCase();

  if (lower.endsWith("[]")) {
    const base = parseTypeText(t.slice(0, -2));
    return { type: { kind: "array", element: base.type }, warnings: base.warnings };
  }
  if (lower.startsWith("array<") && t.endsWith(">")) {
    const base = parseTypeText(t.slice(6, -1));
    return { type: { kind: "array", element: base.type }, warnings: base.warnings };
  }
  if (lower.startsWith("integer") || lower === "int" || lower.startsWith("number") || lower === "float" || lower === "double") {
    return { type: { kind: "primitive", name: "number" }, warnings };
  }
  if (lower.startsWith("boolean") || lower === "bool") return { type: { kind: "primitive", name: "boolean" }, warnings };
  if (lower.startsWith("string")) return { type: { kind: "primitive", name: "string" }, warnings };
  if (lower === "object") return { type: { kind: "object", fields: [], indexSignature: { kind: "primitive", name: "unknown" } }, warnings };
  if (/^[A-Z][A-Za-z0-9_]*$/.test(t)) return { type: { kind: "named", name: t }, warnings };

  warnings.push(`未识别类型 "${typeText}"，已回退为 unknown`);
  return { type: { kind: "primitive", name: "unknown" }, warnings };
}

function inferTypeFromExpression(expr: string): TypeNode {
  const e = expr.trim();
  if (/^["'`].*["'`]$/.test(e)) return { kind: "primitive", name: "string" };
  if (/^-?\d+(\.\d+)?$/.test(e)) return { kind: "primitive", name: "number" };
  if (e === "true" || e === "false") return { kind: "primitive", name: "boolean" };
  if (e === "null") return { kind: "literal", value: null };
  if (e === "[]") return { kind: "array", element: { kind: "primitive", name: "unknown" } };
  if (e === "{}") return { kind: "object", fields: [], indexSignature: { kind: "primitive", name: "unknown" } };
  if (e.includes("valueOrEmpty(")) return { kind: "primitive", name: "string" };
  if (e.includes("selectedDate")) return { kind: "primitive", name: "string" };
  return { kind: "primitive", name: "unknown" };
}

function inferEnumTypeFromDescription(
  description: string,
  baseType: TypeNode,
): { type: TypeNode | null; warnings: string[] } {
  const warnings: string[] = [];
  const numericEnumMatches = [
    ...description.matchAll(/(\d+)\s*[-:]\s*([A-Za-z][A-Za-z0-9 _/]*?)(?=\s+\d+\s*[-:]|$)/g),
  ];
  if (numericEnumMatches.length >= 2 && isPrimitiveNumberType(baseType)) {
    const literals = dedupeStrings(numericEnumMatches.map((m) => m[1]))
      .map((value) => Number.parseInt(value, 10))
      .filter((n) => Number.isFinite(n))
      .map((value) => ({ kind: "literal", value }) as TypeNode);
    if (literals.length >= 2) {
      return { type: { kind: "union", members: literals }, warnings };
    }
  }

  const valuesAfterLike = extractValuesAfterLikeKeyword(description);
  if (valuesAfterLike.length >= 2 && isPrimitiveStringType(baseType)) {
    const members = valuesAfterLike.map((value) => ({ kind: "literal", value }) as TypeNode);
    return { type: { kind: "union", members: dedupeTypeNodes(members) }, warnings };
  }

  if (numericEnumMatches.length >= 2 && !isPrimitiveNumberType(baseType)) {
    warnings.push("说明中疑似存在数字枚举，但字段类型不是 number，已保留原类型");
  }
  return { type: null, warnings };
}

function extractValuesAfterLikeKeyword(text: string): string[] {
  const normalized = text.replace(/\s+/g, " ");
  const match = normalized.match(/如\s*([A-Za-z0-9_,，、\-/\s]+?)(?:等|。|；|;|$)/);
  if (!match) return [];
  return dedupeStrings(
    match[1]
      .split(/[、,，/]/)
      .map((part) => part.trim())
      .filter((part) => /^[A-Za-z][A-Za-z0-9_-]*$/.test(part)),
  );
}

function inferTypeFromValue(value: unknown): TypeNode {
  if (value === null) return { kind: "literal", value: null };
  if (typeof value === "string") return { kind: "primitive", name: "string" };
  if (typeof value === "number") return { kind: "primitive", name: "number" };
  if (typeof value === "boolean") return { kind: "primitive", name: "boolean" };
  if (Array.isArray(value)) {
    if (value.length === 0) return { kind: "array", element: { kind: "primitive", name: "unknown" } };
    const members = dedupeTypeNodes(value.map((item) => inferTypeFromValue(item)));
    if (members.length === 1) return { kind: "array", element: members[0] };
    return { kind: "array", element: { kind: "union", members } };
  }
  if (typeof value === "object") {
    const fields = Object.entries(value as Record<string, unknown>).map(([key, child]) => ({
      name: key,
      optional: false,
      type: inferTypeFromValue(child),
    }));
    return { kind: "object", fields };
  }
  return { kind: "primitive", name: "unknown" };
}

function tryParseOpenApi(raw: string, preferredRootName: string): ParsedModel | null {
  if (!looksLikeOpenApi(raw)) return null;
  let spec: unknown;
  try {
    spec = parseOpenApiDocument(raw);
  } catch {
    return null;
  }

  const kind = detectSpecKind(spec);
  if (kind === "unknown") return null;
  const warnings: string[] = [];

  const rootName = toTypeName(preferredRootName);
  const namedTypes = parseNamedSchemas(spec, warnings);
  if (namedTypes.length > 0) {
    const rootNamed = namedTypes.find((x) => x.name === rootName) ?? namedTypes[0];
    if (namedTypes.length > 1 && rootNamed.name !== rootName) {
      warnings.push(`检测到 ${namedTypes.length} 个 schemas，默认以 ${rootNamed.name} 作为主类型`);
    }
    return {
      rootName: rootNamed.name,
      rootType: { kind: "named", name: rootNamed.name },
      namedTypes,
      warnings: dedupeStrings(warnings),
      mode: "openapi",
    };
  }

  const operations = listOperations(spec);
  if (operations.length > 0) {
    const op = pickOperation(operations);
    if (operations.length > 1) {
      warnings.push(`检测到 ${operations.length} 个接口，默认使用 ${op.method.toUpperCase()} ${op.path}`);
    }
    const statuses = listResponseStatusKeys(spec, op.path, op.method);
    const status = pickResponseStatus(statuses);
    if (statuses.length > 1) {
      warnings.push(`检测到多个响应码（${statuses.join(", ")}），默认使用 ${status}`);
    }
    const medias = listJsonMediaTypes(spec, op.path, op.method, status);
    const media = pickMediaType(medias);
    if (medias.length > 1) {
      warnings.push(`检测到多个 JSON 响应类型，默认使用 ${media}`);
    }
    const body = getResponseBodyInfo(spec, op.path, op.method, status, media);
    if (body.schema) {
      return {
        rootName,
        rootType: typeFromJsonSchema(body.schema, { spec, warnings }),
        namedTypes: [],
        warnings: dedupeStrings(warnings),
        mode: "openapi",
      };
    }
    warnings.push("未找到可用响应 schema，已回退为 unknown");
    return {
      rootName,
      rootType: { kind: "primitive", name: "unknown" },
      namedTypes: [],
      warnings: dedupeStrings(warnings),
      mode: "openapi",
    };
  }

  return null;
}

function looksLikeOpenApi(raw: string): boolean {
  const t = raw.toLowerCase();
  return (
    t.includes("openapi:") ||
    t.includes('"openapi"') ||
    t.includes("swagger:") ||
    t.includes('"swagger"') ||
    t.includes("components:") ||
    t.includes('"components"') ||
    t.includes("paths:")
  );
}

function parseNamedSchemas(spec: unknown, warnings: string[]): Array<{ name: string; type: TypeNode; description?: string }> {
  if (!spec || typeof spec !== "object") return [];
  const root = spec as Record<string, unknown>;
  const components = root.components;
  if (!components || typeof components !== "object") return [];
  const schemas = (components as Record<string, unknown>).schemas;
  if (!schemas || typeof schemas !== "object") return [];

  const out: Array<{ name: string; type: TypeNode; description?: string }> = [];
  for (const [name, schema] of Object.entries(schemas as Record<string, unknown>)) {
    if (!schema || typeof schema !== "object") continue;
    const schemaObj = schema as JsonSchema;
    out.push({
      name: toTypeName(name),
      type: typeFromJsonSchema(schemaObj, { spec, warnings }),
      description: typeof schemaObj.description === "string" ? schemaObj.description : undefined,
    });
  }
  return out;
}

interface SchemaContext {
  spec?: unknown;
  warnings: string[];
}

function typeFromJsonSchema(schema: JsonSchema, context: SchemaContext): TypeNode {
  const resolvedSchema = resolveRefSchema(schema, context);
  if (resolvedSchema !== schema) {
    return typeFromJsonSchema(resolvedSchema, context);
  }

  if (Array.isArray(schema.allOf) && schema.allOf.length > 0) {
    const members = schema.allOf.map((part) => typeFromJsonSchema(toSchema(part), context));
    const objectMembers = members.filter((x): x is Extract<TypeNode, { kind: "object" }> => x.kind === "object");
    if (objectMembers.length === members.length) {
      const requiredNames = new Set<string>();
      const mergedFields = new Map<string, FieldNode>();
      for (const obj of objectMembers) {
        for (const field of obj.fields) {
          const prev = mergedFields.get(field.name);
          if (!prev) {
            mergedFields.set(field.name, field);
          } else {
            mergedFields.set(field.name, { ...field, type: dedupeUnionMembers([prev.type, field.type]) });
          }
          if (!field.optional) requiredNames.add(field.name);
        }
      }
      const fields = [...mergedFields.values()].map((field) => ({ ...field, optional: !requiredNames.has(field.name) }));
      return maybeNullable({ kind: "object", fields }, schema, context);
    }
    context.warnings.push("allOf 包含非对象结构，已回退为第一个可识别类型");
    const first = members[0] ?? { kind: "primitive", name: "unknown" };
    return maybeNullable(first, schema, context);
  }

  if (Array.isArray(schema.oneOf) && schema.oneOf.length > 0) {
    return maybeNullable(
      { kind: "union", members: dedupeTypeNodes(schema.oneOf.map((item) => typeFromJsonSchema(toSchema(item), context))) },
      schema,
      context,
    );
  }
  if (Array.isArray(schema.anyOf) && schema.anyOf.length > 0) {
    return maybeNullable(
      { kind: "union", members: dedupeTypeNodes(schema.anyOf.map((item) => typeFromJsonSchema(toSchema(item), context))) },
      schema,
      context,
    );
  }
  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    const members: TypeNode[] = schema.enum.map((value): TypeNode => {
      if (value === null) return { kind: "literal", value: null } as TypeNode;
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        return { kind: "literal", value } satisfies TypeNode;
      }
      context.warnings.push("检测到复杂 enum 值，已降级为 unknown");
      return { kind: "primitive", name: "unknown" };
    });
    return maybeNullable({ kind: "union", members: dedupeTypeNodes(members) }, schema, context);
  }

  const schemaType = typeof schema.type === "string" ? schema.type : undefined;
  if (schemaType === "array") {
    const items = toSchema(schema.items);
    return maybeNullable({ kind: "array", element: typeFromJsonSchema(items, context) }, schema, context);
  }
  if (schemaType === "integer" || schemaType === "number") return maybeNullable({ kind: "primitive", name: "number" }, schema, context);
  if (schemaType === "boolean") return maybeNullable({ kind: "primitive", name: "boolean" }, schema, context);
  if (schemaType === "string") return maybeNullable({ kind: "primitive", name: "string" }, schema, context);
  if (schemaType === "null") return { kind: "literal", value: null };

  const properties = toRecord(schema.properties);
  if (schemaType === "object" || properties) {
    const requiredSet = new Set<string>(Array.isArray(schema.required) ? schema.required.filter((v): v is string => typeof v === "string") : []);
    const fields: FieldNode[] = [];
    if (properties) {
      for (const [key, value] of Object.entries(properties)) {
        const child = toSchema(value);
        fields.push({
          name: key,
          optional: !requiredSet.has(key),
          description: typeof child.description === "string" ? child.description : undefined,
          type: typeFromJsonSchema(child, context),
        });
      }
    }
    const additional = schema.additionalProperties;
    let indexSignature: TypeNode | undefined;
    if (additional === true) {
      indexSignature = { kind: "primitive", name: "unknown" };
    } else if (additional && typeof additional === "object") {
      indexSignature = typeFromJsonSchema(additional as JsonSchema, context);
    }
    return maybeNullable({ kind: "object", fields, indexSignature }, schema, context);
  }

  return maybeNullable({ kind: "primitive", name: "unknown" }, schema, context);
}

function resolveRefSchema(schema: JsonSchema, context: SchemaContext): JsonSchema {
  const ref = typeof schema.$ref === "string" ? schema.$ref : null;
  if (!ref) return schema;
  if (!context.spec) {
    context.warnings.push(`存在 $ref(${ref})，但当前上下文不可解析，已降级为 unknown`);
    return {};
  }
  const resolved = getSchemaByRef(context.spec, ref);
  if (!resolved) {
    context.warnings.push(`无法解析 $ref(${ref})，已降级为 unknown`);
    return {};
  }
  const merged: JsonSchema = {
    ...resolved,
    ...schema,
  };
  delete merged.$ref;
  return merged;
}

function getSchemaByRef(spec: unknown, ref: string): JsonSchema | null {
  if (!ref.startsWith("#/")) return null;
  let cur: unknown = spec;
  for (const key of ref.slice(2).split("/").map((part) => part.replace(/~1/g, "/").replace(/~0/g, "~"))) {
    if (!cur || typeof cur !== "object") return null;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur && typeof cur === "object" ? (cur as JsonSchema) : null;
}

function maybeNullable(base: TypeNode, schema: JsonSchema, context: SchemaContext): TypeNode {
  if (schema.nullable !== true) return base;
  if (containsNullMember(base)) return base;
  context.warnings.push("检测到 nullable 字段，已追加 null 联合类型");
  return dedupeUnionMembers([base, { kind: "literal", value: null }]);
}

function containsNullMember(type: TypeNode): boolean {
  if (type.kind === "literal") return type.value === null;
  if (type.kind === "union") return type.members.some((member) => containsNullMember(member));
  return false;
}

function dedupeUnionMembers(members: TypeNode[]): TypeNode {
  const normalized = dedupeTypeNodes(members.flatMap((member) => (member.kind === "union" ? member.members : [member])));
  if (normalized.length === 1) return normalized[0];
  return { kind: "union", members: normalized };
}

function pickOperation(operations: ReturnType<typeof listOperations>[number][]): ReturnType<typeof listOperations>[number] {
  const sorted = [...operations].sort((a, b) => {
    const ra = METHOD_PRIORITY[a.method] ?? 99;
    const rb = METHOD_PRIORITY[b.method] ?? 99;
    if (ra !== rb) return ra - rb;
    return a.path.localeCompare(b.path);
  });
  return sorted[0];
}

function pickResponseStatus(statuses: string[]): string {
  if (statuses.length === 0) return "200";
  const preferred = ["200", "201", "202", "default"];
  for (const key of preferred) {
    if (statuses.includes(key)) return key;
  }
  const success = statuses.find((code) => /^2\d\d$/.test(code));
  return success ?? statuses[0];
}

function pickMediaType(mediaTypes: string[]): string {
  if (mediaTypes.length === 0) return "application/json";
  return mediaTypes[0];
}

function buildRecordTypeUnionModel(
  rootName: string,
  fields: FieldNode[],
): { rootType: TypeNode; namedTypes: Array<{ name: string; type: TypeNode; description?: string }>; warnings: string[] } | null {
  const recordTypeField = fields.find((field) => field.name === RECORD_TYPE_FIELD);
  const recordTypeValues = getStringLiteralValues(recordTypeField?.type);
  if (!recordTypeField || recordTypeValues.length < 2) return null;

  const variantFieldMap = new Map<string, FieldNode[]>();
  for (const value of recordTypeValues) variantFieldMap.set(value, []);

  const commonFields: FieldNode[] = [];
  const warnings: string[] = [];
  for (const field of fields) {
    if (field.name === RECORD_TYPE_FIELD) continue;
    const matched = matchFieldToRecordTypes(field.name, recordTypeValues);
    if (matched.length === 1) {
      variantFieldMap.get(matched[0])?.push(field);
    } else {
      if (matched.length > 1) {
        warnings.push(`字段 "${field.name}" 同时命中多个 recordType，已放入公共字段`);
      }
      commonFields.push(field);
    }
  }

  const variantEntries = [...variantFieldMap.entries()].filter(([, variantFields]) => variantFields.length > 0);
  if (variantEntries.length < 2) return null;

  const namedTypes: Array<{ name: string; type: TypeNode; description?: string }> = [];
  const unionMembers: TypeNode[] = [];
  for (const [value, variantFields] of variantEntries) {
    const variantName = `${toTypeName(value)}${rootName}`;
    const discriminatedField: FieldNode = {
      name: RECORD_TYPE_FIELD,
      optional: false,
      type: { kind: "literal", value },
      description: recordTypeField.description,
    };
    const variantType: TypeNode = {
      kind: "object",
      fields: [discriminatedField, ...commonFields, ...variantFields],
    };
    namedTypes.push({
      name: variantName,
      type: variantType,
      description: `${value} 场景`,
    });
    unionMembers.push({ kind: "named", name: variantName });
  }

  return {
    rootType: { kind: "union", members: unionMembers },
    namedTypes,
    warnings,
  };
}

function getStringLiteralValues(type: TypeNode | undefined): string[] {
  if (!type) return [];
  if (type.kind === "literal" && typeof type.value === "string") return [type.value];
  if (type.kind !== "union") return [];
  return dedupeStrings(
    type.members
      .filter((member): member is Extract<TypeNode, { kind: "literal" }> => member.kind === "literal")
      .map((member) => member.value)
      .filter((value): value is string => typeof value === "string"),
  );
}

function matchFieldToRecordTypes(fieldName: string, recordTypes: string[]): string[] {
  const lowerField = fieldName.toLowerCase();
  const matched: string[] = [];
  for (const value of recordTypes) {
    const valueLower = value.toLowerCase();
    const keywords = RECORD_TYPE_KEYWORDS[valueLower] ?? [valueLower];
    if (keywords.some((kw) => lowerField.includes(kw))) matched.push(value);
  }
  return matched;
}

function toSchema(value: unknown): JsonSchema {
  if (value && typeof value === "object") return value as JsonSchema;
  return {};
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return null;
}

function emitTypeScript(model: ParsedModel): string {
  const chunks: string[] = [];
  for (const named of model.namedTypes) {
    if (named.description) {
      chunks.push("/**");
      chunks.push(` * ${named.description}`);
      chunks.push(" */");
    }
    chunks.push(renderNamedType(named.name, named.type));
    chunks.push("");
  }

  const hasRootNamedAlready = model.namedTypes.some((n) => n.name === model.rootName);
  if (!hasRootNamedAlready) {
    chunks.push(renderNamedType(model.rootName, model.rootType));
  }

  return chunks.join("\n").trim();
}

function renderNamedType(name: string, type: TypeNode): string {
  if (type.kind === "object") {
    return `export interface ${toTypeName(name)} ${renderObject(type, 0)}`;
  }
  return `export type ${toTypeName(name)} = ${renderType(type, 0)};`;
}

function renderObject(node: Extract<TypeNode, { kind: "object" }>, depth: number): string {
  const indent = "  ".repeat(depth);
  const fieldIndent = "  ".repeat(depth + 1);
  if (node.fields.length === 0 && !node.indexSignature) {
    return "{\n}";
  }

  const lines: string[] = ["{"];
  for (const field of node.fields) {
    if (field.description) {
      lines.push(`${fieldIndent}/** ${field.description} */`);
    }
    const key = isValidTsIdentifier(field.name) ? field.name : `'${field.name.replace(/'/g, "\\'")}'`;
    lines.push(`${fieldIndent}${key}${field.optional ? "?" : ""}: ${renderType(field.type, depth + 1)};`);
  }
  if (node.indexSignature) {
    lines.push(`${fieldIndent}[key: string]: ${renderType(node.indexSignature, depth + 1)};`);
  }
  lines.push(`${indent}}`);
  return lines.join("\n");
}

function renderType(type: TypeNode, depth: number): string {
  switch (type.kind) {
    case "primitive":
      return type.name;
    case "named":
      return toTypeName(type.name);
    case "literal":
      return typeof type.value === "string" ? JSON.stringify(type.value) : String(type.value);
    case "array":
      return `${wrapUnionMemberIfNeeded(renderType(type.element, depth), type.element)}[]`;
    case "union":
      return dedupeStrings(type.members.map((member) => renderType(member, depth))).join(" | ");
    case "object":
      return renderObject(type, depth);
    default:
      return "unknown";
  }
}

function wrapUnionMemberIfNeeded(text: string, node: TypeNode): string {
  return node.kind === "union" ? `(${text})` : text;
}

function toTypeName(input: string): string {
  const cleaned = input.trim().replace(/[^A-Za-z0-9_]+/g, " ");
  const parts = cleaned
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1));
  const name = parts.join("") || DEFAULT_ROOT_NAME;
  return /^[A-Za-z_]/.test(name) ? name : `T${name}`;
}

function isPrimitiveNumberType(type: TypeNode): boolean {
  return type.kind === "primitive" && type.name === "number";
}

function isPrimitiveStringType(type: TypeNode): boolean {
  return type.kind === "primitive" && type.name === "string";
}

function isValidTsIdentifier(name: string): boolean {
  return /^[A-Za-z_$][\w$]*$/.test(name);
}

function dedupeStrings(items: string[]): string[] {
  return [...new Set(items)];
}

function dedupeTypeNodes(nodes: TypeNode[]): TypeNode[] {
  const seen = new Set<string>();
  const out: TypeNode[] = [];
  for (const node of nodes) {
    const key = JSON.stringify(node);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(node);
  }
  return out;
}

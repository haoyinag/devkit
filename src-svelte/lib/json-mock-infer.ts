/** 从 JSON 样本推断 JSON Schema，并基于 Schema 生成随机 Mock（供 Mock 工具多页签复用） */

import { faker } from "@faker-js/faker";

// 格式识别正则库
const FORMAT_PATTERNS = {
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,}$/,
  ipv4: /^(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)$/,
  ipv6: /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|::1|::)$/,
  url: /^https?:\/\//,
  date: /^\d{4}-\d{2}-\d{2}$/,
  datetime: /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})/,
  creditcard: /^\d{13,19}$/,
  slug: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
};

export function inferSchema(value: unknown): object {
  if (value === null) return { type: "null" };

  if (typeof value === "boolean") return { type: "boolean" };

  if (typeof value === "number") {
    return Number.isInteger(value) ? { type: "integer" } : { type: "number" };
  }

  if (typeof value === "string") {
    const schema: Record<string, string> = { type: "string" };
    
    // 按优先级检测格式
    if (FORMAT_PATTERNS.uuid.test(value)) schema.format = "uuid";
    else if (FORMAT_PATTERNS.email.test(value)) schema.format = "email";
    else if (FORMAT_PATTERNS.phone.test(value)) schema.format = "phone";
    else if (FORMAT_PATTERNS.ipv4.test(value)) schema.format = "ipv4";
    else if (FORMAT_PATTERNS.ipv6.test(value)) schema.format = "ipv6";
    else if (FORMAT_PATTERNS.creditcard.test(value)) schema.format = "creditcard";
    else if (FORMAT_PATTERNS.datetime.test(value)) schema.format = "date-time";
    else if (FORMAT_PATTERNS.date.test(value)) schema.format = "date";
    else if (FORMAT_PATTERNS.url.test(value)) schema.format = "uri";
    else if (FORMAT_PATTERNS.slug.test(value)) schema.format = "slug";
    
    return schema;
  }

  if (Array.isArray(value)) {
    return {
      type: "array",
      items: value.length > 0 ? inferSchema(value[0]) : {},
    };
  }

  if (typeof value === "object") {
    const properties: Record<string, object> = {};
    const required: string[] = [];
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      properties[k] = inferSchema(v);
      required.push(k);
    }
    return { type: "object", properties, required };
  }

  return {};
}

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickNumericBounds(schema: Record<string, unknown>): { min: number; max: number; isInt: boolean } {
  const isInt = schema.type === "integer";
  let min = isInt ? 1 : 0;
  let max = isInt ? 1000 : 1000;
  const lo = schema.minimum as number | undefined;
  const hi = schema.maximum as number | undefined;
  if (typeof lo === "number") min = lo;
  if (typeof hi === "number") max = hi;
  if (typeof schema.exclusiveMinimum === "number") min = schema.exclusiveMinimum + (isInt ? 1 : Number.EPSILON);
  if (typeof schema.exclusiveMaximum === "number") max = schema.exclusiveMaximum - (isInt ? 1 : Number.EPSILON);
  if (min > max) [min, max] = [max, min];
  return { min, max, isInt };
}

export interface GenerateMockOptions {
  /** Fixed length for arrays whose schema path depth is within arrayDepthLimit. */
  arrayLength?: number;
  /** Maximum schema path depth where arrayLength should be applied. Root is depth 0. */
  arrayDepthLimit?: number;
}

const DEFAULT_ARRAY_DEPTH_LIMIT = 6;
const MAX_ARRAY_LENGTH = 100;
const MAX_ARRAY_DEPTH_LIMIT = 12;

function clampInt(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function pickArrayCount(schema: Record<string, unknown>, depth: number, options: GenerateMockOptions): number {
  const minI = typeof schema.minItems === "number" ? schema.minItems : 1;
  const maxI = typeof schema.maxItems === "number" ? schema.maxItems : 3;
  const lo = Math.min(minI, maxI);
  const hi = Math.max(minI, maxI);
  const depthLimit = clampInt(options.arrayDepthLimit ?? DEFAULT_ARRAY_DEPTH_LIMIT, 0, MAX_ARRAY_DEPTH_LIMIT);

  if (typeof options.arrayLength === "number" && depth <= depthLimit) {
    return clampInt(options.arrayLength, lo, Math.max(lo, typeof schema.maxItems === "number" ? hi : MAX_ARRAY_LENGTH));
  }

  return randInt(lo, hi);
}

function generateMockAtDepth(
  schema: Record<string, unknown>,
  options: GenerateMockOptions,
  depth: number,
): unknown {
  if ("const" in schema) return schema.const;

  const en = schema.enum;
  if (Array.isArray(en) && en.length > 0) {
    return en[randInt(0, en.length - 1)];
  }

  const type = schema.type as string | undefined;
  const format = schema.format as string | undefined;

  switch (type) {
    case "string": {
      // 使用 @faker-js/faker 生成格式化数据
      if (format === "uuid") return faker.string.uuid();
      if (format === "email") return faker.internet.email();
      if (format === "phone") return faker.phone.number({ style: "national" });
      if (format === "ipv4") return faker.internet.ipv4();
      if (format === "ipv6") return faker.internet.ipv6();
      if (format === "url" || format === "uri") return faker.internet.url();
      if (format === "slug") return faker.lorem.slug(3);
      if (format === "creditcard") return faker.finance.creditCardNumber();
      
      if (format === "date-time") {
        return faker.date.recent({ days: 365 }).toISOString();
      }
      if (format === "date") {
        return faker.date.recent({ days: 365 }).toISOString().split("T")[0];
      }
      
      // 默认生成可读的字符串
      return faker.lorem.word();
    }
    case "integer": {
      const { min, max } = pickNumericBounds(schema);
      let lo = Math.ceil(min);
      let hi = Math.floor(max);
      if (lo > hi) lo = hi;
      return randInt(lo, hi);
    }
    case "number": {
      const { min, max } = pickNumericBounds(schema);
      const t = min + Math.random() * (max - min || 1);
      const mult = schema.multipleOf as number | undefined;
      if (typeof mult === "number" && mult > 0) return Math.round(t / mult) * mult;
      return Math.round(t * 100) / 100;
    }
    case "boolean":
      return Math.random() < 0.5;
    case "null":
      return null;
    case "array": {
      const items = (schema.items ?? {}) as Record<string, unknown>;
      const count = pickArrayCount(schema, depth, options);
      return Array.from({ length: count }, () => generateMockAtDepth(items, options, depth + 1));
    }
    case "object": {
      const properties = (schema.properties ?? {}) as Record<string, Record<string, unknown>>;
      const obj: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(properties)) {
        obj[k] = generateMockAtDepth(v, options, depth + 1);
      }
      return obj;
    }
    default:
      return null;
  }
}

export function generateMock(schema: Record<string, unknown>, options: GenerateMockOptions = {}): unknown {
  return generateMockAtDepth(schema, options, 0);
}

export function listSchemaArrayPaths(schema: Record<string, unknown>, maxDepth = DEFAULT_ARRAY_DEPTH_LIMIT): string[] {
  const out: string[] = [];
  const limit = clampInt(maxDepth, 0, MAX_ARRAY_DEPTH_LIMIT);

  const walk = (node: Record<string, unknown>, path: string, depth: number) => {
    if (depth > limit) return;
    if (node.type === "array") {
      out.push(path);
      const items = node.items as Record<string, unknown> | undefined;
      if (items && typeof items === "object") walk(items, `${path}[]`, depth + 1);
      return;
    }
    if (node.type === "object" && node.properties && typeof node.properties === "object") {
      for (const [key, child] of Object.entries(node.properties as Record<string, unknown>)) {
        if (child && typeof child === "object") {
          walk(child as Record<string, unknown>, path === "$" ? `$.${key}` : `${path}.${key}`, depth + 1);
        }
      }
    }
  };

  walk(schema, "$", 0);
  return out;
}

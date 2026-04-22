/** 从 JSON 样本推断 JSON Schema，并基于 Schema 生成随机 Mock（供 Mock 工具多页签复用） */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^https?:\/\//;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})/;

export function inferSchema(value: unknown): object {
  if (value === null) return { type: "null" };

  if (typeof value === "boolean") return { type: "boolean" };

  if (typeof value === "number") {
    return Number.isInteger(value) ? { type: "integer" } : { type: "number" };
  }

  if (typeof value === "string") {
    const schema: Record<string, string> = { type: "string" };
    if (ISO_DATE_RE.test(value)) schema.format = "date-time";
    else if (EMAIL_RE.test(value)) schema.format = "email";
    else if (URL_RE.test(value)) schema.format = "uri";
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

const SYLLABLES = [
  "al", "ba", "ce", "da", "el", "fi", "go", "hi", "in", "jo",
  "ka", "la", "mi", "no", "op", "pa", "qu", "re", "si", "to",
];

let _counter = 0;

function nextId() {
  return ++_counter;
}

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randReadableString() {
  const len = randInt(2, 3);
  let s = "";
  for (let i = 0; i < len; i++) s += SYLLABLES[randInt(0, SYLLABLES.length - 1)];
  return `${s}_${nextId()}`;
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

export function generateMock(schema: Record<string, unknown>): unknown {
  if ("const" in schema) return schema.const;

  const en = schema.enum;
  if (Array.isArray(en) && en.length > 0) {
    return en[randInt(0, en.length - 1)];
  }

  const type = schema.type as string | undefined;
  const format = schema.format as string | undefined;

  switch (type) {
    case "string": {
      if (format === "date-time") {
        const d = new Date(Date.now() - randInt(0, 365 * 24 * 60 * 60 * 1000));
        return d.toISOString();
      }
      if (format === "date") {
        const d = new Date(Date.now() - randInt(0, 365 * 24 * 60 * 60 * 1000));
        return d.toISOString().slice(0, 10);
      }
      if (format === "email") return `user${nextId()}@example.com`;
      if (format === "uri") return `https://example.com/path/${nextId()}`;
      return randReadableString();
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
      const minI = typeof schema.minItems === "number" ? schema.minItems : 1;
      const maxI = typeof schema.maxItems === "number" ? schema.maxItems : 3;
      const count = randInt(Math.min(minI, maxI), Math.max(minI, maxI));
      return Array.from({ length: count }, () => generateMock(items));
    }
    case "object": {
      const properties = (schema.properties ?? {}) as Record<string, Record<string, unknown>>;
      const obj: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(properties)) {
        obj[k] = generateMock(v);
      }
      return obj;
    }
    default:
      return null;
  }
}

export function formatJson(
  input: string,
  sortKeys: boolean,
  indent: number = 2,
): string {
  const parsed = JSON.parse(input);
  if (sortKeys) {
    return JSON.stringify(sortObjectKeys(parsed), null, indent);
  }
  return JSON.stringify(parsed, null, indent);
}

export function minifyJson(input: string): string {
  return JSON.stringify(JSON.parse(input));
}

export function getByPath(input: string, path: string): string {
  const parsed = JSON.parse(input);
  const segments = parsePath(path);
  let current: unknown = parsed;

  for (const seg of segments) {
    if (current === null || current === undefined) {
      throw new Error(`路径 "${path}" 无法访问：中间值为 ${current}`);
    }
    if (typeof seg === "number") {
      if (!Array.isArray(current)) {
        throw new Error(`路径 "${path}" 无法访问：期望数组，实际为 ${typeof current}`);
      }
      current = (current as unknown[])[seg];
    } else {
      if (typeof current !== "object") {
        throw new Error(`路径 "${path}" 无法访问：期望对象，实际为 ${typeof current}`);
      }
      current = (current as Record<string, unknown>)[seg];
    }
  }

  if (typeof current === "object" && current !== null) {
    return JSON.stringify(current, null, 2);
  }
  return String(current);
}

function parsePath(path: string): (string | number)[] {
  const segments: (string | number)[] = [];
  const regex = /([^.\[\]]+)|\[(\d+)\]/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(path)) !== null) {
    if (match[2] !== undefined) {
      segments.push(Number(match[2]));
    } else if (match[1] !== undefined) {
      segments.push(match[1]);
    }
  }
  return segments;
}

function sortObjectKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys);
  }
  if (obj !== null && typeof obj === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(obj as Record<string, unknown>).sort()) {
      sorted[key] = sortObjectKeys((obj as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return obj;
}

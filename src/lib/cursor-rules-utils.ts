export interface CursorRuleFile {
  path: string;
  filename: string;
  content: string;
  project_root: string;
}

export interface RuleMeta {
  description?: string;
  alwaysApply?: boolean;
  globs?: string;
  [key: string]: unknown;
}

export interface ParsedRule {
  meta: RuleMeta;
  body: string;
}

export function parseRuleContent(content: string): ParsedRule {
  const lines = content.split("\n");
  if (lines[0]?.trim() !== "---") {
    return { meta: {}, body: content };
  }

  const endIdx = lines.findIndex((l, i) => i > 0 && l.trim() === "---");
  if (endIdx === -1) {
    return { meta: {}, body: content };
  }

  const meta: RuleMeta = {};
  for (let i = 1; i < endIdx; i++) {
    const line = lines[i];
    const colonIdx = line.indexOf(":");
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      const raw = line.slice(colonIdx + 1).trim();
      if (raw === "true") meta[key] = true;
      else if (raw === "false") meta[key] = false;
      else meta[key] = raw;
    }
  }

  const body = lines.slice(endIdx + 1).join("\n").trimStart();
  return { meta, body };
}

export function getSourceLabel(projectRoot: string): string {
  if (projectRoot.replace(/\\/g, "/").endsWith(".cursor")) return "全局";
  const parts = projectRoot.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] || projectRoot;
}

export function groupBySource(
  rules: CursorRuleFile[],
): [string, CursorRuleFile[]][] {
  const map = new Map<string, CursorRuleFile[]>();
  for (const rule of rules) {
    const key = rule.project_root;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(rule);
  }
  return Array.from(map.entries());
}

const STORAGE_KEY = "devkit-cursor-scan-paths";

export function getSavedScanPaths(): string[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : ["D:\\work\\code"];
  } catch {
    return ["D:\\work\\code"];
  }
}

export function saveScanPaths(paths: string[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(paths));
}

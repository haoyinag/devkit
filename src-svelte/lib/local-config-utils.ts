export type LocalConfigSource = "powershell" | "cmd" | "git" | "bash" | "vscode-snippet";

export interface LocalConfigItem {
  id: string;
  source_kind: LocalConfigSource;
  source_label: string;
  path: string;
  name: string;
  trigger: string;
  command: string;
  description: string;
  raw: string;
  category: string;
  language: string;
}

export interface ScanWarning {
  source_kind: LocalConfigSource | string;
  path: string;
  message: string;
}

export interface LocalConfigScanResult {
  items: LocalConfigItem[];
  warnings: ScanWarning[];
}

export const SOURCE_LABELS: Record<LocalConfigSource, string> = {
  powershell: "PowerShell",
  cmd: "CMD",
  git: "Git",
  bash: "Git Bash",
  "vscode-snippet": "VS Code Snippets",
};

export const SOURCE_ORDER: LocalConfigSource[] = ["powershell", "cmd", "git", "bash", "vscode-snippet"];

const STORAGE_KEY = "devkit-local-config-extra-cmd-paths";

export function getSavedExtraCmdPaths(): string[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

export function saveExtraCmdPaths(paths: string[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(paths));
}

export function groupBySource(items: LocalConfigItem[]): [LocalConfigSource, LocalConfigItem[]][] {
  const map = new Map<LocalConfigSource, LocalConfigItem[]>();
  for (const source of SOURCE_ORDER) map.set(source, []);
  for (const item of items) {
    const group = map.get(item.source_kind) ?? [];
    group.push(item);
    map.set(item.source_kind, group);
  }
  return SOURCE_ORDER.map((source) => [source, map.get(source) ?? []]);
}

export function getSourceLabel(source: LocalConfigSource | string): string {
  return SOURCE_LABELS[source as LocalConfigSource] ?? source;
}

export function filterLocalConfigs(items: LocalConfigItem[], query: string, source: LocalConfigSource | "all") {
  const q = query.trim().toLowerCase();
  return items.filter((item) => {
    if (source !== "all" && item.source_kind !== source) return false;
    if (!q) return true;
    return [
      item.name,
      item.trigger,
      item.command,
      item.description,
      item.raw,
      item.path,
      item.category,
      item.language,
    ].some((value) => value.toLowerCase().includes(q));
  });
}

export function summarizeItem(item: LocalConfigItem): string {
  if (item.description) return item.description;
  const firstLine = item.command.split("\n").find((line) => line.trim());
  return firstLine?.trim() ?? item.path;
}

export function sourceCounts(items: LocalConfigItem[]): Record<LocalConfigSource, number> {
  const counts = Object.fromEntries(SOURCE_ORDER.map((source) => [source, 0])) as Record<LocalConfigSource, number>;
  for (const item of items) counts[item.source_kind] += 1;
  return counts;
}

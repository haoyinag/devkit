import { useState, useEffect, useMemo, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  type CursorRuleFile,
  parseRuleContent,
  getSourceLabel,
  groupBySource,
  getSavedScanPaths,
  saveScanPaths,
} from "@/lib/cursor-rules-utils";
import {
  RefreshCw,
  ChevronDown,
  Copy,
  Check,
  FolderOpen,
  FileText,
  Plus,
  X,
  Settings2,
  ScrollText,
  CircleDot,
  Globe,
  Eye,
  FileCode,
} from "lucide-react";
import { RuleMarkdownBody } from "@/components/cursor-rules/RuleMarkdownBody";

export function CursorRulesTool() {
  const [rules, setRules] = useState<CursorRuleFile[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scanPaths, setScanPaths] = useState<string[]>(getSavedScanPaths);
  const [newPath, setNewPath] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [copied, setCopied] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  /** 正文展示：渲染 Markdown 或原始源码 */
  const [bodyView, setBodyView] = useState<"render" | "source">("render");

  const loadRules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await invoke<CursorRuleFile[]>("scan_cursor_rules", {
        workspaceRoots: scanPaths,
      });
      setRules(data);
      setSelectedPath((prev) => {
        if (prev && data.some((r) => r.path === prev)) return prev;
        return data.length > 0 ? data[0].path : null;
      });
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [scanPaths]);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  const groups = useMemo(() => groupBySource(rules), [rules]);

  const selectedRule = useMemo(
    () => rules.find((r) => r.path === selectedPath) ?? null,
    [rules, selectedPath],
  );
  const parsed = useMemo(
    () => (selectedRule ? parseRuleContent(selectedRule.content) : null),
    [selectedRule],
  );

  const handleAddPath = useCallback(() => {
    const trimmed = newPath.trim();
    if (!trimmed || scanPaths.includes(trimmed)) return;
    const next = [...scanPaths, trimmed];
    setScanPaths(next);
    saveScanPaths(next);
    setNewPath("");
  }, [newPath, scanPaths]);

  const handleRemovePath = useCallback(
    (path: string) => {
      const next = scanPaths.filter((p) => p !== path);
      setScanPaths(next);
      saveScanPaths(next);
    },
    [scanPaths],
  );

  const handleCopyPath = useCallback(async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }, []);

  const toggleGroup = useCallback((key: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h2 className="text-lg font-semibold">Cursor Rules</h2>
          <p className="text-sm text-muted-foreground">
            阅读与浏览 Cursor 规则（.mdc），正文支持 Markdown 渲染
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={cn(
              "rounded-md p-2 transition-colors",
              showSettings
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
            title="扫描路径设置"
          >
            <Settings2 size={16} />
          </button>
          <button
            onClick={loadRules}
            disabled={loading}
            className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
            title="刷新"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="border-b border-border bg-muted/30 px-6 py-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            工作区扫描路径（全局 ~/.cursor 自动扫描）
          </p>
          <div className="space-y-1.5">
            {scanPaths.map((p) => (
              <div
                key={p}
                className="flex items-center gap-2 rounded-md bg-background px-3 py-1.5 text-sm"
              >
                <FolderOpen size={14} className="shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate font-mono text-xs">{p}</span>
                <button
                  onClick={() => handleRemovePath(p)}
                  className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive"
                  title="移除"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <input
              value={newPath}
              onChange={(e) => setNewPath(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddPath()}
              placeholder="输入目录路径，如 D:\work\projects"
              className="min-w-0 flex-1 rounded-md border border-input bg-transparent px-3 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring"
              spellCheck={false}
            />
            <button
              onClick={handleAddPath}
              disabled={!newPath.trim()}
              className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-50"
            >
              <Plus size={14} />
              添加
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="px-6 py-3">
          <Badge variant="destructive">{error}</Badge>
        </div>
      )}

      {/* Main Content */}
      <div className="flex min-h-0 flex-1">
        {/* Left: Rule List */}
        <div className="flex w-64 shrink-0 flex-col border-r border-border">
          <div className="min-h-0 flex-1 overflow-y-auto py-2">
            {loading && rules.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                正在扫描规则文件…
              </p>
            ) : rules.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <ScrollText size={32} className="mx-auto mb-2 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">未找到规则文件</p>
                <p className="mt-1 text-xs text-muted-foreground/70">
                  请检查扫描路径设置
                </p>
              </div>
            ) : (
              groups.map(([projectRoot, groupRules]) => {
                const label = getSourceLabel(projectRoot);
                const isGlobal = label === "全局";
                const isCollapsed = collapsedGroups[projectRoot];

                return (
                  <div key={projectRoot} className="mb-1">
                    <button
                      onClick={() => toggleGroup(projectRoot)}
                      className="flex w-full items-center gap-2 px-4 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                      title={projectRoot}
                    >
                      <ChevronDown
                        size={12}
                        className={cn("shrink-0 transition-transform", isCollapsed && "-rotate-90")}
                      />
                      {isGlobal ? (
                        <Globe size={12} className="shrink-0" />
                      ) : (
                        <FolderOpen size={12} className="shrink-0" />
                      )}
                      <span className="truncate">{label}</span>
                      <span className="ml-auto shrink-0 text-muted-foreground/60">
                        {groupRules.length}
                      </span>
                    </button>

                    {!isCollapsed &&
                      groupRules.map((rule) => {
                        const isActive = rule.path === selectedPath;
                        const meta = parseRuleContent(rule.content).meta;
                        return (
                          <button
                            key={rule.path}
                            onClick={() => setSelectedPath(rule.path)}
                            className={cn(
                              "flex w-full items-center gap-2 rounded-md px-4 py-2 text-left text-sm transition-colors",
                              isActive
                                ? "bg-accent text-accent-foreground"
                                : "text-foreground/80 hover:bg-accent/50",
                            )}
                            title={rule.path}
                          >
                            <FileText size={14} className="shrink-0 text-muted-foreground" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">
                                {rule.filename.replace(".mdc", "")}
                              </p>
                              {meta.description && (
                                <p className="truncate text-xs text-muted-foreground">
                                  {meta.description as string}
                                </p>
                              )}
                            </div>
                            {meta.alwaysApply && (
                              <span title="始终应用">
                                <CircleDot size={10} className="shrink-0 text-green-500" />
                              </span>
                            )}
                          </button>
                        );
                      })}
                  </div>
                );
              })
            )}
          </div>

          {/* Summary */}
          {rules.length > 0 && (
            <div className="border-t border-border px-4 py-2">
              <p className="text-xs text-muted-foreground">
                共 {rules.length} 个规则，来自 {groups.length} 个来源
              </p>
            </div>
          )}
        </div>

        {/* Right: Detail */}
        <div className="flex min-w-0 flex-1 flex-col">
          {selectedRule && parsed ? (
            <>
              {/* Detail Header */}
              <div className="border-b border-border px-6 py-4">
                <h3 className="text-base font-semibold">{selectedRule.filename}</h3>

                {/* Path */}
                <div className="mt-2 flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate rounded bg-muted px-2.5 py-1 font-mono text-xs text-muted-foreground">
                    {selectedRule.path}
                  </span>
                  <button
                    onClick={() => handleCopyPath(selectedRule.path)}
                    className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                    title="复制路径"
                  >
                    {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                  </button>
                </div>

                {/* Meta badges + 正文视图切换 */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {parsed.meta.description && (
                    <Badge variant="secondary" className="gap-1 text-xs">
                      {parsed.meta.description as string}
                    </Badge>
                  )}
                  {parsed.meta.alwaysApply !== undefined && (
                    <Badge
                      variant={parsed.meta.alwaysApply ? "default" : "outline"}
                      className="text-xs"
                    >
                      {parsed.meta.alwaysApply ? "始终应用" : "按需应用"}
                    </Badge>
                  )}
                  {parsed.meta.globs && (
                    <Badge variant="outline" className="gap-1 font-mono text-xs">
                      {parsed.meta.globs as string}
                    </Badge>
                  )}
                  <span className="ml-auto flex shrink-0 gap-1 rounded-md border border-border p-0.5">
                    <button
                      type="button"
                      onClick={() => setBodyView("render")}
                      className={cn(
                        "flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors",
                        bodyView === "render"
                          ? "bg-accent text-accent-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                      title="格式化阅读"
                    >
                      <Eye size={12} />
                      阅读
                    </button>
                    <button
                      type="button"
                      onClick={() => setBodyView("source")}
                      className={cn(
                        "flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors",
                        bodyView === "source"
                          ? "bg-accent text-accent-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                      title="原始 Markdown 源码"
                    >
                      <FileCode size={12} />
                      源码
                    </button>
                  </span>
                </div>
              </div>

              {/* Content */}
              <div className="min-h-0 flex-1 overflow-auto p-6">
                {bodyView === "render" ? (
                  <RuleMarkdownBody markdown={parsed.body} />
                ) : (
                  <pre className="whitespace-pre-wrap break-words font-mono text-sm leading-relaxed text-foreground/90">
                    {parsed.body}
                  </pre>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center">
                <ScrollText size={48} className="mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">
                  {rules.length > 0 ? "选择左侧规则查看详情" : "暂无规则文件"}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

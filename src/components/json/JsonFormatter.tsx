import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { formatJson, minifyJson, getByPath } from "@/lib/json-utils";

type ViewMode = "text" | "highlight" | "tree";

interface Props {
  initialContent?: string;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function highlightJson(json: string): string {
  const escaped = escapeHtml(json);
  return escaped.replace(
    /("(?:\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*")\s*(:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g,
    (match, str, colon, keyword) => {
      if (str) {
        return colon
          ? `<span class="jh-key">${str}</span>${colon}`
          : `<span class="jh-str">${str}</span>`;
      }
      if (keyword === "true" || keyword === "false") return `<span class="jh-bool">${match}</span>`;
      if (keyword === "null") return `<span class="jh-null">${match}</span>`;
      return `<span class="jh-num">${match}</span>`;
    },
  );
}

function parseJsonError(input: string, errMsg: string): string {
  const posMatch = errMsg.match(/position\s+(\d+)/i);
  if (posMatch) {
    const pos = Number(posMatch[1]);
    const before = input.slice(0, pos);
    const line = (before.match(/\n/g) || []).length + 1;
    const col = pos - before.lastIndexOf("\n");
    return `${errMsg}（第 ${line} 行，第 ${col} 列）`;
  }
  return errMsg;
}

/* ---------- Tree View ---------- */

function TreeNode({ name, value, depth }: { name?: string; value: unknown; depth: number }) {
  const [expanded, setExpanded] = useState(depth < 2);

  if (value === null) return <Line name={name}><span className="jh-null">null</span></Line>;
  if (typeof value === "boolean") return <Line name={name}><span className="jh-bool">{String(value)}</span></Line>;
  if (typeof value === "number") return <Line name={name}><span className="jh-num">{value}</span></Line>;
  if (typeof value === "string") return <Line name={name}><span className="jh-str">"{value}"</span></Line>;

  const isArr = Array.isArray(value);
  const entries = isArr
    ? (value as unknown[]).map((v, i) => [String(i), v] as const)
    : Object.entries(value as Record<string, unknown>);
  const bracket = isArr ? ["[", "]"] : ["{", "}"];

  if (entries.length === 0) {
    return <Line name={name}><span>{bracket[0]}{bracket[1]}</span></Line>;
  }

  return (
    <div className="font-mono text-sm">
      <div
        className="flex cursor-pointer items-center gap-1 hover:bg-muted/50"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="w-4 text-center text-xs text-muted-foreground">{expanded ? "▼" : "▶"}</span>
        {name !== undefined && <span className="jh-key">"{name}"</span>}
        {name !== undefined && <span>: </span>}
        <span>{bracket[0]}</span>
        {!expanded && (
          <span className="text-muted-foreground"> {entries.length} 项 {bracket[1]}</span>
        )}
      </div>
      {expanded && (
        <div className="ml-4 border-l border-border pl-2">
          {entries.map(([k, v]) => (
            <TreeNode key={k} name={isArr ? undefined : k} value={v} depth={depth + 1} />
          ))}
        </div>
      )}
      {expanded && <div className="ml-4">{bracket[1]}</div>}
    </div>
  );
}

function Line({ name, children }: { name?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1 py-px font-mono text-sm">
      <span className="w-4" />
      {name !== undefined && <span className="jh-key">"{name}"</span>}
      {name !== undefined && <span>: </span>}
      {children}
    </div>
  );
}

/* ---------- Main ---------- */

export function JsonFormatter({ initialContent }: Props) {
  const [input, setInput] = useState(initialContent ?? "");
  const [output, setOutput] = useState("");
  const [sortKeys, setSortKeys] = useState(false);
  const [jsonPath, setJsonPath] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copyLabel, setCopyLabel] = useState("复制结果");
  const copyTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [viewMode, setViewMode] = useState<ViewMode>("text");

  useEffect(() => {
    if (initialContent) setInput(initialContent);
  }, [initialContent]);

  const parsedOutput = useMemo(() => {
    if (!output || viewMode === "text") return null;
    try {
      return JSON.parse(output);
    } catch {
      return null;
    }
  }, [output, viewMode]);

  const highlightedHtml = useMemo(() => {
    if (viewMode !== "highlight" || !output) return "";
    return highlightJson(output);
  }, [output, viewMode]);

  const handleFormat = useCallback(() => {
    try {
      setOutput(formatJson(input, sortKeys));
      setError(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "JSON 解析失败";
      setError(parseJsonError(input, msg));
      setOutput("");
    }
  }, [input, sortKeys]);

  const handleMinify = useCallback(() => {
    try {
      setOutput(minifyJson(input));
      setError(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "JSON 解析失败";
      setError(parseJsonError(input, msg));
      setOutput("");
    }
  }, [input]);

  const handleGetByPath = useCallback(() => {
    if (!jsonPath.trim()) { setError("请输入 JSON 路径"); return; }
    try {
      setOutput(getByPath(input, jsonPath));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "路径取值失败");
      setOutput("");
    }
  }, [input, jsonPath]);

  useEffect(() => () => clearTimeout(copyTimerRef.current), []);

  const handleCopy = useCallback(() => {
    if (output) {
      navigator.clipboard.writeText(output).then(() => {
        setCopyLabel("已复制");
        clearTimeout(copyTimerRef.current);
        copyTimerRef.current = setTimeout(() => setCopyLabel("复制结果"), 1500);
      });
    }
  }, [output]);

  const handleClear = useCallback(() => {
    setInput(""); setOutput(""); setError(null); setJsonPath("");
  }, []);

  return (
    <div className="tool-page-shell">
      <div className="tool-page-header">
        <h2 className="tool-page-title">JSON 工具</h2>
      </div>

      <div className="tool-page-actions">
        <Button onClick={handleFormat} size="sm">格式化</Button>
        <Button onClick={handleMinify} variant="secondary" size="sm">压缩</Button>
        <div className="flex items-center gap-2">
          <Switch id="sort-keys" checked={sortKeys} onCheckedChange={setSortKeys} />
          <Label htmlFor="sort-keys" className="text-sm">键排序</Label>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="路径，如 a.b[0].name"
            value={jsonPath}
            onChange={(e) => setJsonPath(e.target.value)}
            className="h-8 w-52 font-mono text-sm"
            onKeyDown={(e) => e.key === "Enter" && handleGetByPath()}
          />
          <Button onClick={handleGetByPath} variant="outline" size="sm">取值</Button>
        </div>
        <Button onClick={handleCopy} variant="ghost" size="sm" disabled={!output}>{copyLabel}</Button>
        <Button onClick={handleClear} variant="ghost" size="sm">清空</Button>

        <div className="ml-auto flex items-center rounded-lg bg-surface-2 p-0.5">
          {(["text", "highlight", "tree"] as ViewMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setViewMode(m)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                viewMode === m ? "bg-background text-foreground shadow-elev-1" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {{ text: "文本", highlight: "高亮", tree: "树形" }[m]}
            </button>
          ))}
        </div>
      </div>

      {error && <Badge variant="destructive" className="w-fit">{error}</Badge>}

      <div className="tool-dual-grid">
        <div className="tool-panel">
          <div className="tool-panel-label">
            <span className="text-sm font-medium text-muted-foreground">输入</span>
          </div>
          <div className="tool-panel-body">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder='粘贴 JSON，如 {"name": "DevKit"}'
              className="tool-input-area"
              spellCheck={false}
            />
          </div>
        </div>

        <div className="tool-panel">
          <div className="tool-panel-label">
            <span className="text-sm font-medium text-muted-foreground">输出</span>
          </div>
          <div className="tool-panel-body overflow-auto">
            {viewMode === "text" && (
              <textarea
                value={output}
                readOnly
                placeholder="处理结果将显示在这里"
                className="tool-input-area"
                spellCheck={false}
              />
            )}
            {viewMode === "highlight" && (
              <pre
                className="h-full overflow-auto whitespace-pre-wrap rounded-lg border border-border/70 bg-background p-3 font-mono text-sm"
                dangerouslySetInnerHTML={{ __html: highlightedHtml || '<span class="text-muted-foreground">处理结果将显示在这里</span>' }}
              />
            )}
            {viewMode === "tree" && (
              <div className="h-full overflow-auto rounded-lg border border-border/70 bg-background p-3">
                {parsedOutput !== null ? (
                  <TreeNode value={parsedOutput} depth={0} />
                ) : (
                  <span className="font-mono text-sm text-muted-foreground">
                    {output ? "无法解析为树形视图" : "处理结果将显示在这里"}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

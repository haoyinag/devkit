import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRightLeft,
  Trash2,
  FlaskConical,
  GitCompareArrows,
  Copy,
  Check,
} from "lucide-react";

interface DiffLine {
  type: "equal" | "removed" | "added";
  content: string;
  leftLine?: number;
  rightLine?: number;
}

interface DiffStats {
  changes: number;
  removed: number;
  added: number;
}

function sortJsonKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(sortJsonKeys);
  if (obj !== null && typeof obj === "object") {
    return Object.keys(obj as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortJsonKeys((obj as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }
  return obj;
}

function prepareLines(
  text: string,
  ignoreWhitespace: boolean,
  ignoreCase: boolean,
): string[] {
  let lines = text.split("\n");
  if (ignoreWhitespace) lines = lines.map((l) => l.replace(/\s+/g, " ").trim());
  if (ignoreCase) lines = lines.map((l) => l.toLowerCase());
  return lines;
}

function computeDiff(left: string[], right: string[]): DiffLine[] {
  const m = left.length;
  const n = right.length;

  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array<number>(n + 1).fill(0),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        left[i - 1] === right[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  const result: DiffLine[] = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && left[i - 1] === right[j - 1]) {
      result.push({ type: "equal", content: left[i - 1], leftLine: i, rightLine: j });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.push({ type: "added", content: right[j - 1], rightLine: j });
      j--;
    } else {
      result.push({ type: "removed", content: left[i - 1], leftLine: i });
      i--;
    }
  }

  return result.reverse();
}

function calcStats(lines: DiffLine[]): DiffStats {
  let removed = 0;
  let added = 0;
  let changes = 0;
  let prevType: string | null = null;
  for (const line of lines) {
    if (line.type === "removed") {
      removed++;
      if (prevType !== "removed" && prevType !== "added") changes++;
    } else if (line.type === "added") {
      added++;
      if (prevType !== "removed" && prevType !== "added") changes++;
    }
    prevType = line.type;
  }
  return { changes, removed, added };
}

const SAMPLE_LEFT = `{
  "name": "DevKit",
  "version": "1.0.0",
  "description": "开发者工具箱",
  "author": "张三",
  "dependencies": {
    "react": "^18.0.0",
    "typescript": "^5.0.0"
  }
}`;

const SAMPLE_RIGHT = `{
  "name": "DevKit",
  "version": "1.1.0",
  "description": "开发者工具箱 - 增强版",
  "author": "李四",
  "license": "MIT",
  "dependencies": {
    "react": "^19.0.0",
    "typescript": "^5.0.0",
    "tailwindcss": "^4.0.0"
  }
}`;

export function DiffTool() {
  const [left, setLeft] = useState("");
  const [right, setRight] = useState("");
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(false);
  const [ignoreCase, setIgnoreCase] = useState(false);
  const [jsonMode, setJsonMode] = useState(false);
  const [diffResult, setDiffResult] = useState<DiffLine[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCompare = useCallback(() => {
    setError(null);
    let leftText = left;
    let rightText = right;

    if (jsonMode) {
      try {
        const lObj = JSON.parse(leftText);
        leftText = JSON.stringify(sortJsonKeys(lObj), null, 2);
      } catch {
        setError("左侧 JSON 解析失败");
        setDiffResult(null);
        return;
      }
      try {
        const rObj = JSON.parse(rightText);
        rightText = JSON.stringify(sortJsonKeys(rObj), null, 2);
      } catch {
        setError("右侧 JSON 解析失败");
        setDiffResult(null);
        return;
      }
    }

    const leftLines = leftText.split("\n");
    const rightLines = rightText.split("\n");

    const cmpLeft = prepareLines(leftText, ignoreWhitespace, ignoreCase);
    const cmpRight = prepareLines(rightText, ignoreWhitespace, ignoreCase);

    const rawDiff = computeDiff(cmpLeft, cmpRight);

    const display: DiffLine[] = rawDiff.map((d) => {
      if (d.type === "equal" && d.leftLine != null) {
        return { ...d, content: leftLines[d.leftLine - 1] };
      }
      if (d.type === "removed" && d.leftLine != null) {
        return { ...d, content: leftLines[d.leftLine - 1] };
      }
      if (d.type === "added" && d.rightLine != null) {
        return { ...d, content: rightLines[d.rightLine - 1] };
      }
      return d;
    });

    setDiffResult(display);
  }, [left, right, ignoreWhitespace, ignoreCase, jsonMode]);

  const handleSwap = useCallback(() => {
    setLeft(right);
    setRight(left);
    setDiffResult(null);
  }, [left, right]);

  const handleClear = useCallback(() => {
    setLeft("");
    setRight("");
    setDiffResult(null);
    setError(null);
  }, []);

  const handleSample = useCallback(() => {
    setLeft(SAMPLE_LEFT);
    setRight(SAMPLE_RIGHT);
    setDiffResult(null);
    setError(null);
  }, []);

  const handleCopyDiff = useCallback(() => {
    if (!diffResult) return;
    const text = diffResult
      .map((d) => {
        const prefix = d.type === "removed" ? "- " : d.type === "added" ? "+ " : "  ";
        return prefix + d.content;
      })
      .join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [diffResult]);

  const stats = diffResult ? calcStats(diffResult) : null;
  const hasDiff = diffResult && diffResult.some((d) => d.type !== "equal");

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-6">
      <h2 className="text-2xl font-bold tracking-tight">Diff 对比</h2>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={handleCompare}>
          <GitCompareArrows size={14} className="mr-1" />
          对比
        </Button>
        <Button size="sm" variant="outline" onClick={handleSwap}>
          <ArrowRightLeft size={14} className="mr-1" />
          交换
        </Button>
        <Button size="sm" variant="ghost" onClick={handleClear}>
          <Trash2 size={14} className="mr-1" />
          清空
        </Button>
        <Button size="sm" variant="ghost" onClick={handleSample}>
          <FlaskConical size={14} className="mr-1" />
          示例数据
        </Button>

        <div className="mx-2 h-5 w-px bg-border" />

        <ToggleOption
          active={ignoreWhitespace}
          onClick={() => setIgnoreWhitespace((v) => !v)}
          label="忽略空白"
        />
        <ToggleOption
          active={ignoreCase}
          onClick={() => setIgnoreCase((v) => !v)}
          label="忽略大小写"
        />
        <ToggleOption
          active={jsonMode}
          onClick={() => setJsonMode((v) => !v)}
          label="JSON 对比"
        />
      </div>

      {error && (
        <Badge variant="destructive" className="w-fit">
          {error}
        </Badge>
      )}

      <div className="grid min-h-[200px] grid-cols-[1fr_auto_1fr] gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-muted-foreground">原始文本</label>
          <textarea
            value={left}
            onChange={(e) => setLeft(e.target.value)}
            placeholder="粘贴或输入原始文本..."
            className="h-full min-h-[180px] flex-1 resize-none rounded-lg border border-input bg-transparent px-3 py-2 font-mono text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            spellCheck={false}
          />
        </div>

        <div className="flex items-center">
          <button
            onClick={handleSwap}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="交换"
          >
            <ArrowRightLeft size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-muted-foreground">修改文本</label>
          <textarea
            value={right}
            onChange={(e) => setRight(e.target.value)}
            placeholder="粘贴或输入修改后文本..."
            className="h-full min-h-[180px] flex-1 resize-none rounded-lg border border-input bg-transparent px-3 py-2 font-mono text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            spellCheck={false}
          />
        </div>
      </div>

      {diffResult && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground">对比结果</span>
            {stats && (
              <span className="text-xs text-muted-foreground">
                共 {stats.changes} 处差异，删除{" "}
                <span className="text-red-500">{stats.removed}</span> 行，新增{" "}
                <span className="text-green-500">{stats.added}</span> 行
              </span>
            )}
            <div className="flex-1" />
            {hasDiff && (
              <Button size="sm" variant="ghost" onClick={handleCopyDiff}>
                {copied ? (
                  <>
                    <Check size={14} className="mr-1" />
                    已复制
                  </>
                ) : (
                  <>
                    <Copy size={14} className="mr-1" />
                    复制差异
                  </>
                )}
              </Button>
            )}
          </div>

          {!hasDiff ? (
            <div className="rounded-lg border border-dashed border-green-300 bg-green-50 px-4 py-8 text-center text-sm text-green-700 dark:border-green-700 dark:bg-green-900/20 dark:text-green-400">
              两侧内容完全一致，无差异
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border">
              <div className="max-h-[500px] overflow-auto">
                <table className="w-full border-collapse font-mono text-sm">
                  <tbody>
                    {diffResult.map((line, idx) => (
                      <tr
                        key={idx}
                        className={
                          line.type === "removed"
                            ? "bg-red-100 dark:bg-red-900/30"
                            : line.type === "added"
                              ? "bg-green-100 dark:bg-green-900/30"
                              : ""
                        }
                      >
                        <td className="w-12 select-none border-r px-2 py-0.5 text-right text-xs text-muted-foreground">
                          {line.leftLine ?? ""}
                        </td>
                        <td className="w-12 select-none border-r px-2 py-0.5 text-right text-xs text-muted-foreground">
                          {line.rightLine ?? ""}
                        </td>
                        <td className="w-6 select-none px-1 py-0.5 text-center text-xs">
                          {line.type === "removed"
                            ? "−"
                            : line.type === "added"
                              ? "+"
                              : ""}
                        </td>
                        <td className="whitespace-pre-wrap px-2 py-0.5">
                          {line.content || "\u00A0"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ToggleOption({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

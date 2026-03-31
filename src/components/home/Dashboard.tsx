import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TOOL_CATEGORIES, ALL_TOOLS, type ToolInfo } from "@/lib/tools";
import { detectContent, type Detection } from "@/lib/clipboard-detect";
import type { Page } from "@/types";
import {
  ArrowUp, ClipboardPaste, X, ExternalLink,
} from "lucide-react";

interface Props {
  recent: string[];
  onNavigate: (page: Page, content?: string) => void;
}

const CATEGORY_ICONS: Record<string, string> = {
  converters: "🔄",
  formatters: "📐",
  generators: "⚡",
  text: "📝",
  time: "⏰",
  cursor: "🖱️",
};

export function Dashboard({ recent, onNavigate }: Props) {
  const [detection, setDetection] = useState<Detection | null>(null);
  const [clipText, setClipText] = useState("");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const runDetect = useCallback((text: string) => {
    const result = detectContent(text);
    setDetection(result);
    setStatusMsg(
      !text.trim()
        ? null
        : result
          ? null
          : "未能识别类型，可手动选择工具",
    );
  }, []);

  const handleReadClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        setStatusMsg("剪贴板为空");
        return;
      }
      setClipText(text);
      runDetect(text);
    } catch {
      setStatusMsg("无法读取剪贴板");
    }
  }, [runDetect]);

  const handleClear = useCallback(() => {
    setClipText("");
    setDetection(null);
    setStatusMsg(null);
    textareaRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(() => {
    runDetect(clipText);
  }, [clipText, runDetect]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const MIN_H = 60;
    const MAX_H = 200;
    el.style.height = Math.max(MIN_H, Math.min(el.scrollHeight, MAX_H)) + "px";
    el.style.overflowY = el.scrollHeight > MAX_H ? "auto" : "hidden";
  }, [clipText]);

  const recentTools = recent
    .map((id) => ALL_TOOLS.find((t) => t.id === id))
    .filter(Boolean) as ToolInfo[];

  const hasText = clipText.trim().length > 0;

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">DevKit 工具箱</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          粘贴内容自动识别类型，或从下方选择工具
        </p>
      </div>

      {/* Smart Detection */}
      <div className="rounded-xl border border-input shadow-sm transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30">
        <textarea
          ref={textareaRef}
          value={clipText}
          onChange={(e) => {
            setClipText(e.target.value);
            runDetect(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && hasText) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder="输入或粘贴内容，自动识别类型（JSON / JWT / Base64 / URL / 时间戳 / UUID）"
          rows={2}
          className="block w-full resize-none bg-transparent px-4 py-3 font-mono text-sm outline-none placeholder:text-muted-foreground"
          style={{ minHeight: 60 }}
          spellCheck={false}
        />

        {/* Toolbar — structurally below textarea, never hidden */}
        <div className="space-y-2 border-t border-border/40 bg-muted/40 px-3 py-2">
          {/* Action row */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleReadClipboard}
              className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              title="读取剪贴板"
            >
              <ClipboardPaste size={14} />
              粘贴
            </button>

            {hasText && (
              <button
                onClick={handleClear}
                className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                title="清空"
              >
                <X size={14} />
                清空
              </button>
            )}

            <div className="min-w-0 flex-1" />

            {statusMsg && !detection && (
              <span className="shrink truncate text-xs text-muted-foreground">
                {statusMsg}
              </span>
            )}

            <button
              onClick={handleSubmit}
              disabled={!hasText}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity disabled:opacity-30"
              title="识别 (Ctrl+Enter)"
            >
              <ArrowUp size={16} />
            </button>
          </div>

          {/* Detection result row — separate line, never competes for space */}
          {detection && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-background px-3 py-2">
              <Badge variant="secondary" className="shrink-0 text-xs">
                {detection.type.toUpperCase()}
              </Badge>
              <span className="min-w-0 flex-1 truncate text-sm">
                识别为 <strong>{detection.label}</strong>
                {detection.confidence === "medium" && "（可能）"}
              </span>
              <Button
                size="sm"
                className="shrink-0 gap-1"
                onClick={() => onNavigate(detection.tool, clipText)}
              >
                <ExternalLink size={12} />
                打开
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Recent */}
      {recentTools.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-medium text-muted-foreground">最近使用</h3>
          <div className="flex flex-wrap gap-2">
            {recentTools.map((t) => (
              <Button
                key={t.id}
                variant="outline"
                size="sm"
                onClick={() => onNavigate(t.id)}
              >
                {t.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* All Tools */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TOOL_CATEGORIES.map((cat) => (
          <Card key={cat.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                {CATEGORY_ICONS[cat.id] || ""} {cat.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {cat.tools.map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => onNavigate(tool.id)}
                  className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
                >
                  <span className="font-medium">{tool.label}</span>
                  <span className="ml-2 shrink-0 text-xs text-muted-foreground">{tool.description}</span>
                </button>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

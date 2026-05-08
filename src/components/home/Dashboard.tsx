import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TOOL_CATEGORIES, ALL_TOOLS, type ToolInfo } from "@/lib/tools";
import { detectContent, type Detection } from "@/lib/clipboard-detect";
import type { Page } from "@/types";
import {
  ArrowUp, ClipboardPaste, X, ExternalLink, Sparkles, Blocks, History, FolderKanban,
  Repeat2, Scale, Zap, Type, Clock3, MousePointer2, Workflow,
} from "lucide-react";

interface Props {
  recent: string[];
  onNavigate: (page: Page, content?: string) => void;
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  converters: Repeat2,
  formatters: Scale,
  generators: Zap,
  text: Type,
  time: Clock3,
  cursor: MousePointer2,
  workflow: Workflow,
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
    <div className="min-h-0 flex h-full flex-col gap-4 overflow-auto bg-background p-5 md:gap-5 md:p-7">
      <div className="bg-brand-gradient-soft rounded-2xl border border-border/70 p-5 shadow-elev-1 md:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight md:text-[28px]">
              <span className="text-brand-gradient">DevKit 工具箱</span>
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              粘贴内容自动识别类型，或从下方选择工具
            </p>
          </div>
          <Badge
            variant="secondary"
            className="bg-brand-gradient w-fit gap-1.5 rounded-full px-3 py-1 text-xs text-primary-foreground shadow-elev-1"
          >
            <Sparkles size={12} />
            Phase 1 UI
          </Badge>
        </div>
      </div>

      {/* Smart Detection */}
      <Card className="border-border/70 bg-brand-gradient-soft shadow-elev-1">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Blocks size={16} className="text-muted-foreground" />
            智能识别
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="overflow-hidden rounded-xl border border-border/70 bg-background shadow-sm transition-colors">
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
          className="block w-full resize-none bg-transparent px-4 py-3 font-mono text-sm leading-relaxed placeholder:text-muted-foreground focus-visible:outline-none"
          style={{ minHeight: 60 }}
          spellCheck={false}
        />

        {/* Toolbar — structurally below textarea, never hidden */}
        <div className="space-y-2 border-t border-border/60 bg-surface-2/70 px-3 py-2.5">
          {/* Action row */}
          <div className="flex items-center gap-2">
            <Button
              onClick={handleReadClipboard}
              variant="ghost"
              size="sm"
              className="h-8 shrink-0 gap-1 px-2.5 text-xs text-muted-foreground hover:bg-background hover:text-foreground"
              title="读取剪贴板"
            >
              <ClipboardPaste size={14} />
              粘贴
            </Button>

            {hasText && (
              <Button
                onClick={handleClear}
                variant="ghost"
                size="sm"
                className="h-8 shrink-0 gap-1 px-2.5 text-xs text-muted-foreground hover:bg-background hover:text-foreground"
                title="清空"
              >
                <X size={14} />
                清空
              </Button>
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
              className="bg-brand-gradient flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-primary-foreground shadow-elev-1 transition-opacity disabled:opacity-30"
              title="识别 (Ctrl+Enter)"
            >
              <ArrowUp size={16} />
            </button>
          </div>

          {/* Detection result row — separate line, never competes for space */}
          {detection && (
            <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-background px-3 py-2 sm:flex-row sm:items-center">
              <div className="flex min-w-0 items-center gap-2">
                <Badge variant="secondary" className="shrink-0 text-xs">
                  {detection.type.toUpperCase()}
                </Badge>
                <span className="min-w-0 truncate text-sm">
                  识别为 <strong>{detection.label}</strong>
                  {detection.confidence === "medium" && "（可能）"}
                </span>
              </div>
              <div className="flex justify-end sm:ml-auto">
                <Button
                  size="sm"
                  className="shrink-0 gap-1"
                  onClick={() => onNavigate(detection.tool, clipText)}
                >
                  <ExternalLink size={12} />
                  打开
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
        </CardContent>
      </Card>

      {/* Recent */}
      {recentTools.length > 0 && (
        <Card className="border-border/70 bg-surface-1 shadow-elev-1">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <History size={16} className="text-muted-foreground" />
              最近使用
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {recentTools.map((t) => (
                <Button
                  key={t.id}
                  variant="outline"
                  size="sm"
                  className="border-border/70 bg-background hover:bg-surface-2"
                  onClick={() => onNavigate(t.id)}
                >
                  {t.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Tools */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {TOOL_CATEGORIES.map((cat) => (
          <Card key={cat.id} className="border-border/70 bg-surface-1 shadow-elev-1">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                {(() => {
                  const Icon = CATEGORY_ICONS[cat.id] || FolderKanban;
                  return <Icon size={14} className="text-muted-foreground" />;
                })()}
                {cat.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {cat.tools.map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => onNavigate(tool.id)}
                  className="group flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                  <span className="min-w-0 truncate font-medium">{tool.label}</span>
                  <span className="shrink-0 text-xs text-muted-foreground/90 transition-colors group-hover:text-muted-foreground">
                    {tool.description}
                  </span>
                </button>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

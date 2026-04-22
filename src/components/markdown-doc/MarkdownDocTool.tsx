import {
  useCallback,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
} from "react";
import { isTauri } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { Button } from "@/components/ui/button";
import { MarkdownArticle } from "@/components/markdown/markdown-components";
import { useLocalStorageDebounced } from "@/hooks/useLocalStorageDebounced";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { cn } from "@/lib/utils";
import {
  Columns2,
  Download,
  Eye,
  FileDown,
  FileText,
  LayoutTemplate,
  Pencil,
  Trash2,
} from "lucide-react";

const STORAGE_KEY = "devkit-markdown-doc";

const SAMPLE_MARKDOWN = `# Markdown 文档

欢迎使用 **DevKit** 的 Markdown 文档。支持 [GFM](https://github.github.com/gfm/) 表格与任务列表。

## 功能

- 编辑 / 分栏 / 仅预览 三种布局
- 自动保存到浏览器本地（防抖）
- 导入 / 导出 \`.md\` 文件

## 示例表格

| 列 A | 列 B |
|------|------|
| 1    | 2    |

## 任务

- [ ] 写 README
- [x] 试用草稿

\`\`\`ts
const x = "代码块";
\`\`\`
`;

type ViewMode = "edit" | "split" | "preview";

interface Props {
  initialContent?: string;
}

export function MarkdownDocTool({ initialContent = "" }: Props) {
  const [confirmAction, ConfirmActionDialog] = useConfirmDialog();
  const [content, setContent, persistError] = useLocalStorageDebounced(
    STORAGE_KEY,
    "",
    400,
  );
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const deferredPreviewMd = useDeferredValue(content);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const seededRef = useRef(false);

  useEffect(() => {
    if (seededRef.current || !initialContent.trim()) return;
    seededRef.current = true;
    setContent((v) => (v.trim() === "" ? initialContent : v));
  }, [initialContent, setContent]);

  const handleInsertSample = useCallback(() => {
    setContent(SAMPLE_MARKDOWN);
  }, [setContent]);

  const handleExport = useCallback(async () => {
    setExportError(null);
    setExporting(true);
    try {
      if (isTauri()) {
        try {
          const path = await save({
            defaultPath: "devkit-draft.md",
            filters: [{ name: "Markdown", extensions: ["md"] }],
          });
          if (path) {
            await writeTextFile(path, content, { create: true });
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          setExportError(`导出失败：${msg}`);
        }
        return;
      }
      try {
        const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "devkit-draft.md";
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.setTimeout(() => {
          URL.revokeObjectURL(url);
        }, 500);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setExportError(`导出失败：${msg}`);
      }
    } finally {
      setExporting(false);
    }
  }, [content]);

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      const replace = () => {
        const reader = new FileReader();
        reader.onload = () => {
          const text = typeof reader.result === "string" ? reader.result : "";
          setContent(text);
        };
        reader.readAsText(file, "UTF-8");
      };
      if (!content.trim()) {
        replace();
        return;
      }
      void confirmAction({
        title: "覆盖草稿",
        description: "导入将覆盖当前草稿，是否继续？",
        confirmText: "覆盖",
        variant: "destructive",
      }).then((ok) => {
        if (ok) replace();
      });
    },
    [content, setContent, confirmAction],
  );

  const handleClear = useCallback(() => {
    void confirmAction({
      title: "清空草稿",
      description: "确定清空草稿？此操作不可撤销。",
      confirmText: "清空",
      variant: "destructive",
    }).then((ok) => {
      if (ok) setContent("");
    });
  }, [setContent, confirmAction]);

  useEffect(() => () => clearTimeout(copyTimerRef.current), []);

  const handleCopyMd = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }, [content]);

  const showEditor = viewMode === "edit" || viewMode === "split";
  const showPreview = viewMode === "preview" || viewMode === "split";

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-6">
      {ConfirmActionDialog}
      <div>
        <h2 className="text-xl font-bold tracking-tight">Markdown 文档</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          编辑与实时预览，适合 README、接口说明、笔记草稿；内容自动保存在本机浏览器。
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
        <span className="mr-1 text-xs text-muted-foreground">布局</span>
        <Button
          type="button"
          variant={viewMode === "edit" ? "default" : "outline"}
          size="sm"
          className="gap-1"
          onClick={() => setViewMode("edit")}
        >
          <Pencil size={14} />
          仅编辑
        </Button>
        <Button
          type="button"
          variant={viewMode === "split" ? "default" : "outline"}
          size="sm"
          className="gap-1"
          onClick={() => setViewMode("split")}
        >
          <Columns2 size={14} />
          分栏
        </Button>
        <Button
          type="button"
          variant={viewMode === "preview" ? "default" : "outline"}
          size="sm"
          className="gap-1"
          onClick={() => setViewMode("preview")}
        >
          <Eye size={14} />
          仅预览
        </Button>

        <div className="mx-1 hidden h-6 w-px bg-border sm:block" />

        <Button type="button" variant="outline" size="sm" className="gap-1" onClick={handleImportClick}>
          <FileDown size={14} />
          导入
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".md,.markdown,text/markdown,text/plain"
          className="hidden"
          onChange={handleFileChange}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1"
          disabled={exporting}
          onClick={handleExport}
        >
          <Download size={14} />
          {exporting ? "导出中…" : "导出 .md"}
        </Button>
        <Button type="button" variant="outline" size="sm" className="gap-1" onClick={handleCopyMd}>
          <FileText size={14} />
          {copied ? "已复制" : "复制 Markdown"}
        </Button>
        <Button type="button" variant="outline" size="sm" className="gap-1" onClick={handleInsertSample}>
          <LayoutTemplate size={14} />
          插入示例
        </Button>
        <Button type="button" variant="ghost" size="sm" className="gap-1 text-destructive" onClick={handleClear}>
          <Trash2 size={14} />
          清空
        </Button>
      </div>

      {(persistError || exportError) && (
        <div className="space-y-1 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {persistError && <p>{persistError}</p>}
          {exportError && <p>{exportError}</p>}
        </div>
      )}

      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-0 overflow-hidden rounded-xl border border-input md:gap-0",
          viewMode === "split" && "md:flex-row",
        )}
      >
        {showEditor && (
          <div
            className={cn(
              "flex min-h-0 flex-col border-border md:min-h-0",
              viewMode === "split" ? "min-h-[200px] flex-1 border-b md:border-b-0 md:border-r md:min-h-0" : "flex-1",
            )}
          >
            <div className="shrink-0 border-b border-border bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
              源码
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="在此编写 Markdown…"
              spellCheck={false}
              className="min-h-0 flex-1 resize-none bg-transparent px-4 py-3 font-mono text-sm leading-relaxed outline-none placeholder:text-muted-foreground"
            />
          </div>
        )}
        {showPreview && (
          <div
            className={cn(
              "flex min-h-0 flex-col overflow-hidden bg-muted/20",
              viewMode === "split" ? "min-h-[200px] flex-1 md:min-h-0" : "flex-1",
            )}
          >
            <div className="shrink-0 border-b border-border bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
              预览
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {content.trim() ? (
                <MarkdownArticle markdown={deferredPreviewMd} className="max-w-none" />
              ) : (
                <p className="text-sm text-muted-foreground">
                  左侧输入内容后将在此渲染预览。可点击「插入示例」快速开始。
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

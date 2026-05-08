<script lang="ts">
  import { isTauri } from "@tauri-apps/api/core";
  import { save } from "@tauri-apps/plugin-dialog";
  import { writeTextFile } from "@tauri-apps/plugin-fs";
  import { marked } from "marked";

  interface Props {
    initialContent?: string;
  }

  type ViewMode = "edit" | "split" | "preview";

  const STORAGE_KEY = "devkit-markdown-doc";
  const SAMPLE_MARKDOWN = `# Markdown 文档

欢迎使用 **DevKit** 的 Markdown 文档。支持 GFM 表格与任务列表。

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
`;

  let { initialContent = "" }: Props = $props();
  let content = $state(localStorage.getItem(STORAGE_KEY) ?? "");
  let viewMode = $state<ViewMode>("split");
  let copied = $state(false);
  let exporting = $state(false);
  let exportError = $state<string | null>(null);
  let persistError = $state<string | null>(null);
  let fileInputRef = $state<HTMLInputElement | null>(null);
  let seeded = $state(false);

  $effect(() => {
    if (seeded || !initialContent.trim()) return;
    seeded = true;
    if (!content.trim()) content = initialContent;
  });

  let persistTimer = 0;
  $effect(() => {
    clearTimeout(persistTimer);
    persistTimer = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, content);
        persistError = null;
      } catch (e) {
        persistError = e instanceof Error ? `保存失败：${e.message}` : "保存失败";
      }
    }, 400);
  });

  const previewHtml = $derived(content.trim() ? (marked.parse(content) as string) : "");
  const showEditor = $derived(viewMode === "edit" || viewMode === "split");
  const showPreview = $derived(viewMode === "preview" || viewMode === "split");

  const handleInsertSample = () => {
    content = SAMPLE_MARKDOWN;
  };

  const handleExport = async () => {
    exportError = null;
    exporting = true;
    try {
      if (isTauri()) {
        try {
          const path = await save({
            defaultPath: "devkit-draft.md",
            filters: [{ name: "Markdown", extensions: ["md"] }],
          });
          if (path) await writeTextFile(path, content, { create: true });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          exportError = `导出失败：${msg}`;
        }
        return;
      }
      const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "devkit-draft.md";
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.setTimeout(() => URL.revokeObjectURL(url), 500);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      exportError = `导出失败：${msg}`;
    } finally {
      exporting = false;
    }
  };

  const handleImportClick = () => {
    fileInputRef?.click();
  };

  const handleFileChange = (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    const replace = () => {
      const reader = new FileReader();
      reader.onload = () => {
        content = typeof reader.result === "string" ? reader.result : "";
      };
      reader.readAsText(file, "UTF-8");
    };
    if (!content.trim()) {
      replace();
      return;
    }
    if (window.confirm("导入将覆盖当前草稿，是否继续？")) replace();
  };

  const handleClear = () => {
    if (window.confirm("确定清空草稿？此操作不可撤销。")) content = "";
  };

  const handleCopyMd = async () => {
    try {
      await navigator.clipboard.writeText(content);
      copied = true;
      setTimeout(() => (copied = false), 1500);
    } catch {
      // ignore
    }
  };
</script>

<div class="flex h-full min-h-0 flex-col gap-3 p-5">
  <div>
    <h2 class="text-xl font-bold tracking-tight">Markdown 文档</h2>
    <p class="mt-1 text-sm text-muted-foreground">编辑与实时预览，适合 README、接口说明、笔记草稿；内容自动保存在本机浏览器。</p>
  </div>

  <div class="flex flex-wrap items-center gap-2 border-b border-border pb-3">
    <span class="mr-1 text-xs text-muted-foreground">布局</span>
    <button class="btn h-8 text-sm" style:background={viewMode === "edit" ? "color-mix(in oklab, var(--primary) 24%, var(--card))" : undefined} onclick={() => (viewMode = "edit")}>仅编辑</button>
    <button class="btn h-8 text-sm" style:background={viewMode === "split" ? "color-mix(in oklab, var(--primary) 24%, var(--card))" : undefined} onclick={() => (viewMode = "split")}>分栏</button>
    <button class="btn h-8 text-sm" style:background={viewMode === "preview" ? "color-mix(in oklab, var(--primary) 24%, var(--card))" : undefined} onclick={() => (viewMode = "preview")}>仅预览</button>
    <div class="mx-1 hidden h-6 w-px bg-border sm:block"></div>
    <button class="btn h-8 text-sm" onclick={handleImportClick}>导入</button>
    <input bind:this={fileInputRef} type="file" accept=".md,.markdown,text/markdown,text/plain" class="hidden" onchange={handleFileChange} />
    <button class="btn h-8 text-sm" onclick={handleExport} disabled={exporting}>{exporting ? "导出中…" : "导出 .md"}</button>
    <button class="btn h-8 text-sm" onclick={handleCopyMd}>{copied ? "已复制" : "复制 Markdown"}</button>
    <button class="btn h-8 text-sm" onclick={handleInsertSample}>插入示例</button>
    <button class="btn h-8 text-sm text-destructive" onclick={handleClear}>清空</button>
  </div>

  {#if persistError || exportError}
    <div class="space-y-1 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {#if persistError}<p>{persistError}</p>{/if}
      {#if exportError}<p>{exportError}</p>{/if}
    </div>
  {/if}

  <div class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-input md:flex-row">
    {#if showEditor}
      <div class={`flex min-h-0 flex-col border-border ${viewMode === "split" ? "min-h-[200px] flex-1 border-b md:border-b-0 md:border-r md:min-h-0" : "flex-1"}`}>
        <div class="shrink-0 border-b border-border bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">源码</div>
        <textarea
          bind:value={content}
          placeholder="在此编写 Markdown…"
          spellcheck="false"
          class="min-h-0 flex-1 resize-none bg-transparent px-4 py-3 font-mono text-sm leading-relaxed outline-none placeholder:text-muted-foreground"
        ></textarea>
      </div>
    {/if}
    {#if showPreview}
      <div class={`flex min-h-0 flex-col overflow-hidden bg-muted/20 ${viewMode === "split" ? "min-h-[200px] flex-1 md:min-h-0" : "flex-1"}`}>
        <div class="shrink-0 border-b border-border bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">预览</div>
        <div class="min-h-0 flex-1 overflow-y-auto p-4">
          {#if content.trim()}
            <article class="max-w-none prose prose-sm dark:prose-invert">
              {@html previewHtml}
            </article>
          {:else}
            <p class="text-sm text-muted-foreground">左侧输入内容后将在此渲染预览。可点击“插入示例”快速开始。</p>
          {/if}
        </div>
      </div>
    {/if}
  </div>
</div>

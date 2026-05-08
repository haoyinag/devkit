<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import { marked } from "marked";
  import type { CursorRuleFile } from "@/lib/cursor-rules-utils";
  import {
    getSavedScanPaths,
    getSourceLabel,
    groupBySource,
    parseRuleContent,
    saveScanPaths,
  } from "@/lib/cursor-rules-utils";

  let rules = $state<CursorRuleFile[]>([]);
  let selectedPath = $state<string | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let scanPaths = $state<string[]>(getSavedScanPaths());
  let newPath = $state("");
  let showSettings = $state(true);
  let bodyView = $state<"render" | "source">("render");

  const loadRules = async () => {
    loading = true;
    error = null;
    try {
      const data = await invoke<CursorRuleFile[]>("scan_cursor_rules", { workspaceRoots: scanPaths });
      rules = data;
      if (!selectedPath || !data.some((r) => r.path === selectedPath)) selectedPath = data[0]?.path ?? null;
    } catch (err) {
      error = String(err);
    } finally {
      loading = false;
    }
  };
  $effect(() => {
    void loadRules();
  });

  const groups = $derived(groupBySource(rules));
  const selectedRule = $derived(rules.find((r) => r.path === selectedPath) ?? null);
  const parsed = $derived(selectedRule ? parseRuleContent(selectedRule.content) : null);
  const renderedHtml = $derived(parsed ? (marked.parse(parsed.body) as string) : "");

  const addPath = () => {
    const trimmed = newPath.trim();
    if (!trimmed || scanPaths.includes(trimmed)) return;
    const next = [...scanPaths, trimmed];
    scanPaths = next;
    saveScanPaths(next);
    newPath = "";
  };
  const removePath = (path: string) => {
    const next = scanPaths.filter((p) => p !== path);
    scanPaths = next;
    saveScanPaths(next);
  };
</script>

<div class="flex h-full flex-col">
  <div class="flex items-center justify-between border-b border-border px-5 py-4">
    <div><h2 class="text-lg font-semibold">Cursor Rules</h2><p class="text-sm text-muted-foreground">阅读与浏览 Cursor 规则（.mdc）</p></div>
    <div class="flex items-center gap-2"><button class="btn h-8 text-xs" onclick={() => (showSettings = !showSettings)}>路径设置</button><button class="btn h-8 text-xs" onclick={loadRules} disabled={loading}>{loading ? "刷新中…" : "刷新"}</button></div>
  </div>

  {#if showSettings}
    <div class="border-b border-border bg-muted/30 px-5 py-3">
      <p class="mb-2 text-xs font-medium text-muted-foreground">工作区扫描路径（全局 ~/.cursor 自动扫描）</p>
      <div class="space-y-1.5">
        {#each scanPaths as p}
          <div class="flex items-center gap-2 rounded-md bg-background px-3 py-1.5 text-sm"><span class="min-w-0 flex-1 truncate font-mono text-xs">{p}</span><button class="btn h-7 text-xs" onclick={() => removePath(p)}>移除</button></div>
        {/each}
      </div>
      <div class="mt-2 flex gap-2"><input bind:value={newPath} onkeydown={(e) => e.key === "Enter" && addPath()} placeholder="输入目录路径，如 D:\work\projects" class="input flex-1 text-sm" spellcheck="false" /><button class="btn h-9 text-xs" onclick={addPath} disabled={!newPath.trim()}>添加</button></div>
    </div>
  {/if}
  {#if error}<div class="px-5 py-2"><div class="w-fit rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</div></div>{/if}

  <div class="flex min-h-0 flex-1">
    <div class="flex w-72 shrink-0 flex-col border-r border-border">
      <div class="min-h-0 flex-1 overflow-y-auto py-2">
        {#if loading && rules.length === 0}
          <p class="px-4 py-6 text-center text-sm text-muted-foreground">正在扫描规则文件…</p>
        {:else if rules.length === 0}
          <p class="px-4 py-6 text-center text-sm text-muted-foreground">未找到规则文件</p>
        {:else}
          {#each groups as [projectRoot, groupRules]}
            <div class="mb-1">
              <div class="px-4 py-1.5 text-xs font-medium text-muted-foreground">{getSourceLabel(projectRoot)} · {groupRules.length}</div>
              {#each groupRules as rule}
                {@const meta = parseRuleContent(rule.content).meta}
                <button class={`flex w-full items-center gap-2 rounded-md px-4 py-2 text-left text-sm transition-colors ${rule.path === selectedPath ? "bg-accent text-accent-foreground" : "text-foreground/80 hover:bg-accent/50"}`} onclick={() => (selectedPath = rule.path)} title={rule.path}>
                  <span class="min-w-0 flex-1"><span class="block truncate text-sm font-medium">{rule.filename.replace(".mdc", "")}</span>{#if meta.description}<span class="block truncate text-xs text-muted-foreground">{String(meta.description)}</span>{/if}</span>
                </button>
              {/each}
            </div>
          {/each}
        {/if}
      </div>
    </div>
    <div class="flex min-w-0 flex-1 flex-col">
      {#if selectedRule && parsed}
        <div class="border-b border-border px-5 py-4">
          <h3 class="text-base font-semibold">{selectedRule.filename}</h3>
          <div class="mt-2 flex items-center gap-2"><span class="min-w-0 flex-1 truncate rounded bg-muted px-2.5 py-1 font-mono text-xs text-muted-foreground">{selectedRule.path}</span><button class="btn h-7 text-xs" onclick={() => navigator.clipboard.writeText(selectedRule.path)}>复制路径</button></div>
          <div class="mt-3 flex flex-wrap items-center gap-2">{#if parsed.meta.description}<span class="rounded bg-muted px-2 py-0.5 text-xs">{String(parsed.meta.description)}</span>{/if}<span class="ml-auto flex gap-1 rounded-md border border-border p-0.5"><button class={`btn h-7 text-xs ${bodyView === "render" ? "bg-accent" : ""}`} onclick={() => (bodyView = "render")}>阅读</button><button class={`btn h-7 text-xs ${bodyView === "source" ? "bg-accent" : ""}`} onclick={() => (bodyView = "source")}>源码</button></span></div>
        </div>
        <div class="min-h-0 flex-1 overflow-auto p-5">
          {#if bodyView === "render"}
            <article class="prose prose-sm max-w-none dark:prose-invert">{@html renderedHtml}</article>
          {:else}
            <pre class="whitespace-pre-wrap break-words font-mono text-sm leading-relaxed text-foreground/90">{parsed.body}</pre>
          {/if}
        </div>
      {:else}
        <div class="flex flex-1 items-center justify-center"><p class="text-sm text-muted-foreground">{rules.length > 0 ? "选择左侧规则查看详情" : "暂无规则文件"}</p></div>
      {/if}
    </div>
  </div>
</div>

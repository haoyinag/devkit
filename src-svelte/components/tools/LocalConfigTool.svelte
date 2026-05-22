<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import {
    SOURCE_ORDER,
    filterLocalConfigs,
    getSavedExtraCmdPaths,
    getSourceLabel,
    groupBySource,
    saveExtraCmdPaths,
    sourceCounts,
    summarizeItem,
    type LocalConfigItem,
    type LocalConfigScanResult,
    type LocalConfigSource,
    type ScanWarning,
  } from "@/lib/local-config-utils";

  let items = $state<LocalConfigItem[]>([]);
  let warnings = $state<ScanWarning[]>([]);
  let selectedId = $state<string | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let query = $state("");
  let sourceFilter = $state<LocalConfigSource | "all">("all");
  let extraCmdPaths = $state<string[]>(getSavedExtraCmdPaths());
  let newCmdPath = $state("");
  let showSettings = $state(false);
  let copied = $state<string | null>(null);

  const loadConfigs = async () => {
    loading = true;
    error = null;
    try {
      const result = await invoke<LocalConfigScanResult>("scan_local_dev_configs", { extraCmdPaths });
      items = result.items;
      warnings = result.warnings;
      if (!selectedId || !result.items.some((item) => item.id === selectedId)) {
        selectedId = result.items[0]?.id ?? null;
      }
    } catch (err) {
      error = String(err);
    } finally {
      loading = false;
    }
  };

  $effect(() => {
    void loadConfigs();
  });

  const filteredItems = $derived(filterLocalConfigs(items, query, sourceFilter));
  const groupedItems = $derived(groupBySource(filteredItems));
  const selectedItem = $derived(filteredItems.find((item) => item.id === selectedId) ?? filteredItems[0] ?? null);
  const counts = $derived(sourceCounts(items));
  const total = $derived(items.length);

  const addCmdPath = () => {
    const trimmed = newCmdPath.trim();
    if (!trimmed || extraCmdPaths.includes(trimmed)) return;
    const next = [...extraCmdPaths, trimmed];
    extraCmdPaths = next;
    saveExtraCmdPaths(next);
    newCmdPath = "";
  };

  const removeCmdPath = (path: string) => {
    const next = extraCmdPaths.filter((p) => p !== path);
    extraCmdPaths = next;
    saveExtraCmdPaths(next);
  };

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      copied = key;
      setTimeout(() => {
        if (copied === key) copied = null;
      }, 1200);
    } catch {
      copied = null;
    }
  };
</script>

<div class="flex h-full min-h-0 flex-col overflow-hidden">
  <div class="shrink-0 border-b border-border/80 px-5 py-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div class="flex flex-wrap items-center gap-2">
          <h2 class="text-lg font-semibold">本地配置</h2>
          <span class="rounded bg-muted px-2 py-0.5 text-xs">{total} 项</span>
          {#if warnings.length > 0}
            <span class="rounded bg-amber-500/10 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-300">{warnings.length} 个提示</span>
          {/if}
        </div>
        <p class="mt-1 text-sm text-muted-foreground">集中查看 PowerShell/CMD 快捷命令、Git alias 和 VS Code snippets。</p>
      </div>
      <div class="flex items-center gap-2">
        <button class="btn h-9 text-xs" onclick={() => (showSettings = !showSettings)}>CMD 路径</button>
        <button class="btn btn-primary h-9 text-xs" onclick={loadConfigs} disabled={loading}>
          {loading ? "扫描中..." : "重新扫描"}
        </button>
      </div>
    </div>

    <div class="mt-3 flex flex-wrap gap-2">
      <button class={`btn h-8 text-xs ${sourceFilter === "all" ? "bg-accent" : ""}`} onclick={() => (sourceFilter = "all")}>
        全部 {total}
      </button>
      {#each SOURCE_ORDER as source}
        <button
          class={`btn h-8 text-xs ${sourceFilter === source ? "bg-accent" : ""}`}
          onclick={() => (sourceFilter = source)}
        >
          {getSourceLabel(source)} {counts[source]}
        </button>
      {/each}
    </div>

    <input class="input mt-3 max-w-3xl text-sm" bind:value={query} placeholder="搜索命令、prefix、描述、内容或路径..." spellcheck="false" />
  </div>

  {#if showSettings}
    <div class="shrink-0 border-b border-border bg-muted/25 px-5 py-3">
      <p class="text-xs text-muted-foreground">CMD 会自动读取 AutoRun；如果你的 doskey 宏在其他 .cmd/.bat 文件里，可以在这里添加只读扫描路径。</p>
      <div class="mt-2 space-y-1.5">
        {#each extraCmdPaths as path}
          <div class="flex items-center gap-2 rounded-md bg-background px-3 py-1.5 text-sm">
            <span class="min-w-0 flex-1 truncate font-mono text-xs">{path}</span>
            <button class="btn h-7 text-xs" onclick={() => removeCmdPath(path)}>移除</button>
          </div>
        {/each}
      </div>
      <div class="mt-2 flex gap-2">
        <input
          class="input flex-1 text-sm"
          bind:value={newCmdPath}
          onkeydown={(event) => event.key === "Enter" && addCmdPath()}
          placeholder="例如 C:\Users\you\cmd-aliases.cmd"
          spellcheck="false"
        />
        <button class="btn h-9 text-xs" onclick={addCmdPath} disabled={!newCmdPath.trim()}>添加</button>
      </div>
    </div>
  {/if}

  {#if error}
    <div class="shrink-0 px-5 py-2">
      <div class="w-fit rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</div>
    </div>
  {/if}

  {#if warnings.length > 0}
    <details class="shrink-0 border-b border-border px-5 py-2 text-sm">
      <summary class="cursor-pointer text-muted-foreground">查看扫描提示</summary>
      <div class="mt-2 space-y-1">
        {#each warnings as warning}
          <p class="rounded bg-muted px-2 py-1 font-mono text-xs">
            [{warning.source_kind}] {warning.path}: {warning.message}
          </p>
        {/each}
      </div>
    </details>
  {/if}

  <div class="flex min-h-0 flex-1">
    <aside class="flex w-80 shrink-0 flex-col border-r border-border">
      <div class="min-h-0 flex-1 overflow-y-auto py-2">
        {#if loading && items.length === 0}
          <p class="px-4 py-6 text-center text-sm text-muted-foreground">正在扫描本地配置...</p>
        {:else if filteredItems.length === 0}
          <p class="px-4 py-6 text-center text-sm text-muted-foreground">没有匹配的配置项</p>
        {:else}
          {#each groupedItems as [source, sourceItems]}
            {#if sourceItems.length > 0}
              <div class="mb-2">
                <div class="px-4 py-1.5 text-xs font-medium text-muted-foreground">{getSourceLabel(source)} · {sourceItems.length}</div>
                {#each sourceItems as item}
                  <button
                    class={`flex w-full items-start gap-2 px-4 py-2 text-left text-sm transition-colors ${item.id === selectedItem?.id ? "bg-accent text-accent-foreground" : "text-foreground/80 hover:bg-accent/50"}`}
                    onclick={() => (selectedId = item.id)}
                    title={item.path}
                  >
                    <span class="min-w-0 flex-1">
                      <span class="block truncate font-medium">{item.trigger || item.name}</span>
                      <span class="block truncate text-xs text-muted-foreground">{summarizeItem(item)}</span>
                    </span>
                    {#if item.language}
                      <span class="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{item.language}</span>
                    {/if}
                  </button>
                {/each}
              </div>
            {/if}
          {/each}
        {/if}
      </div>
    </aside>

    <section class="flex min-w-0 flex-1 flex-col">
      {#if selectedItem}
        <div class="shrink-0 border-b border-border px-5 py-4">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <h3 class="truncate text-base font-semibold">{selectedItem.name}</h3>
                <span class="rounded bg-muted px-2 py-0.5 text-xs">{getSourceLabel(selectedItem.source_kind)}</span>
                {#if selectedItem.category}
                  <span class="rounded bg-muted px-2 py-0.5 text-xs">{selectedItem.category}</span>
                {/if}
              </div>
              {#if selectedItem.description}
                <p class="mt-1 text-sm text-muted-foreground">{selectedItem.description}</p>
              {/if}
            </div>
            <div class="flex flex-wrap gap-2">
              <button class="btn h-8 text-xs" onclick={() => copy(selectedItem.trigger, `trigger:${selectedItem.id}`)}>
                {copied === `trigger:${selectedItem.id}` ? "已复制" : "复制触发词"}
              </button>
              <button class="btn h-8 text-xs" onclick={() => copy(selectedItem.command, `command:${selectedItem.id}`)}>
                {copied === `command:${selectedItem.id}` ? "已复制" : "复制内容"}
              </button>
              <button class="btn h-8 text-xs" onclick={() => copy(selectedItem.path, `path:${selectedItem.id}`)}>
                {copied === `path:${selectedItem.id}` ? "已复制" : "复制路径"}
              </button>
            </div>
          </div>
          <div class="mt-3 rounded bg-muted px-2.5 py-1 font-mono text-xs text-muted-foreground">{selectedItem.path}</div>
        </div>

        <div class="min-h-0 flex-1 overflow-auto p-5">
          <div class="grid gap-4 xl:grid-cols-2">
            <section>
              <h4 class="mb-2 text-sm font-semibold">解析内容</h4>
              <pre class="min-h-48 whitespace-pre-wrap break-words rounded-md bg-muted/60 p-3 font-mono text-sm leading-relaxed ring-1 ring-border/70">{selectedItem.command || selectedItem.trigger}</pre>
            </section>
            <section>
              <h4 class="mb-2 text-sm font-semibold">原始定义</h4>
              <pre class="min-h-48 whitespace-pre-wrap break-words rounded-md bg-muted/60 p-3 font-mono text-sm leading-relaxed ring-1 ring-border/70">{selectedItem.raw}</pre>
            </section>
          </div>
        </div>
      {:else}
        <div class="flex flex-1 items-center justify-center">
          <p class="text-sm text-muted-foreground">请选择一个配置项</p>
        </div>
      {/if}
    </section>
  </div>
</div>

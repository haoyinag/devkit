<script lang="ts">
  import JsonTreeNode from "@app/components/tools/json/JsonTreeNode.svelte";
  import { formatJson, getByPath, minifyJson } from "@/lib/json-utils";

  interface Props {
    initialContent?: string;
  }

  type ViewMode = "text" | "highlight" | "tree";
  let { initialContent = "" }: Props = $props();

  let input = $state("");
  let output = $state("");
  let sortKeys = $state(false);
  let jsonPath = $state("");
  let error = $state<string | null>(null);
  let copyLabel = $state("复制结果");
  let viewMode = $state<ViewMode>("text");

  $effect(() => {
    if (initialContent && !input) input = initialContent;
  });

  const parseJsonError = (text: string, errMsg: string) => {
    const posMatch = errMsg.match(/position\s+(\d+)/i);
    if (!posMatch) return errMsg;
    const pos = Number(posMatch[1]);
    const before = text.slice(0, pos);
    const line = (before.match(/\n/g) || []).length + 1;
    const col = pos - before.lastIndexOf("\n");
    return `${errMsg}（第 ${line} 行，第 ${col} 列）`;
  };

  const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const highlightJson = (json: string) =>
    escapeHtml(json).replace(
      /("(?:\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*")\s*(:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g,
      (match, str, colon, keyword) => {
        if (str) return colon ? `<span class="jh-key">${str}</span>${colon}` : `<span class="jh-str">${str}</span>`;
        if (keyword === "true" || keyword === "false") return `<span class="jh-bool">${match}</span>`;
        if (keyword === "null") return `<span class="jh-null">${match}</span>`;
        return `<span class="jh-num">${match}</span>`;
      },
    );

  const parsedOutput = $derived.by(() => {
    if (!output || viewMode === "text") return null;
    try {
      return JSON.parse(output);
    } catch {
      return null;
    }
  });

  const highlightedHtml = $derived(viewMode === "highlight" && output ? highlightJson(output) : "");

  const handleFormat = () => {
    try {
      output = formatJson(input, sortKeys);
      error = null;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "JSON 解析失败";
      error = parseJsonError(input, msg);
      output = "";
    }
  };

  const handleMinify = () => {
    try {
      output = minifyJson(input);
      error = null;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "JSON 解析失败";
      error = parseJsonError(input, msg);
      output = "";
    }
  };

  const handleGetByPath = () => {
    if (!jsonPath.trim()) {
      error = "请输入 JSON 路径";
      return;
    }
    try {
      output = getByPath(input, jsonPath);
      error = null;
    } catch (e) {
      error = e instanceof Error ? e.message : "路径取值失败";
      output = "";
    }
  };

  const handleCopy = async () => {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    copyLabel = "已复制";
    setTimeout(() => {
      copyLabel = "复制结果";
    }, 1500);
  };

  const handleClear = () => {
    input = "";
    output = "";
    error = null;
    jsonPath = "";
  };
</script>

<div class="tool-page-shell overflow-auto p-5">
  <div class="tool-page-header">
    <h2 class="tool-page-title">JSON 工具</h2>
  </div>

  <div class="tool-page-actions">
    <button class="btn btn-primary" onclick={handleFormat}>格式化</button>
    <button class="btn" onclick={handleMinify}>压缩</button>
    <label class="flex items-center gap-2 text-sm">
      <input type="checkbox" bind:checked={sortKeys} />
      键排序
    </label>
    <div class="flex items-center gap-2">
      <input
        class="input h-8 w-52 font-mono text-sm"
        placeholder="路径，如 a.b[0].name"
        bind:value={jsonPath}
        onkeydown={(e) => e.key === "Enter" && handleGetByPath()}
      />
      <button class="btn" onclick={handleGetByPath}>取值</button>
    </div>
    <button class="btn" onclick={handleCopy} disabled={!output}>{copyLabel}</button>
    <button class="btn" onclick={handleClear}>清空</button>

    <div class="ml-auto flex items-center rounded-lg bg-[var(--surface-2)] p-0.5">
      {#each (["text", "highlight", "tree"] as ViewMode[]) as m}
        <button
          onclick={() => (viewMode = m)}
          class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
          style:background={viewMode === m ? "var(--background)" : "transparent"}
          style:color={viewMode === m ? "var(--foreground)" : "var(--muted-foreground)"}
        >
          {{ text: "文本", highlight: "高亮", tree: "树形" }[m]}
        </button>
      {/each}
    </div>
  </div>

  {#if error}
    <div class="w-fit rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</div>
  {/if}

  <div class="tool-dual-grid mt-3 min-h-0">
    <div class="tool-panel">
      <div class="tool-panel-label">输入</div>
      <div class="tool-panel-body">
        <textarea
          bind:value={input}
          placeholder="粘贴 JSON（例如 name/version 字段）"
          class="tool-input-area h-full"
          spellcheck="false"
        ></textarea>
      </div>
    </div>

    <div class="tool-panel">
      <div class="tool-panel-label">输出</div>
      <div class="tool-panel-body overflow-auto">
        {#if viewMode === "text"}
          <textarea
            value={output}
            readonly
            placeholder="处理结果将显示在这里"
            class="tool-input-area h-full"
            spellcheck="false"
          ></textarea>
        {:else if viewMode === "highlight"}
          <pre
            class="h-full overflow-auto whitespace-pre-wrap rounded-lg border border-border/70 bg-background p-3 font-mono text-sm"
          >{@html highlightedHtml || '<span class="text-muted-foreground">处理结果将显示在这里</span>'}</pre>
        {:else}
          <div class="h-full overflow-auto rounded-lg border border-border/70 bg-background p-3">
            {#if parsedOutput !== null}
              <JsonTreeNode value={parsedOutput} depth={0} />
            {:else}
              <span class="font-mono text-sm text-muted-foreground">
                {output ? "无法解析为树形视图" : "处理结果将显示在这里"}
              </span>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

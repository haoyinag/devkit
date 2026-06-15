<script lang="ts">
  import { generateTypeDefinitions, type TsTypeGeneratorResult } from "@/lib/ts-type-generator";

  interface Props {
    initialContent?: string;
  }

  let { initialContent = "" }: Props = $props();

  let input = $state("");
  let typeName = $state("GeneratedType");
  let output = $state("");
  let error = $state("");
  let warnings = $state<string[]>([]);
  let mode = $state<TsTypeGeneratorResult["mode"] | "">("");
  let copyLabel = $state("复制");
  let copyError = $state("");
  let exportError = $state("");

  $effect(() => {
    if (initialContent && !input) input = initialContent;
  });

  const handleGenerate = () => {
    try {
      const result = generateTypeDefinitions(input, typeName);
      output = result.code;
      warnings = result.warnings;
      mode = result.mode;
      error = "";
      copyError = "";
      exportError = "";
    } catch (e) {
      error = e instanceof Error ? e.message : "生成失败";
      output = "";
      warnings = [];
      mode = "";
    }
  };

  const handleCopy = async () => {
    if (!output) return;
    copyError = "";
    try {
      await navigator.clipboard.writeText(output);
      copyLabel = "已复制";
      setTimeout(() => {
        copyLabel = "复制";
      }, 1500);
    } catch {
      copyError = "复制失败：请确认剪贴板权限已开启";
    }
  };

  const handleExport = () => {
    if (!output) return;
    exportError = "";
    try {
      const filename = `${(typeName.trim() || "generated-types").replace(/[^\w-]/g, "_")}.ts`;
      const blob = new Blob([output], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      exportError = "导出失败：请重试或使用复制按钮";
    }
  };

  const handleClear = () => {
    input = "";
    output = "";
    warnings = [];
    error = "";
    mode = "";
    copyError = "";
    exportError = "";
  };

  const handleResetAll = () => {
    handleClear();
    typeName = "GeneratedType";
  };
</script>

<div class="tool-page-shell overflow-auto p-5">
  <div class="tool-page-header">
    <h2 class="tool-page-title">TypeScript 类型生成</h2>
    <p class="mt-1 text-sm text-muted-foreground">
      支持 JSON 示例、OpenAPI/Swagger、Knife4j 参数表、对象字面量；多接口时会自动选择并给出提示。
    </p>
  </div>

  <div class="tool-page-actions">
    <label class="flex items-center gap-2 text-sm text-muted-foreground">
      根类型名
      <input
        class="input h-8 w-48 font-mono text-sm"
        bind:value={typeName}
        placeholder="GeneratedType"
        spellcheck="false"
        onkeydown={(e) => e.key === "Enter" && handleGenerate()}
      />
    </label>
    <button class="btn btn-primary" onclick={handleGenerate}>生成类型</button>
    <button class="btn" onclick={handleExport} disabled={!output}>导出 .ts</button>
    <button class="btn" onclick={handleCopy} disabled={!output}>{copyLabel}</button>
    <button class="btn" onclick={handleClear}>清空输入</button>
    <button class="btn" onclick={handleResetAll}>重置全部</button>
  </div>

  {#if mode}
    <div class="w-fit rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-xs text-muted-foreground">
      解析模式：{mode}
    </div>
  {/if}

  {#if error}
    <div class="w-fit rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</div>
  {/if}

  {#if copyError}
    <div class="w-fit rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">{copyError}</div>
  {/if}

  {#if exportError}
    <div class="w-fit rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">{exportError}</div>
  {/if}

  {#if warnings.length > 0}
    <div class="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
      <div class="font-medium">解析提示</div>
      <ul class="mt-1 list-disc pl-5">
        {#each warnings as warning}
          <li>{warning}</li>
        {/each}
      </ul>
    </div>
  {/if}

  <div class="tool-dual-grid mt-3 min-h-0">
    <div class="tool-panel">
      <div class="tool-panel-label">输入</div>
      <div class="tool-panel-body">
        <textarea
          bind:value={input}
          placeholder="粘贴字段表格、对象片段、JSON 或 OpenAPI/Swagger 文本"
          class="tool-input-area h-full"
          spellcheck="false"
          onkeydown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              handleGenerate();
            }
          }}
        ></textarea>
      </div>
    </div>

    <div class="tool-panel">
      <div class="tool-panel-label">TypeScript 输出</div>
      <div class="tool-panel-body">
        <textarea
          value={output}
          readonly
          placeholder="生成的 TypeScript 类型定义"
          class="tool-input-area h-full font-mono"
          spellcheck="false"
        ></textarea>
      </div>
    </div>
  </div>
</div>

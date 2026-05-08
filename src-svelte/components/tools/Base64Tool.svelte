<script lang="ts">
  interface Props {
    initialContent?: string;
  }
  let { initialContent = "" }: Props = $props();
  let input = $state("");
  let output = $state("");
  let error = $state<string | null>(null);
  let copyLabel = $state("复制");
  $effect(() => {
    if (initialContent && !input) input = initialContent;
  });

  const handleEncode = () => {
    try {
      const encoded = btoa(
        encodeURIComponent(input).replace(/%([0-9A-F]{2})/g, (_, p1) =>
          String.fromCharCode(parseInt(p1, 16)),
        ),
      );
      output = encoded;
      error = null;
    } catch (e) {
      error = e instanceof Error ? e.message : "编码失败";
    }
  };
  const handleDecode = () => {
    try {
      const decoded = decodeURIComponent(
        Array.from(atob(input.trim()), (c) => `%${c.charCodeAt(0).toString(16).padStart(2, "0")}`).join(""),
      );
      output = decoded;
      error = null;
    } catch (e) {
      error = e instanceof Error ? e.message : "解码失败，输入不是合法的 Base64";
    }
  };
  const handleCopy = async () => {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    copyLabel = "已复制";
    setTimeout(() => (copyLabel = "复制"), 1500);
  };
  const handleClear = () => {
    input = "";
    output = "";
    error = null;
  };
</script>

<div class="tool-page-shell overflow-auto p-5">
  <div class="tool-page-header"><h2 class="tool-page-title">Base64 编解码</h2></div>
  <div class="tool-page-actions">
    <button class="btn btn-primary" onclick={handleEncode}>编码</button>
    <button class="btn" onclick={handleDecode}>解码</button>
    <button class="btn" onclick={handleCopy} disabled={!output}>{copyLabel}</button>
    <button class="btn" onclick={handleClear}>清空</button>
  </div>
  {#if error}
    <div class="w-fit rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</div>
  {/if}
  <div class="tool-dual-grid">
    <div class="tool-panel">
      <div class="tool-panel-label">输入</div>
      <div class="tool-panel-body"><textarea bind:value={input} class="tool-input-area" placeholder="输入要编码或解码的文本" spellcheck="false"></textarea></div>
    </div>
    <div class="tool-panel">
      <div class="tool-panel-label">输出</div>
      <div class="tool-panel-body"><textarea value={output} readonly class="tool-input-area" placeholder="结果" spellcheck="false"></textarea></div>
    </div>
  </div>
</div>

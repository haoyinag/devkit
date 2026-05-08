<script lang="ts">
  type Tab = "case" | "dedup" | "encode" | "stats";
  let tab = $state<Tab>("case");
  let copied = $state<string | null>(null);

  const copy = async (key: string, text: string) => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    copied = key;
    setTimeout(() => {
      if (copied === key) copied = null;
    }, 1200);
  };

  const splitWords = (input: string) =>
    input
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
      .split(/[\s_\-]+/)
      .filter(Boolean);

  const toCamelCase = (words: string[]) =>
    words.map((w, i) => (i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())).join("");
  const toSnakeCase = (words: string[]) => words.map((w) => w.toLowerCase()).join("_");
  const toKebabCase = (words: string[]) => words.map((w) => w.toLowerCase()).join("-");
  const toPascalCase = (words: string[]) => words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join("");
  const toConstantCase = (words: string[]) => words.map((w) => w.toUpperCase()).join("_");
  const toTitleCase = (words: string[]) => words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
  const toSentenceCase = (words: string[]) =>
    words
      .map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase()))
      .join(" ");

  const CASE_BUTTONS: { label: string; fn: (words: string[]) => string }[] = [
    { label: "camelCase", fn: toCamelCase },
    { label: "snake_case", fn: toSnakeCase },
    { label: "kebab-case", fn: toKebabCase },
    { label: "PascalCase", fn: toPascalCase },
    { label: "CONSTANT_CASE", fn: toConstantCase },
    { label: "lowercase", fn: (w) => w.join(" ").toLowerCase() },
    { label: "UPPERCASE", fn: (w) => w.join(" ").toUpperCase() },
    { label: "Title Case", fn: toTitleCase },
    { label: "Sentence case", fn: toSentenceCase },
  ];

  const HTML_ENTITY_MAP: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  const HTML_DECODE_MAP: Record<string, string> = Object.fromEntries(
    Object.entries(HTML_ENTITY_MAP).map(([k, v]) => [v, k]),
  );
  const htmlEncode = (str: string) => str.replace(/[&<>"']/g, (ch) => HTML_ENTITY_MAP[ch] ?? ch);
  const htmlDecode = (str: string) => str.replace(/&(?:amp|lt|gt|quot|#39);/g, (ent) => HTML_DECODE_MAP[ent] ?? ent);
  const unicodeEscape = (str: string) =>
    Array.from(str)
      .map((ch) => {
        const code = ch.codePointAt(0)!;
        return code > 127 ? `\\u${code.toString(16).padStart(4, "0")}` : ch;
      })
      .join("");
  const unicodeUnescape = (str: string) =>
    str.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  const jsEscape = (str: string) =>
    str
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/'/g, "\\'")
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r")
      .replace(/\t/g, "\\t")
      .replace(/\0/g, "\\0");
  const jsUnescape = (str: string) =>
    str
      .replace(/\\0/g, "\0")
      .replace(/\\t/g, "\t")
      .replace(/\\r/g, "\r")
      .replace(/\\n/g, "\n")
      .replace(/\\'/g, "'")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\");

  const ENCODE_BUTTONS: { label: string; fn: (s: string) => string }[] = [
    { label: "HTML 实体编码", fn: htmlEncode },
    { label: "HTML 实体解码", fn: htmlDecode },
    { label: "Unicode 转义", fn: unicodeEscape },
    { label: "Unicode 反转义", fn: unicodeUnescape },
    { label: "JS 字符串转义", fn: jsEscape },
    { label: "JS 字符串反转义", fn: jsUnescape },
  ];

  // case
  let caseInput = $state("");
  let caseOutput = $state("");
  const convertCase = (fn: (words: string[]) => string) => {
    const words = splitWords(caseInput);
    caseOutput = words.length ? fn(words) : "";
  };

  // dedup/sort
  let dedupInput = $state("");
  let dedupOutput = $state("");
  const dedupeCharsPreserveOrder = (s: string) => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const ch of s) {
      if (!seen.has(ch)) {
        seen.add(ch);
        out.push(ch);
      }
    }
    return out.join("");
  };
  const dedupInputLines = $derived(dedupInput.split("\n"));
  const dedupOutputLines = $derived(dedupOutput ? dedupOutput.split("\n") : []);
  const applyLines = (fn: (lines: string[]) => string[]) => {
    dedupOutput = fn(dedupInputLines).join("\n");
  };
  const applyWhole = (fn: (text: string) => string) => {
    dedupOutput = fn(dedupInput);
  };
  const lineActions = [
    { label: "行去重", fn: (lines: string[]) => [...new Set(lines)] },
    { label: "排序 A-Z", fn: (lines: string[]) => [...lines].sort((a, b) => a.localeCompare(b)) },
    { label: "排序 Z-A", fn: (lines: string[]) => [...lines].sort((a, b) => b.localeCompare(a)) },
    { label: "数字排序", fn: (lines: string[]) => [...lines].sort((a, b) => parseFloat(a) - parseFloat(b)) },
    { label: "数字倒序", fn: (lines: string[]) => [...lines].sort((a, b) => parseFloat(b) - parseFloat(a)) },
    { label: "去空行", fn: (lines: string[]) => lines.filter((l) => l.trim() !== "") },
    { label: "去首尾空白", fn: (lines: string[]) => lines.map((l) => l.trim()) },
  ];
  const charActions = [
    { label: "字符去重", fn: (text: string) => dedupeCharsPreserveOrder(text) },
    { label: "字符排序 A-Z", fn: (text: string) => [...text].sort((a, b) => a.localeCompare(b)).join("") },
    { label: "字符排序 Z-A", fn: (text: string) => [...text].sort((a, b) => b.localeCompare(a)).join("") },
  ];

  // encode
  let encodeInput = $state("");
  let encodeOutput = $state("");

  // stats
  let statsInput = $state("");
  const stats = $derived.by(() => {
    if (!statsInput) return null;
    const chars = [...statsInput].length;
    const charsNoSpace = [...statsInput.replace(/\s/g, "")].length;
    const words = statsInput.trim() ? statsInput.trim().split(/\s+/).length : 0;
    const lines = statsInput.split("\n").length;
    const bytes = new TextEncoder().encode(statsInput).length;
    const paragraphs = statsInput.trim()
      ? statsInput.split(/\n\s*\n/).filter((p) => p.trim()).length
      : 0;
    return [
      { label: "字符数", value: chars },
      { label: "字符数（不含空格）", value: charsNoSpace },
      { label: "单词数", value: words },
      { label: "行数", value: lines },
      { label: "字节数", value: bytes },
      { label: "段落数", value: paragraphs },
    ];
  });
</script>

<div class="flex h-full flex-col gap-4 overflow-y-auto p-5">
  <h2 class="text-2xl font-bold tracking-tight">文本处理</h2>
  <div class="card p-3">
    <div class="flex flex-wrap gap-2">
      <button class="btn" style:background={tab === "case" ? "color-mix(in oklab, var(--primary) 22%, var(--card))" : undefined} onclick={() => (tab = "case")}>大小写转换</button>
      <button class="btn" style:background={tab === "dedup" ? "color-mix(in oklab, var(--primary) 22%, var(--card))" : undefined} onclick={() => (tab = "dedup")}>去重排序</button>
      <button class="btn" style:background={tab === "encode" ? "color-mix(in oklab, var(--primary) 22%, var(--card))" : undefined} onclick={() => (tab = "encode")}>编码转义</button>
      <button class="btn" style:background={tab === "stats" ? "color-mix(in oklab, var(--primary) 22%, var(--card))" : undefined} onclick={() => (tab = "stats")}>统计</button>
    </div>
  </div>

  {#if tab === "case"}
    <div class="space-y-4">
      <textarea class="input h-36 font-mono text-sm" bind:value={caseInput} placeholder="输入要转换的文本" spellcheck="false"></textarea>
      <div class="flex flex-wrap gap-2">
        {#each CASE_BUTTONS as b}
          <button class="btn h-7 text-xs" onclick={() => convertCase(b.fn)}>{b.label}</button>
        {/each}
      </div>
      <div class="flex items-center gap-2">
        <span class="text-sm text-muted-foreground">结果</span>
        <button class="btn h-7 text-xs" onclick={() => copy("case", caseOutput)} disabled={!caseOutput}>{copied === "case" ? "已复制" : "复制"}</button>
      </div>
      <textarea class="input h-36 font-mono text-sm" readonly value={caseOutput} placeholder="转换结果" spellcheck="false"></textarea>
    </div>
  {/if}

  {#if tab === "dedup"}
    <div class="space-y-4">
      <p class="text-xs text-muted-foreground"><span class="font-medium text-foreground">按行</span>：多行时用换行分隔；<span class="ml-2 font-medium text-foreground">按字符</span>：对整段文字逐字处理。</p>
      <textarea class="input h-40 font-mono text-sm" bind:value={dedupInput} placeholder="多行时每行一条；单行长串可用字符去重" spellcheck="false"></textarea>
      <div class="space-y-2">
        <p class="text-xs font-medium text-muted-foreground">按行</p>
        <div class="flex flex-wrap gap-2">
          {#each lineActions as a}
            <button class="btn h-7 text-xs" onclick={() => applyLines(a.fn)}>{a.label}</button>
          {/each}
        </div>
        <p class="text-xs font-medium text-muted-foreground">按字符（整段）</p>
        <div class="flex flex-wrap gap-2">
          {#each charActions as a}
            <button class="btn h-7 text-xs" onclick={() => applyWhole(a.fn)}>{a.label}</button>
          {/each}
        </div>
      </div>
      {#if dedupOutput}
        <div class="flex items-center gap-3 text-sm text-muted-foreground">
          <span class="rounded bg-muted px-2 py-0.5">输入 {dedupInputLines.length} 行</span><span>→</span><span class="rounded bg-muted px-2 py-0.5">输出 {dedupOutputLines.length} 行</span>
        </div>
      {/if}
      <div class="flex items-center gap-2">
        <span class="text-sm text-muted-foreground">结果</span>
        <button class="btn h-7 text-xs" onclick={() => copy("dedup", dedupOutput)} disabled={!dedupOutput}>{copied === "dedup" ? "已复制" : "复制"}</button>
      </div>
      <textarea class="input h-40 font-mono text-sm" readonly value={dedupOutput} placeholder="处理结果" spellcheck="false"></textarea>
    </div>
  {/if}

  {#if tab === "encode"}
    <div class="space-y-4">
      <textarea class="input h-36 font-mono text-sm" bind:value={encodeInput} placeholder="输入要编码/转义的文本" spellcheck="false"></textarea>
      <div class="flex flex-wrap gap-2">
        {#each ENCODE_BUTTONS as b}
          <button class="btn h-7 text-xs" onclick={() => (encodeOutput = b.fn(encodeInput))}>{b.label}</button>
        {/each}
      </div>
      <div class="flex items-center gap-2">
        <span class="text-sm text-muted-foreground">结果</span>
        <button class="btn h-7 text-xs" onclick={() => copy("encode", encodeOutput)} disabled={!encodeOutput}>{copied === "encode" ? "已复制" : "复制"}</button>
      </div>
      <textarea class="input h-36 font-mono text-sm" readonly value={encodeOutput} placeholder="编码/转义结果" spellcheck="false"></textarea>
    </div>
  {/if}

  {#if tab === "stats"}
    <div class="space-y-4">
      <textarea class="input h-44 font-mono text-sm" bind:value={statsInput} placeholder="输入要统计的文本" spellcheck="false"></textarea>
      {#if stats}
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {#each stats as s}
            <div class="rounded-lg border bg-card p-3 text-center">
              <div class="text-2xl font-bold tabular-nums">{s.value.toLocaleString()}</div>
              <div class="mt-1 text-xs text-muted-foreground">{s.label}</div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>

<script lang="ts">
  const PRESETS = [
    { label: "邮箱", pattern: "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}" },
    { label: "手机号", pattern: "1[3-9]\\d{9}" },
    { label: "URL", pattern: "https?://[^\\s]+" },
    { label: "IPv4", pattern: "\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}" },
    { label: "日期", pattern: "\\d{4}-\\d{2}-\\d{2}" },
    { label: "中文", pattern: "[\\u4e00-\\u9fa5]+" },
  ];
  type MatchInfo = { index: number; text: string; groups: Record<string, string> };

  let pattern = $state("");
  let flagG = $state(true);
  let flagI = $state(false);
  let flagM = $state(false);
  let flagS = $state(false);
  let testStr = $state("");
  let error = $state<string | null>(null);

  const flags = $derived(`${flagG ? "g" : ""}${flagI ? "i" : ""}${flagM ? "m" : ""}${flagS ? "s" : ""}`);
  const computed = $derived.by(() => {
    if (!pattern || !testStr) return { matches: [] as MatchInfo[], highlightedParts: [] as { text: string; matched: boolean }[] };
    try {
      const re = new RegExp(pattern, flags.includes("g") ? flags : `${flags}g`);
      const found: MatchInfo[] = [];
      let m: RegExpExecArray | null;
      while ((m = re.exec(testStr)) !== null) {
        found.push({ index: m.index, text: m[0], groups: m.groups ? { ...m.groups } : {} });
        if (!m[0]) break;
      }
      const parts: { text: string; matched: boolean }[] = [];
      let last = 0;
      for (const match of found) {
        if (match.index > last) parts.push({ text: testStr.slice(last, match.index), matched: false });
        parts.push({ text: match.text, matched: true });
        last = match.index + match.text.length;
      }
      if (last < testStr.length) parts.push({ text: testStr.slice(last), matched: false });
      error = null;
      return { matches: found, highlightedParts: parts };
    } catch (e) {
      error = e instanceof Error ? e.message : "正则表达式无效";
      return { matches: [] as MatchInfo[], highlightedParts: [] as { text: string; matched: boolean }[] };
    }
  });
</script>

<div class="flex h-full flex-col gap-4 overflow-y-auto p-5">
  <h2 class="text-2xl font-bold tracking-tight">正则测试</h2>
  <div class="space-y-3">
    <div class="flex flex-wrap items-end gap-3">
      <div class="flex-1 space-y-1">
        <div class="text-sm">正则表达式</div>
        <div class="flex items-center gap-1"><span class="text-muted-foreground">/</span><input class="input font-mono text-sm" bind:value={pattern} placeholder="输入正则表达式" /><span class="text-muted-foreground">/{flags}</span></div>
      </div>
    </div>
    <div class="flex flex-wrap items-center gap-4">
      <label class="flex items-center gap-1.5 text-xs"><input type="checkbox" bind:checked={flagG} /> global</label>
      <label class="flex items-center gap-1.5 text-xs"><input type="checkbox" bind:checked={flagI} /> ignoreCase</label>
      <label class="flex items-center gap-1.5 text-xs"><input type="checkbox" bind:checked={flagM} /> multiline</label>
      <label class="flex items-center gap-1.5 text-xs"><input type="checkbox" bind:checked={flagS} /> dotAll</label>
    </div>
    <div class="flex flex-wrap gap-1.5">
      {#each PRESETS as p}
        <button class="btn h-7 text-xs" onclick={() => (pattern = p.pattern)}>{p.label}</button>
      {/each}
    </div>
  </div>
  {#if error}
    <div class="w-fit rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</div>
  {/if}
  <div class="rounded-xl bg-card ring-1 ring-foreground/10 p-4">
    <div class="mb-1 text-sm text-muted-foreground">测试文本</div>
    <textarea bind:value={testStr} placeholder="输入要测试的文本" rows="5" class="input h-32 font-mono text-sm" spellcheck="false"></textarea>
  </div>
  {#if computed.highlightedParts.length > 0}
    <section class="card p-3">
      <div class="mb-2 text-sm text-muted-foreground">匹配高亮 ({computed.matches.length} 个匹配)</div>
      <pre class="overflow-auto whitespace-pre-wrap rounded bg-muted p-3 font-mono text-sm">{#each computed.highlightedParts as part}{#if part.matched}<mark class="rounded-sm bg-primary/20 px-0.5 text-primary">{part.text}</mark>{:else}<span>{part.text}</span>{/if}{/each}</pre>
    </section>
  {/if}
  {#if computed.matches.length > 0}
    <section class="card p-3">
      <div class="mb-2 text-sm text-muted-foreground">匹配详情</div>
      <div class="space-y-1">
        {#each computed.matches.slice(0, 50) as m, i}
          <div class="flex items-center gap-3 rounded px-2 py-1 text-sm hover:bg-muted"><span class="w-8 shrink-0 text-right text-xs text-muted-foreground">#{i + 1}</span><code class="font-mono">{m.text}</code><span class="text-xs text-muted-foreground">@{m.index}</span>{#if Object.keys(m.groups).length > 0}<span class="text-xs text-muted-foreground">groups: {JSON.stringify(m.groups)}</span>{/if}</div>
        {/each}
      </div>
    </section>
  {/if}
</div>

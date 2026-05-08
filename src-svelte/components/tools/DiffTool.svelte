<script lang="ts">
  type DiffLine = {
    type: "equal" | "removed" | "added";
    content: string;
    leftLine?: number;
    rightLine?: number;
  };
  type DiffStats = { changes: number; removed: number; added: number };

  const SAMPLE_LEFT = `{
  "name": "DevKit",
  "version": "1.0.0",
  "description": "开发者工具箱",
  "author": "张三",
  "dependencies": {
    "react": "^18.0.0",
    "typescript": "^5.0.0"
  }
}`;
  const SAMPLE_RIGHT = `{
  "name": "DevKit",
  "version": "1.1.0",
  "description": "开发者工具箱 - 增强版",
  "author": "李四",
  "license": "MIT",
  "dependencies": {
    "react": "^19.0.0",
    "typescript": "^5.0.0",
    "tailwindcss": "^4.0.0"
  }
}`;

  let left = $state("");
  let right = $state("");
  let ignoreWhitespace = $state(false);
  let ignoreCase = $state(false);
  let jsonMode = $state(false);
  let diffResult = $state<DiffLine[] | null>(null);
  let error = $state<string | null>(null);
  let copied = $state(false);

  const sortJsonKeys = (obj: unknown): unknown => {
    if (Array.isArray(obj)) return obj.map(sortJsonKeys);
    if (obj !== null && typeof obj === "object") {
      return Object.keys(obj as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((acc, key) => {
          acc[key] = sortJsonKeys((obj as Record<string, unknown>)[key]);
          return acc;
        }, {});
    }
    return obj;
  };
  const prepareLines = (text: string) => {
    let lines = text.split("\n");
    if (ignoreWhitespace) lines = lines.map((l) => l.replace(/\s+/g, " ").trim());
    if (ignoreCase) lines = lines.map((l) => l.toLowerCase());
    return lines;
  };
  const computeDiff = (lArr: string[], rArr: string[]): DiffLine[] => {
    const m = lArr.length;
    const n = rArr.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
    for (let i = 1; i <= m; i += 1) {
      for (let j = 1; j <= n; j += 1) {
        dp[i][j] = lArr[i - 1] === rArr[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
    const out: DiffLine[] = [];
    let i = m;
    let j = n;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && lArr[i - 1] === rArr[j - 1]) {
        out.push({ type: "equal", content: lArr[i - 1], leftLine: i, rightLine: j });
        i -= 1;
        j -= 1;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        out.push({ type: "added", content: rArr[j - 1], rightLine: j });
        j -= 1;
      } else {
        out.push({ type: "removed", content: lArr[i - 1], leftLine: i });
        i -= 1;
      }
    }
    return out.reverse();
  };
  const calcStats = (lines: DiffLine[]): DiffStats => {
    let removed = 0;
    let added = 0;
    let changes = 0;
    let prevType: string | null = null;
    for (const line of lines) {
      if (line.type === "removed") {
        removed += 1;
        if (prevType !== "removed" && prevType !== "added") changes += 1;
      } else if (line.type === "added") {
        added += 1;
        if (prevType !== "removed" && prevType !== "added") changes += 1;
      }
      prevType = line.type;
    }
    return { changes, removed, added };
  };

  const handleCompare = () => {
    error = null;
    let leftText = left;
    let rightText = right;
    if (jsonMode) {
      try {
        leftText = JSON.stringify(sortJsonKeys(JSON.parse(leftText)), null, 2);
      } catch {
        error = "左侧 JSON 解析失败";
        diffResult = null;
        return;
      }
      try {
        rightText = JSON.stringify(sortJsonKeys(JSON.parse(rightText)), null, 2);
      } catch {
        error = "右侧 JSON 解析失败";
        diffResult = null;
        return;
      }
    }
    const leftLines = leftText.split("\n");
    const rightLines = rightText.split("\n");
    const rawDiff = computeDiff(prepareLines(leftText), prepareLines(rightText));
    diffResult = rawDiff.map((d) => {
      if (d.type === "equal" && d.leftLine != null) return { ...d, content: leftLines[d.leftLine - 1] };
      if (d.type === "removed" && d.leftLine != null) return { ...d, content: leftLines[d.leftLine - 1] };
      if (d.type === "added" && d.rightLine != null) return { ...d, content: rightLines[d.rightLine - 1] };
      return d;
    });
  };

  const handleSwap = () => {
    const t = left;
    left = right;
    right = t;
    diffResult = null;
  };
  const handleClear = () => {
    left = "";
    right = "";
    diffResult = null;
    error = null;
  };
  const handleSample = () => {
    left = SAMPLE_LEFT;
    right = SAMPLE_RIGHT;
    diffResult = null;
    error = null;
  };
  const handleCopyDiff = async () => {
    if (!diffResult) return;
    const text = diffResult
      .map((d) => `${d.type === "removed" ? "- " : d.type === "added" ? "+ " : "  "}${d.content}`)
      .join("\n");
    await navigator.clipboard.writeText(text);
    copied = true;
    setTimeout(() => (copied = false), 1500);
  };

  const stats = $derived(diffResult ? calcStats(diffResult) : null);
  const hasDiff = $derived(Boolean(diffResult && diffResult.some((d) => d.type !== "equal")));
</script>

<div class="flex h-full flex-col gap-4 overflow-y-auto p-5">
  <h2 class="text-2xl font-bold tracking-tight">Diff 对比</h2>
  <div class="flex flex-wrap items-center gap-2">
    <button class="btn btn-primary" onclick={handleCompare}>对比</button>
    <button class="btn" onclick={handleSwap}>交换</button>
    <button class="btn" onclick={handleClear}>清空</button>
    <button class="btn" onclick={handleSample}>示例数据</button>
    <div class="mx-2 h-5 w-px bg-border"></div>
    <button class="btn text-xs" style:background={ignoreWhitespace ? "color-mix(in oklab, var(--primary) 25%, var(--card))" : undefined} onclick={() => (ignoreWhitespace = !ignoreWhitespace)}>忽略空白</button>
    <button class="btn text-xs" style:background={ignoreCase ? "color-mix(in oklab, var(--primary) 25%, var(--card))" : undefined} onclick={() => (ignoreCase = !ignoreCase)}>忽略大小写</button>
    <button class="btn text-xs" style:background={jsonMode ? "color-mix(in oklab, var(--primary) 25%, var(--card))" : undefined} onclick={() => (jsonMode = !jsonMode)}>JSON 对比</button>
  </div>

  {#if error}
    <div class="w-fit rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</div>
  {/if}

  <div class="grid min-h-[200px] grid-cols-[1fr_auto_1fr] gap-2">
    <div class="flex flex-col gap-1">
      <div class="text-sm font-medium text-muted-foreground">原始文本</div>
      <textarea bind:value={left} placeholder="粘贴或输入原始文本..." class="input min-h-[180px] flex-1 resize-none font-mono text-sm" spellcheck="false"></textarea>
    </div>
    <div class="flex items-center">
      <button onclick={handleSwap} class="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" title="交换">↔</button>
    </div>
    <div class="flex flex-col gap-1">
      <div class="text-sm font-medium text-muted-foreground">修改文本</div>
      <textarea bind:value={right} placeholder="粘贴或输入修改后文本..." class="input min-h-[180px] flex-1 resize-none font-mono text-sm" spellcheck="false"></textarea>
    </div>
  </div>

  {#if diffResult}
    <div class="flex flex-col gap-2">
      <div class="flex items-center gap-3">
        <span class="text-sm font-medium text-muted-foreground">对比结果</span>
        {#if stats}
          <span class="text-xs text-muted-foreground">
            共 {stats.changes} 处差异，删除 <span class="text-red-500">{stats.removed}</span> 行，新增 <span class="text-green-500">{stats.added}</span> 行
          </span>
        {/if}
        <div class="flex-1"></div>
        {#if hasDiff}
          <button class="btn h-8 text-sm" onclick={handleCopyDiff}>{copied ? "已复制" : "复制差异"}</button>
        {/if}
      </div>

      {#if !hasDiff}
        <div class="rounded-lg border border-dashed border-green-300 bg-green-50 px-4 py-8 text-center text-sm text-green-700 dark:border-green-700 dark:bg-green-900/20 dark:text-green-400">两侧内容完全一致，无差异</div>
      {:else}
        <div class="overflow-hidden rounded-lg border">
          <div class="max-h-[500px] overflow-auto">
            <table class="w-full border-collapse font-mono text-sm">
              <tbody>
                {#each diffResult as line}
                  <tr class={line.type === "removed" ? "bg-red-100 dark:bg-red-900/30" : line.type === "added" ? "bg-green-100 dark:bg-green-900/30" : ""}>
                    <td class="w-12 select-none border-r px-2 py-0.5 text-right text-xs text-muted-foreground">{line.leftLine ?? ""}</td>
                    <td class="w-12 select-none border-r px-2 py-0.5 text-right text-xs text-muted-foreground">{line.rightLine ?? ""}</td>
                    <td class="w-6 select-none px-1 py-0.5 text-center text-xs">{line.type === "removed" ? "−" : line.type === "added" ? "+" : ""}</td>
                    <td class="whitespace-pre-wrap px-2 py-0.5">{line.content || "\u00A0"}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

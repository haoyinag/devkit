<script lang="ts">
  type UnitKey = "px" | "rem" | "em" | "vw" | "vh" | "percent";
  type UnitConfig = { key: UnitKey; label: string; suffix: string; hint?: string };
  const UNITS: UnitConfig[] = [
    { key: "px", label: "px", suffix: "px" },
    { key: "rem", label: "rem", suffix: "rem" },
    { key: "em", label: "em", suffix: "em" },
    { key: "vw", label: "vw", suffix: "vw", hint: "基于视口宽度" },
    { key: "vh", label: "vh", suffix: "vh", hint: "基于视口高度" },
    { key: "percent", label: "%", suffix: "%", hint: "基于父元素" },
  ];
  const REFERENCE_TABLE = [
    { px: 12, rem: 0.75 }, { px: 14, rem: 0.875 }, { px: 16, rem: 1 }, { px: 18, rem: 1.125 },
    { px: 20, rem: 1.25 }, { px: 24, rem: 1.5 }, { px: 28, rem: 1.75 }, { px: 32, rem: 2 },
    { px: 36, rem: 2.25 }, { px: 40, rem: 2.5 }, { px: 48, rem: 3 }, { px: 64, rem: 4 },
  ];
  const round = (v: number, decimals = 4) => Math.round(v * 10 ** decimals) / 10 ** decimals;

  let rootFontSize = $state(16);
  let viewportWidth = $state(1920);
  let viewportHeight = $state(1080);
  let parentSize = $state(100);
  let values = $state<Record<UnitKey, string>>({ px: "", rem: "", em: "", vw: "", vh: "", percent: "" });
  let copiedKey = $state<string | null>(null);

  const toPx = (value: number, unit: UnitKey) => {
    switch (unit) {
      case "px": return value;
      case "rem":
      case "em": return value * rootFontSize;
      case "vw": return (value / 100) * viewportWidth;
      case "vh": return (value / 100) * viewportHeight;
      case "percent": return (value / 100) * parentSize;
    }
  };
  const fromPx = (px: number, unit: UnitKey) => {
    switch (unit) {
      case "px": return px;
      case "rem":
      case "em": return px / rootFontSize;
      case "vw": return (px / viewportWidth) * 100;
      case "vh": return (px / viewportHeight) * 100;
      case "percent": return (px / parentSize) * 100;
    }
  };
  const recalculate = (sourceUnit: UnitKey, raw: string) => {
    const next: Record<UnitKey, string> = { px: "", rem: "", em: "", vw: "", vh: "", percent: "" };
    if (raw === "" || raw === "-" || raw === ".") {
      next[sourceUnit] = raw;
      values = next;
      return;
    }
    const num = parseFloat(raw);
    if (Number.isNaN(num)) {
      next[sourceUnit] = raw;
      values = next;
      return;
    }
    const px = toPx(num, sourceUnit);
    for (const u of UNITS) next[u.key] = u.key === sourceUnit ? raw : String(round(fromPx(px, u.key)));
    values = next;
  };
</script>

<div class="flex h-full flex-col overflow-y-auto p-5">
  <div class="mx-auto w-full max-w-5xl space-y-6">
    <div><h2 class="text-2xl font-bold tracking-tight">CSS 单位转换</h2><p class="mt-1 text-sm text-muted-foreground">px / rem / em / vw / vh / % 互相转换</p></div>
    <section class="card p-4">
      <div class="mb-3 text-sm font-medium">基准设置</div>
      <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <label class="text-xs text-muted-foreground">根字号 (px)<input class="input mt-1 font-mono text-sm" type="number" min="1" bind:value={rootFontSize} /></label>
        <label class="text-xs text-muted-foreground">视口宽度 (px)<input class="input mt-1 font-mono text-sm" type="number" min="1" bind:value={viewportWidth} /></label>
        <label class="text-xs text-muted-foreground">视口高度 (px)<input class="input mt-1 font-mono text-sm" type="number" min="1" bind:value={viewportHeight} /></label>
        <label class="text-xs text-muted-foreground">父元素尺寸 (px)<input class="input mt-1 font-mono text-sm" type="number" min="1" bind:value={parentSize} /></label>
      </div>
    </section>
    <section class="card p-4">
      <div class="mb-3 text-sm font-medium">单位转换</div>
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {#each UNITS as u}
          {@const val = values[u.key]}
          {@const copyText = val && val !== "—" ? `${val}${u.suffix}` : ""}
          {@const copyId = `unit-${u.key}`}
          <div class="flex flex-col gap-1.5 rounded-lg border border-input p-3">
            <div class="flex items-center justify-between"><span class="text-xs font-medium text-muted-foreground">{u.label}</span>{#if u.hint}<span class="text-[10px] text-muted-foreground/60">{u.hint}</span>{/if}</div>
            <div class="flex items-center gap-1.5"><input class="input min-w-0 flex-1 font-mono text-sm" type="text" value={val} oninput={(e) => recalculate(u.key, (e.target as HTMLInputElement).value)} placeholder="0" spellcheck="false" /><button class="btn h-8 w-8 px-0 text-xs" onclick={async () => { if (!copyText) return; await navigator.clipboard.writeText(copyText); copiedKey = copyId; setTimeout(() => (copiedKey = null), 1200); }} disabled={!copyText}>{copiedKey === copyId ? "✓" : "⧉"}</button></div>
          </div>
        {/each}
      </div>
    </section>
    <section class="card p-4">
      <div class="mb-3 text-sm font-medium">常用值速查</div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead><tr class="border-b text-left text-muted-foreground"><th class="px-3 py-2 font-medium">px</th><th class="px-3 py-2 font-medium">rem</th></tr></thead>
          <tbody>
            {#each REFERENCE_TABLE as row}
              <tr class="cursor-pointer border-b border-border/50 transition-colors hover:bg-accent/50" onclick={() => recalculate("px", String(row.px))}><td class="px-3 py-1.5 font-mono">{row.px}</td><td class="px-3 py-1.5 font-mono">{row.rem}</td></tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>
  </div>
</div>

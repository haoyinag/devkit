<script lang="ts">
  import { Check, Copy, Pipette } from "@lucide/svelte";
  import {
    contrastRatio,
    hexToRgb,
    hslToRgb,
    relativeLuminance,
    rgbToHex,
    rgbToHsl,
    wcagLevel,
    wcagLevelLarge,
  } from "@/lib/color-utils";

  const TAILWIND_COLORS: Record<string, Record<string, string>> = {
    slate: { "50": "#f8fafc", "100": "#f1f5f9", "200": "#e2e8f0", "300": "#cbd5e1", "400": "#94a3b8", "500": "#64748b", "600": "#475569", "700": "#334155", "800": "#1e293b", "900": "#0f172a", "950": "#020617" },
    red: { "50": "#fef2f2", "100": "#fee2e2", "200": "#fecaca", "300": "#fca5a5", "400": "#f87171", "500": "#ef4444", "600": "#dc2626", "700": "#b91c1c", "800": "#991b1b", "900": "#7f1d1d", "950": "#450a0a" },
    orange: { "50": "#fff7ed", "100": "#ffedd5", "200": "#fed7aa", "300": "#fdba74", "400": "#fb923c", "500": "#f97316", "600": "#ea580c", "700": "#c2410c", "800": "#9a3412", "900": "#7c2d12", "950": "#431407" },
    amber: { "50": "#fffbeb", "100": "#fef3c7", "200": "#fde68a", "300": "#fcd34d", "400": "#fbbf24", "500": "#f59e0b", "600": "#d97706", "700": "#b45309", "800": "#92400e", "900": "#78350f", "950": "#451a03" },
    yellow: { "50": "#fefce8", "100": "#fef9c3", "200": "#fef08a", "300": "#fde047", "400": "#facc15", "500": "#eab308", "600": "#ca8a04", "700": "#a16207", "800": "#854d0e", "900": "#713f12", "950": "#422006" },
    green: { "50": "#f0fdf4", "100": "#dcfce7", "200": "#bbf7d0", "300": "#86efac", "400": "#4ade80", "500": "#22c55e", "600": "#16a34a", "700": "#15803d", "800": "#166534", "900": "#14532d", "950": "#052e16" },
    blue: { "50": "#eff6ff", "100": "#dbeafe", "200": "#bfdbfe", "300": "#93c5fd", "400": "#60a5fa", "500": "#3b82f6", "600": "#2563eb", "700": "#1d4ed8", "800": "#1e40af", "900": "#1e3a8a", "950": "#172554" },
    purple: { "50": "#faf5ff", "100": "#f3e8ff", "200": "#e9d5ff", "300": "#d8b4fe", "400": "#c084fc", "500": "#a855f7", "600": "#9333ea", "700": "#7e22ce", "800": "#6b21a8", "900": "#581c87", "950": "#3b0764" },
    pink: { "50": "#fdf2f8", "100": "#fce7f3", "200": "#fbcfe8", "300": "#f9a8d4", "400": "#f472b6", "500": "#ec4899", "600": "#db2777", "700": "#be185d", "800": "#9d174d", "900": "#831843", "950": "#500724" },
  };
  const SHADE_KEYS = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"];
  const DEFAULT_COLOR = "#6366F1";

  let hex = $state(DEFAULT_COLOR);
  let fgHex = $state("#000000");
  let bgHex = $state("#FFFFFF");
  let copiedKey = $state<string | null>(null);

  const rgb = $derived(hexToRgb(hex) ?? { r: 0, g: 0, b: 0 });
  const hsl = $derived(rgbToHsl(rgb.r, rgb.g, rgb.b));

  const hexDisplay = $derived(hex);
  const rgbDisplay = $derived(`rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`);
  const hslDisplay = $derived(`hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`);
  const cssRgbDisplay = $derived(`${rgb.r}, ${rgb.g}, ${rgb.b}`);

  const fgRgb = $derived(hexToRgb(fgHex) ?? { r: 0, g: 0, b: 0 });
  const bgRgb = $derived(hexToRgb(bgHex) ?? { r: 255, g: 255, b: 255 });
  const ratio = $derived(contrastRatio(relativeLuminance(fgRgb.r, fgRgb.g, fgRgb.b), relativeLuminance(bgRgb.r, bgRgb.g, bgRgb.b)));
  const normalLevel = $derived(wcagLevel(ratio));
  const largeLevel = $derived(wcagLevelLarge(ratio));
  const textColor = $derived(relativeLuminance(rgb.r, rgb.g, rgb.b) > 0.179 ? "#000000" : "#FFFFFF");
  const hasEyeDropper = $derived(typeof window !== "undefined" && "EyeDropper" in window);

  const copy = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    copiedKey = key;
    setTimeout(() => {
      if (copiedKey === key) copiedKey = null;
    }, 1200);
  };

  const updateFromHex = (value: string) => {
    const cleaned = value.startsWith("#") ? value : `#${value}`;
    hex = cleaned.toUpperCase();
  };

  const updateFromHsl = (h: number, s: number, l: number) => {
    const next = hslToRgb(h, s, l);
    hex = rgbToHex(next.r, next.g, next.b);
  };

  const handleEyeDropper = async () => {
    try {
      const dropper = new (window as unknown as { EyeDropper: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper();
      const result = await dropper.open();
      updateFromHex(result.sRGBHex);
    } catch {
      // ignore
    }
  };
</script>

<div class="flex h-full flex-col gap-4 overflow-y-auto p-5">
  <h2 class="text-2xl font-bold tracking-tight">颜色工具</h2>

  <section class="card">
    <div class="border-b p-4 pb-3 text-sm font-medium text-muted-foreground">颜色选择</div>
    <div class="space-y-4 p-4">
      <div class="flex flex-wrap items-start gap-4">
        <div class="flex h-28 w-28 shrink-0 items-center justify-center rounded-xl border shadow-sm" style:backgroundColor={hex}>
          <span class="font-mono text-xs font-semibold" style:color={textColor}>{hexDisplay}</span>
        </div>
        <div class="flex flex-col gap-3">
          <div class="flex items-center gap-2">
            <div class="w-10 text-sm font-medium text-muted-foreground">HEX</div>
            <input type="text" value={hex} oninput={(e) => updateFromHex((e.target as HTMLInputElement).value)} class="input h-9 w-32 font-mono text-sm" spellcheck="false" />
            <input type="color" value={hexToRgb(hex) ? hex : DEFAULT_COLOR} oninput={(e) => updateFromHex((e.target as HTMLInputElement).value)} class="h-9 w-9 cursor-pointer rounded border p-0.5" />
            {#if hasEyeDropper}
              <button class="btn" onclick={handleEyeDropper}><Pipette size={14} class="mr-1 inline-block" />取色</button>
            {/if}
          </div>
        </div>
      </div>

      <div class="space-y-3 pt-2">
        <div class="flex items-center gap-3">
          <div class="w-20 text-sm text-muted-foreground">色相 (H)</div>
          <input
            type="range"
            min="0"
            max="360"
            value={hsl.h}
            oninput={(e) => updateFromHsl(Number((e.target as HTMLInputElement).value), hsl.s, hsl.l)}
            class="h-2 flex-1 appearance-none rounded-full"
            style:background={`linear-gradient(to right, hsl(0,${hsl.s}%,${hsl.l}%), hsl(60,${hsl.s}%,${hsl.l}%), hsl(120,${hsl.s}%,${hsl.l}%), hsl(180,${hsl.s}%,${hsl.l}%), hsl(240,${hsl.s}%,${hsl.l}%), hsl(300,${hsl.s}%,${hsl.l}%), hsl(360,${hsl.s}%,${hsl.l}%))`}
          />
          <span class="w-12 text-right font-mono text-sm">{hsl.h}°</span>
        </div>
        <div class="flex items-center gap-3">
          <div class="w-20 text-sm text-muted-foreground">饱和度 (S)</div>
          <input
            type="range"
            min="0"
            max="100"
            value={hsl.s}
            oninput={(e) => updateFromHsl(hsl.h, Number((e.target as HTMLInputElement).value), hsl.l)}
            class="h-2 flex-1 appearance-none rounded-full"
            style:background={`linear-gradient(to right, hsl(${hsl.h},0%,${hsl.l}%), hsl(${hsl.h},100%,${hsl.l}%))`}
          />
          <span class="w-12 text-right font-mono text-sm">{hsl.s}%</span>
        </div>
        <div class="flex items-center gap-3">
          <div class="w-20 text-sm text-muted-foreground">亮度 (L)</div>
          <input
            type="range"
            min="0"
            max="100"
            value={hsl.l}
            oninput={(e) => updateFromHsl(hsl.h, hsl.s, Number((e.target as HTMLInputElement).value))}
            class="h-2 flex-1 appearance-none rounded-full"
            style:background={`linear-gradient(to right, hsl(${hsl.h},${hsl.s}%,0%), hsl(${hsl.h},${hsl.s}%,50%), hsl(${hsl.h},${hsl.s}%,100%))`}
          />
          <span class="w-12 text-right font-mono text-sm">{hsl.l}%</span>
        </div>
      </div>
    </div>
  </section>

  <section class="card">
    <div class="border-b p-4 pb-3 text-sm font-medium text-muted-foreground">格式输出</div>
    <div class="space-y-2 p-4">
      {#each [
        { label: "HEX", value: hexDisplay, key: "hex" },
        { label: "RGB", value: rgbDisplay, key: "rgb" },
        { label: "HSL", value: hslDisplay, key: "hsl" },
        { label: "CSS RGB", value: cssRgbDisplay, key: "cssrgb" },
      ] as item}
        <div class="flex items-center gap-2 rounded-lg bg-muted px-3 py-2">
          <span class="w-20 shrink-0 text-xs font-medium text-muted-foreground">{item.label}</span>
          <code class="flex-1 break-all font-mono text-sm">{item.value}</code>
          <button class="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-[var(--accent)]" onclick={() => copy(item.value, item.key)}>
            {#if copiedKey === item.key}
              <Check class="h-3.5 w-3.5 text-green-500" />
            {:else}
              <Copy class="h-3.5 w-3.5" />
            {/if}
          </button>
        </div>
      {/each}
    </div>
  </section>

  <section class="card">
    <div class="border-b p-4 pb-3 text-sm font-medium text-muted-foreground">对比度检查</div>
    <div class="space-y-4 p-4">
      <div class="flex flex-wrap items-center gap-4">
        <div class="flex items-center gap-2">
          <div class="text-sm text-muted-foreground">前景色</div>
          <input type="color" value={fgHex} oninput={(e) => (fgHex = (e.target as HTMLInputElement).value.toUpperCase())} class="h-9 w-9 cursor-pointer rounded border p-0.5" />
          <input type="text" value={fgHex} oninput={(e) => (fgHex = ((e.target as HTMLInputElement).value.startsWith("#") ? (e.target as HTMLInputElement).value : `#${(e.target as HTMLInputElement).value}`).toUpperCase())} class="input h-9 w-28 font-mono text-sm" spellcheck="false" />
        </div>
        <div class="flex items-center gap-2">
          <div class="text-sm text-muted-foreground">背景色</div>
          <input type="color" value={bgHex} oninput={(e) => (bgHex = (e.target as HTMLInputElement).value.toUpperCase())} class="h-9 w-9 cursor-pointer rounded border p-0.5" />
          <input type="text" value={bgHex} oninput={(e) => (bgHex = ((e.target as HTMLInputElement).value.startsWith("#") ? (e.target as HTMLInputElement).value : `#${(e.target as HTMLInputElement).value}`).toUpperCase())} class="input h-9 w-28 font-mono text-sm" spellcheck="false" />
        </div>
        <button class="btn" onclick={() => (fgHex = hex)}>使用当前颜色为前景</button>
      </div>
      <div class="rounded-xl border p-6 text-center" style:backgroundColor={bgHex} style:color={fgHex}>
        <p class="text-2xl font-bold">示例文本 AaBbCc</p>
        <p class="mt-1 text-sm">The quick brown fox jumps over the lazy dog.</p>
      </div>
      <div class="flex flex-wrap gap-3">
        <div class="flex items-center gap-2 rounded-lg bg-muted px-4 py-2">
          <span class="text-sm text-muted-foreground">对比度</span>
          <span class="font-mono text-lg font-bold">{ratio.toFixed(2)}:1</span>
        </div>
        <div class="flex items-center gap-2 rounded-lg bg-muted px-4 py-2">
          <span class="text-sm text-muted-foreground">正常文本</span>
          <span class="rounded-full px-2 py-0.5 text-xs" style:background={normalLevel === "Fail" ? "rgb(220 38 38 / 0.18)" : "rgb(34 197 94 / 0.18)"}>{normalLevel}</span>
        </div>
        <div class="flex items-center gap-2 rounded-lg bg-muted px-4 py-2">
          <span class="text-sm text-muted-foreground">大号文本</span>
          <span class="rounded-full px-2 py-0.5 text-xs" style:background={largeLevel === "Fail" ? "rgb(220 38 38 / 0.18)" : "rgb(34 197 94 / 0.18)"}>{largeLevel}</span>
        </div>
      </div>
    </div>
  </section>

  <section class="card">
    <div class="border-b p-4 pb-3 text-sm font-medium text-muted-foreground">Tailwind 调色板</div>
    <div class="p-4">
      <div class="space-y-2">
        <div class="flex items-center gap-1">
          <div class="w-16"></div>
          {#each SHADE_KEYS as shade}
            <div class="flex-1 text-center text-[10px] text-muted-foreground">{shade}</div>
          {/each}
        </div>
        {#each Object.entries(TAILWIND_COLORS) as [name, shades]}
          <div class="flex items-center gap-1">
            <div class="w-16 text-xs font-medium capitalize text-muted-foreground">{name}</div>
            {#each SHADE_KEYS as shade}
              <button
                onclick={() => updateFromHex(shades[shade])}
                class="aspect-square flex-1 rounded transition-transform hover:scale-110 hover:ring-2 focus:outline-none focus:ring-2"
                style:backgroundColor={shades[shade]}
                title={`${name}-${shade}: ${shades[shade]}`}
              ></button>
            {/each}
          </div>
        {/each}
      </div>
    </div>
  </section>
</div>

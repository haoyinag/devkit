<script lang="ts">
  type BaseKey = "bin" | "oct" | "dec" | "hex";
  type BaseConfig = { key: BaseKey; label: string; prefix: string; radix: number; pattern: RegExp; placeholder: string };
  const BASES: BaseConfig[] = [
    { key: "bin", label: "二进制 (2)", prefix: "0b", radix: 2, pattern: /^[01]*$/, placeholder: "1010" },
    { key: "oct", label: "八进制 (8)", prefix: "0o", radix: 8, pattern: /^[0-7]*$/, placeholder: "12" },
    { key: "dec", label: "十进制 (10)", prefix: "", radix: 10, pattern: /^[0-9]*$/, placeholder: "10" },
    { key: "hex", label: "十六进制 (16)", prefix: "0x", radix: 16, pattern: /^[0-9a-fA-F]*$/, placeholder: "A" },
  ];
  const PERM_LABELS = ["读取", "写入", "执行"] as const;
  const PERM_CHARS = ["r", "w", "x"] as const;
  const PERM_VALUES = [4, 2, 1] as const;
  const GROUP_LABELS = ["所有者", "用户组", "其他人"] as const;
  const PERMISSION_PRESETS = [
    { value: "644", label: "文件默认" }, { value: "755", label: "目录/脚本" }, { value: "777", label: "完全开放" },
    { value: "600", label: "私有文件" }, { value: "444", label: "只读" },
  ];

  const bigIntToBase = (value: bigint, radix: number) => {
    if (value === 0n) return "0";
    let result = "";
    let v = value;
    while (v > 0n) {
      const digit = Number(v % BigInt(radix));
      result = digit.toString(radix) + result;
      v /= BigInt(radix);
    }
    return result;
  };

  let baseValues = $state<Record<BaseKey, string>>({ bin: "", oct: "", dec: "", hex: "" });
  let baseError = $state("");
  let copiedKey = $state<string | null>(null);
  let bitA = $state("");
  let bitB = $state("");
  let permissions = $state<boolean[][]>([[true, true, true], [true, false, true], [true, false, true]]);
  let chmodInput = $state("755");

  const handleCopy = async (text: string, key: string) => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    copiedKey = key;
    setTimeout(() => (copiedKey = null), 1200);
  };
  const convertBase = (source: BaseKey, raw: string) => {
    const next: Record<BaseKey, string> = { bin: "", oct: "", dec: "", hex: "" };
    baseError = "";
    if (raw === "") {
      baseValues = next;
      return;
    }
    const config = BASES.find((b) => b.key === source)!;
    if (!config.pattern.test(raw)) {
      next[source] = raw;
      baseValues = next;
      baseError = `输入包含无效字符（${config.label}）`;
      return;
    }
    try {
      const value = source === "dec" ? BigInt(raw) : BigInt(config.prefix + raw);
      next.bin = bigIntToBase(value, 2);
      next.oct = bigIntToBase(value, 8);
      next.dec = value.toString(10);
      next.hex = bigIntToBase(value, 16).toUpperCase();
      next[source] = raw;
      baseValues = next;
    } catch {
      next[source] = raw;
      baseValues = next;
      baseError = "无法解析输入值";
    }
  };
  const parsedA = $derived.by(() => { try { return bitA.trim() ? BigInt(bitA.trim()) : null; } catch { return null; } });
  const parsedB = $derived.by(() => { try { return bitB.trim() ? BigInt(bitB.trim()) : null; } catch { return null; } });
  const bitResults = $derived.by(() => {
    if (parsedA === null) return null;
    const a = parsedA;
    const b = parsedB ?? 0n;
    const hasB = parsedB !== null;
    return [
      { op: "A AND B", dec: hasB ? (a & b).toString() : "—", bin: hasB ? bigIntToBase(a & b, 2) : "—" },
      { op: "A OR B", dec: hasB ? (a | b).toString() : "—", bin: hasB ? bigIntToBase(a | b, 2) : "—" },
      { op: "A XOR B", dec: hasB ? (a ^ b).toString() : "—", bin: hasB ? bigIntToBase(a ^ b, 2) : "—" },
      { op: "NOT A", dec: (~a).toString(), bin: (~a).toString(2) },
    ];
  });
  const getPermDigit = (group: boolean[]) => group.reduce((sum, on, i) => sum + (on ? PERM_VALUES[i] : 0), 0);
  const numericPerm = $derived(permissions.map(getPermDigit).join(""));
  const symbolicPerm = $derived(permissions.map((g) => g.map((on, i) => (on ? PERM_CHARS[i] : "-")).join("")).join(""));
  const togglePerm = (groupIdx: number, permIdx: number) => {
    const next = permissions.map((g) => [...g]);
    next[groupIdx][permIdx] = !next[groupIdx][permIdx];
    permissions = next;
    chmodInput = next.map((g) => g.reduce((s, on, i) => s + (on ? PERM_VALUES[i] : 0), 0)).join("");
  };
  const handleChmodInput = (raw: string) => {
    chmodInput = raw;
    if (/^[0-7]{3}$/.test(raw)) {
      permissions = raw.split("").map((ch) => {
        const n = parseInt(ch, 10);
        return [Boolean(n & 4), Boolean(n & 2), Boolean(n & 1)];
      });
    }
  };
</script>

<div class="flex h-full flex-col overflow-y-auto p-5">
  <div class="mx-auto w-full max-w-5xl space-y-6">
    <div><h2 class="text-2xl font-bold tracking-tight">进制转换</h2><p class="mt-1 text-sm text-muted-foreground">二 / 八 / 十 / 十六进制互转 · 位运算 · chmod 权限计算</p></div>
    <section class="card p-4">
      <div class="mb-3 flex items-center justify-between"><div class="text-sm font-medium">进制互转</div><button class="btn h-8 text-xs" onclick={() => { baseValues = { bin: "", oct: "", dec: "", hex: "" }; baseError = ""; }}>重置</button></div>
      <div class="grid gap-3 sm:grid-cols-2">
        {#each BASES as b}
          {@const val = baseValues[b.key]}
          {@const copyId = `base-${b.key}`}
          <div class="flex flex-col gap-1.5 rounded-lg border border-input p-3">
            <span class="text-xs font-medium text-muted-foreground">{b.label}</span>
            <div class="flex items-center gap-1.5"><input type="text" value={val} oninput={(e) => convertBase(b.key, (e.target as HTMLInputElement).value)} placeholder={b.placeholder} class="input min-w-0 flex-1 font-mono text-sm" spellcheck="false" /><button class="btn h-8 w-8 px-0 text-xs" onclick={() => handleCopy(val, copyId)} disabled={!val}>{copiedKey === copyId ? "✓" : "⧉"}</button></div>
          </div>
        {/each}
      </div>
      {#if baseError}<div class="mt-3 w-fit rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">{baseError}</div>{/if}
    </section>
    <section class="card p-4">
      <div class="mb-3 text-sm font-medium">位运算</div>
      <div class="mb-4 grid gap-3 sm:grid-cols-2">
        <label class="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">A（十进制）<input type="text" inputmode="numeric" bind:value={bitA} placeholder="255" class="input font-mono text-sm" spellcheck="false" /></label>
        <label class="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">B（十进制）<input type="text" inputmode="numeric" bind:value={bitB} placeholder="15" class="input font-mono text-sm" spellcheck="false" /></label>
      </div>
      {#if bitResults}
        <div class="overflow-x-auto">
          <table class="w-full text-sm"><thead><tr class="border-b text-left text-muted-foreground"><th class="px-3 py-2 font-medium">运算</th><th class="px-3 py-2 font-medium">十进制</th><th class="px-3 py-2 font-medium">二进制</th></tr></thead><tbody>{#each bitResults as r}<tr class="border-b border-border/50"><td class="px-3 py-1.5 font-medium">{r.op}</td><td class="px-3 py-1.5 font-mono">{r.dec}</td><td class="px-3 py-1.5 font-mono">{r.bin}</td></tr>{/each}</tbody></table>
        </div>
      {/if}
    </section>
    <section class="card p-4">
      <div class="mb-3 text-sm font-medium">文件权限计算 (chmod)</div>
      <div class="space-y-4">
        <div class="overflow-x-auto">
          <table class="w-full text-sm"><thead><tr class="border-b text-left text-muted-foreground"><th class="px-3 py-2 font-medium">分组</th>{#each PERM_LABELS as l}<th class="px-3 py-2 text-center font-medium">{l}</th>{/each}<th class="px-3 py-2 text-center font-medium">值</th></tr></thead><tbody>{#each GROUP_LABELS as group, gi}<tr class="border-b border-border/50"><td class="px-3 py-2 font-medium">{group}</td>{#each permissions[gi] as on, pi}<td class="px-3 py-2 text-center"><input type="checkbox" checked={on} onchange={() => togglePerm(gi, pi)} class="h-4 w-4 cursor-pointer rounded accent-primary" /></td>{/each}<td class="px-3 py-2 text-center font-mono">{getPermDigit(permissions[gi])}</td></tr>{/each}</tbody></table>
        </div>
        <div class="grid gap-3 sm:grid-cols-3">
          <div><div class="mb-1 text-xs font-medium text-muted-foreground">数字权限</div><div class="flex gap-1.5"><input type="text" value={chmodInput} oninput={(e) => handleChmodInput((e.target as HTMLInputElement).value)} maxlength="3" class="input min-w-0 flex-1 font-mono text-sm" spellcheck="false" /><button class="btn h-8 w-8 px-0 text-xs" onclick={() => handleCopy(numericPerm, "chmod-num")}>{copiedKey === "chmod-num" ? "✓" : "⧉"}</button></div></div>
          <div><div class="mb-1 text-xs font-medium text-muted-foreground">符号权限</div><div class="flex items-center rounded-md border border-input bg-transparent px-2.5 py-1.5 font-mono text-sm">{symbolicPerm}</div></div>
          <div><div class="mb-1 text-xs font-medium text-muted-foreground">命令</div><div class="flex items-center rounded-md border border-input bg-transparent px-2.5 py-1.5 font-mono text-sm">chmod {numericPerm}</div></div>
        </div>
        <div class="flex flex-wrap gap-2">{#each PERMISSION_PRESETS as p}<button class={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${numericPerm === p.value ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-ring hover:bg-accent"}`} onclick={() => handleChmodInput(p.value)}><span class="font-mono">{p.value}</span><span class="ml-1.5 text-muted-foreground">{p.label}</span></button>{/each}</div>
      </div>
    </section>
  </div>
</div>

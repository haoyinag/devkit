<script lang="ts">
  const DAY_NAMES = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const PRESETS = [
    { label: "每分钟", value: "* * * * *" }, { label: "每5分钟", value: "*/5 * * * *" }, { label: "每小时", value: "0 * * * *" },
    { label: "每天 0:00", value: "0 0 * * *" }, { label: "每天 9:00", value: "0 9 * * *" }, { label: "每周一 9:00", value: "0 9 * * 1" },
    { label: "工作日 9:00", value: "0 9 * * 1-5" }, { label: "每月1日", value: "0 0 1 * *" },
  ];
  const FIELD_REF = [
    { pos: 1, field: "分钟", range: "0-59" }, { pos: 2, field: "小时", range: "0-23" }, { pos: 3, field: "日", range: "1-31" },
    { pos: 4, field: "月", range: "1-12" }, { pos: 5, field: "星期", range: "0-7 (0,7=周日)" },
  ];
  let expression = $state("0 9 * * 1-5");

  const parseField = (field: string, min: number, max: number) => {
    const values = new Set<number>();
    for (const part of field.split(",")) {
      const stepMatch = part.match(/^(.+)\/(\d+)$/);
      let rangePart = part;
      let step = 1;
      if (stepMatch) {
        rangePart = stepMatch[1];
        step = parseInt(stepMatch[2], 10);
        if (step <= 0) return null;
      }
      if (rangePart === "*") for (let i = min; i <= max; i += step) values.add(i);
      else if (rangePart.includes("-")) {
        const [s, e] = rangePart.split("-");
        const start = parseInt(s, 10);
        const end = parseInt(e, 10);
        if (Number.isNaN(start) || Number.isNaN(end) || start < min || end > max || start > end) return null;
        for (let i = start; i <= end; i += step) values.add(i);
      } else {
        const val = parseInt(rangePart, 10);
        if (Number.isNaN(val) || val < min || val > max) return null;
        if (step > 1) for (let i = val; i <= max; i += step) values.add(i);
        else values.add(val);
      }
    }
    return values.size > 0 ? [...values].sort((a, b) => a - b) : null;
  };
  const parseDowField = (field: string) => {
    const result = parseField(field, 0, 7);
    if (!result) return null;
    return [...new Set(result.map((v) => (v === 7 ? 0 : v)))].sort((a, b) => a - b);
  };
  const parseCron = (expr: string) => {
    const parts = expr.trim().split(/\s+/);
    let minute: string, hour: string, dom: string, month: string, dow: string;
    if (parts.length === 5) [minute, hour, dom, month, dow] = parts;
    else if (parts.length === 6) [, minute, hour, dom, month, dow] = parts;
    else return null;
    const minutes = parseField(minute, 0, 59);
    const hours = parseField(hour, 0, 23);
    const doms = parseField(dom, 1, 31);
    const months = parseField(month, 1, 12);
    const dows = parseDowField(dow);
    if (!minutes || !hours || !doms || !months || !dows) return null;
    return { minutes, hours, doms, months, dows };
  };
  const describeCron = (expr: string) => {
    const parts = expr.trim().split(/\s+/);
    if (parts.length < 5 || parts.length > 6) return "无效的 Cron 表达式";
    const [a, b, c, d, e] = parts.length === 5 ? parts : parts.slice(1);
    if (a === "*" && b === "*") return "每分钟";
    if (a.startsWith("*/") && b === "*") return `每${a.slice(2)}分钟`;
    if (b === "*" && !a.startsWith("*/")) return `每小时第 ${a} 分`;
    if (b !== "*" && a !== "*") return `每天 ${String(b).padStart(2, "0")}:${String(a).padStart(2, "0")}`;
    if (e !== "*") return `按星期执行（${e}）`;
    if (c !== "*") return `按日期执行（${c}）`;
    if (d !== "*") return `按月份执行（${d}）`;
    return "已解析";
  };
  const getNextExecutions = (expr: string, count: number) => {
    const parsed = parseCron(expr);
    if (!parsed) return [] as Date[];
    const { minutes, hours, doms, months, dows } = parsed;
    const minuteSet = new Set(minutes), hourSet = new Set(hours), domSet = new Set(doms), monthSet = new Set(months), dowSet = new Set(dows);
    const results: Date[] = [];
    const now = new Date();
    const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes() + 1, 0, 0);
    const limit = new Date(cursor.getTime() + 365 * 24 * 60 * 60 * 1000);
    while (results.length < count && cursor < limit) {
      if (!monthSet.has(cursor.getMonth() + 1)) { cursor.setMonth(cursor.getMonth() + 1, 1); cursor.setHours(0, 0, 0, 0); continue; }
      if (!domSet.has(cursor.getDate())) { cursor.setDate(cursor.getDate() + 1); cursor.setHours(0, 0, 0, 0); continue; }
      if (!dowSet.has(cursor.getDay())) { cursor.setDate(cursor.getDate() + 1); cursor.setHours(0, 0, 0, 0); continue; }
      if (!hourSet.has(cursor.getHours())) { cursor.setHours(cursor.getHours() + 1, 0, 0, 0); continue; }
      if (!minuteSet.has(cursor.getMinutes())) { cursor.setMinutes(cursor.getMinutes() + 1, 0, 0); continue; }
      results.push(new Date(cursor));
      cursor.setMinutes(cursor.getMinutes() + 1, 0, 0);
    }
    return results;
  };
  const formatExecDate = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:00 (${DAY_NAMES[date.getDay()]})`;
  const relativeTime = (date: Date) => {
    const diff = date.getTime() - Date.now();
    if (diff < 0) return "已过";
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}分钟后`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}小时后`;
    return `${Math.floor(hours / 24)}天后`;
  };
  const computed = $derived.by(() => {
    const trimmed = expression.trim();
    if (!trimmed) return { description: "", executions: [] as Date[], error: "" };
    const parts = trimmed.split(/\s+/);
    if (parts.length < 5 || parts.length > 6) return { description: "", executions: [], error: "Cron 表达式应包含 5 或 6 个字段" };
    const parsed = parseCron(trimmed);
    if (!parsed) return { description: "", executions: [], error: "无效的 Cron 表达式，请检查各字段取值" };
    const desc = describeCron(trimmed);
    if (desc.startsWith("无效")) return { description: "", executions: [], error: desc };
    return { description: desc, executions: getNextExecutions(trimmed, 10), error: "" };
  });
</script>

<div class="flex h-full flex-col overflow-y-auto p-5">
  <h2 class="mb-4 text-2xl font-bold tracking-tight">Cron 表达式解析</h2>
  <div class="space-y-4">
    <section class="card p-4">
      <input type="text" bind:value={expression} spellcheck="false" placeholder="输入 Cron 表达式，如 0 9 * * 1-5" class="input w-full font-mono text-lg" />
      {#if computed.error}<div class="mt-3 w-fit rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">{computed.error}</div>{/if}
      {#if computed.description && !computed.error}<div class="mt-3 rounded-md bg-muted px-4 py-2 text-sm font-medium">{computed.description}</div>{/if}
    </section>
    <section class="card p-4">
      <div class="mb-2 text-sm font-medium text-muted-foreground">常用预设</div>
      <div class="flex flex-wrap gap-2">{#each PRESETS as p}<button class={`btn h-8 text-xs ${expression === p.value ? "bg-accent" : ""}`} onclick={() => (expression = p.value)}>{p.label}</button>{/each}</div>
    </section>
    {#if computed.executions.length > 0}
      <section class="card p-4">
        <div class="mb-2 text-sm font-medium text-muted-foreground">接下来 {computed.executions.length} 次执行时间</div>
        <div class="space-y-1">{#each computed.executions as date}<div class="flex items-center justify-between rounded px-3 py-1.5 text-sm odd:bg-muted/50"><span class="font-mono">{formatExecDate(date)}</span><span class="text-muted-foreground">{relativeTime(date)}</span></div>{/each}</div>
      </section>
    {/if}
    <section class="card p-4">
      <div class="mb-2 text-sm font-medium text-muted-foreground">字段参考</div>
      <table class="w-full text-sm"><thead><tr class="border-b text-left text-muted-foreground"><th class="pb-2 pr-4">位置</th><th class="pb-2 pr-4">字段</th><th class="pb-2">取值范围</th></tr></thead><tbody>{#each FIELD_REF as f}<tr class="border-b last:border-0"><td class="py-1.5 pr-4 font-mono">{f.pos}</td><td class="py-1.5 pr-4">{f.field}</td><td class="py-1.5 font-mono text-muted-foreground">{f.range}</td></tr>{/each}</tbody></table>
    </section>
  </div>
</div>

<script lang="ts">
  import { onMount } from "svelte";
  import {
    calculateTimeDiff,
    dateStrToDatetimeLocalValue,
    dateStringToTimestamps,
    datetimeLocalValueToCanonical,
    formatDateTime,
    getTimeRangePreset,
    localDateStr,
    nowLocalMinuteStr,
    timestampToDate,
    type TimeDiff,
  } from "@/lib/time-utils";

  type TimeTab = "range" | "clock" | "convert" | "diff";
  const tabs: { id: TimeTab; label: string }[] = [
    { id: "range", label: "接口时间范围" },
    { id: "clock", label: "当前时间" },
    { id: "convert", label: "时间戳转换" },
    { id: "diff", label: "时间差计算" },
  ];

  const presets = [
    { id: "today", label: "今天" },
    { id: "yesterday", label: "昨天" },
    { id: "thisWeek", label: "本周" },
    { id: "lastWeek", label: "上周" },
    { id: "last7d", label: "近 7 天" },
    { id: "last30d", label: "近 30 天" },
    { id: "thisMonth", label: "本月" },
    { id: "lastMonth", label: "上月" },
    { id: "thisYear", label: "今年" },
  ];

  let activeTab = $state<TimeTab>("range");
  let copied = $state("");
  const MAX_HISTORY = 20;

  // range
  let startStr = $state("");
  let endStr = $state("");
  let rangeError = $state("");
  let rangeResult = $state<{
    startSec: number;
    startMs: number;
    startIso: string;
    endSec: number;
    endMs: number;
    endIso: string;
  } | null>(null);
  let rangeHistory = $state<string[]>([]);

  // clock
  let now = $state(new Date());
  onMount(() => {
    const timer = setInterval(() => (now = new Date()), 1000);
    return () => clearInterval(timer);
  });

  // convert
  let tsInput = $state("");
  let dateInput = $state("");
  let tsResult = $state("");
  let tsType = $state("");
  let dateResult = $state<{ seconds: number; milliseconds: number } | null>(null);
  let convertError = $state("");
  let tsToDateHistory = $state<string[]>([]);
  let dateToTsHistory = $state<string[]>([]);

  // diff
  let diffDate1 = $state("");
  let diffDate2 = $state("");
  let diffError = $state("");
  let diffResult = $state<TimeDiff | null>(null);
  let diffHistory = $state<string[]>([]);

  let rangeStartInput = $state<HTMLInputElement | null>(null);
  let rangeEndInput = $state<HTMLInputElement | null>(null);
  let convertDateInput = $state<HTMLInputElement | null>(null);
  let diffDate1Input = $state<HTMLInputElement | null>(null);
  let diffDate2Input = $state<HTMLInputElement | null>(null);

  const toastCopied = (key: string) => {
    copied = key;
    setTimeout(() => {
      if (copied === key) copied = "";
    }, 1200);
  };
  const copyText = async (key: string, text: string) => {
    await navigator.clipboard.writeText(text);
    toastCopied(key);
  };
  const pushHistory = (list: string[], entry: string) => [entry, ...list].slice(0, MAX_HISTORY);
  const historyTime = () => formatDateTime(new Date(), "Asia/Shanghai");
  const openNativePicker = (input: HTMLInputElement | null) => {
    if (!input) return;
    // `showPicker` 会触发系统原生日期/时间选择器弹窗。
    if (typeof input.showPicker === "function") input.showPicker();
    else {
      input.focus();
      input.click();
    }
  };

  const toLocalDatetimeValue = (canonical: string) => dateStrToDatetimeLocalValue(canonical);
  const fromLocalDatetimeValue = (value: string) => datetimeLocalValueToCanonical(value);

  const handleApplyPreset = (presetId: string) => {
    const { start, end } = getTimeRangePreset(presetId);
    startStr = localDateStr(start);
    endStr = localDateStr(end);
    handleGenerateRange();
  };

  const handleGenerateRange = () => {
    try {
      if (!startStr.trim() || !endStr.trim()) {
        rangeError = "请填写开始和结束时间";
        rangeResult = null;
        return;
      }
      const s = dateStringToTimestamps(startStr);
      const e = dateStringToTimestamps(endStr);
      rangeResult = {
        startSec: s.seconds,
        startMs: s.milliseconds,
        startIso: new Date(startStr).toISOString(),
        endSec: e.seconds,
        endMs: e.milliseconds,
        endIso: new Date(endStr).toISOString(),
      };
      rangeHistory = pushHistory(
        rangeHistory,
        `[${historyTime()}] ${startStr} ~ ${endStr} => 秒(${s.seconds} ~ ${e.seconds}) / 毫秒(${s.milliseconds} ~ ${e.milliseconds})`,
      );
      rangeError = "";
    } catch (error) {
      rangeError = error instanceof Error ? error.message : "时间格式无效";
      rangeResult = null;
    }
  };

  const handleConvertTs = () => {
    try {
      const { date, type } = timestampToDate(tsInput);
      tsResult = formatDateTime(date, "Asia/Shanghai");
      tsType = type === "seconds" ? "秒级 (10位)" : "毫秒级 (13位)";
      tsToDateHistory = pushHistory(tsToDateHistory, `[${historyTime()}] ${tsInput.trim()} => ${tsResult}（${tsType}）`);
      convertError = "";
    } catch (error) {
      convertError = error instanceof Error ? error.message : "转换失败";
      tsResult = "";
      tsType = "";
    }
  };

  const handleConvertDate = () => {
    try {
      dateResult = dateStringToTimestamps(dateInput);
      dateToTsHistory = pushHistory(
        dateToTsHistory,
        `[${historyTime()}] ${dateInput.trim()} => 秒 ${dateResult.seconds} / 毫秒 ${dateResult.milliseconds}`,
      );
      convertError = "";
    } catch (error) {
      convertError = error instanceof Error ? error.message : "转换失败";
      dateResult = null;
    }
  };

  const handleCalcDiff = () => {
    try {
      diffResult = calculateTimeDiff(diffDate1, diffDate2);
      diffHistory = pushHistory(
        diffHistory,
        `[${historyTime()}] ${diffDate1} ~ ${diffDate2} => ${diffResult.days}天 ${diffResult.hours}小时 ${diffResult.minutes}分 ${diffResult.seconds}秒`,
      );
      diffError = "";
    } catch (error) {
      diffError = error instanceof Error ? error.message : "计算失败";
      diffResult = null;
    }
  };

  const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const relativeDesc = $derived.by(() => {
    const h = now.getHours();
    const progress = ((h * 60 + now.getMinutes()) / 1440) * 100;
    const period =
      h < 6 ? "凌晨" : h < 9 ? "早晨" : h < 12 ? "上午" : h < 14 ? "中午" : h < 17 ? "下午" : h < 19 ? "傍晚" : "晚上";
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    const remaining = endOfDay.getTime() - now.getTime();
    const remH = Math.floor(remaining / 3600000);
    const remM = Math.floor((remaining % 3600000) / 60000);
    return `${period} · 今日已过 ${progress.toFixed(1)}% · 剩余 ${remH}h ${remM}m`;
  });
</script>

<div class="flex h-full flex-col gap-4 overflow-auto p-5">
  <div class="card p-4">
    <h2 class="text-2xl font-semibold">时间工具</h2>
    <p class="mt-1 text-sm text-muted-foreground">已对齐 React 版核心功能：范围、当前时间、时间戳转换、时间差计算</p>
  </div>

  <div class="card p-3">
    <div class="flex flex-wrap gap-2">
      {#each tabs as tab}
        <button
          class="btn"
          style:background={activeTab === tab.id ? "color-mix(in oklab, var(--primary) 20%, var(--card))" : undefined}
          onclick={() => (activeTab = tab.id)}
        >
          {tab.label}
        </button>
      {/each}
    </div>
  </div>

  {#if activeTab === "range"}
    <section class="space-y-4">
      <div class="card p-4">
        <div class="mb-2 text-sm font-semibold">快捷时间范围</div>
        <div class="flex flex-wrap gap-2">
          {#each presets as p}
            <button class="btn" onclick={() => handleApplyPreset(p.id)}>{p.label}</button>
          {/each}
        </div>
      </div>

      <div class="card p-4">
        <div class="mb-3 text-sm font-semibold">自定义时间范围</div>
        <div class="grid gap-3 md:grid-cols-2">
          <div class="space-y-2">
            <div class="text-sm text-muted-foreground">开始时间</div>
            <div class="flex gap-2">
              <input
                class="input font-mono"
                type="datetime-local"
                step="60"
                bind:this={rangeStartInput}
                value={toLocalDatetimeValue(startStr)}
                onchange={(e) => (startStr = fromLocalDatetimeValue((e.target as HTMLInputElement).value))}
              />
              <button class="btn" onclick={() => openNativePicker(rangeStartInput)}>选择</button>
              <button class="btn" onclick={() => (startStr = nowLocalMinuteStr())}>当前</button>
            </div>
          </div>
          <div class="space-y-2">
            <div class="text-sm text-muted-foreground">结束时间</div>
            <div class="flex gap-2">
              <input
                class="input font-mono"
                type="datetime-local"
                step="60"
                bind:this={rangeEndInput}
                value={toLocalDatetimeValue(endStr)}
                onchange={(e) => (endStr = fromLocalDatetimeValue((e.target as HTMLInputElement).value))}
              />
              <button class="btn" onclick={() => openNativePicker(rangeEndInput)}>选择</button>
              <button class="btn" onclick={() => (endStr = nowLocalMinuteStr())}>当前</button>
            </div>
          </div>
        </div>
        <div class="mt-3">
          <button class="btn btn-primary" onclick={handleGenerateRange}>生成时间戳</button>
        </div>
        {#if rangeError}
          <div class="mt-3 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">{rangeError}</div>
        {/if}
      </div>

      {#if rangeResult}
        <div class="card p-4">
          <div class="mb-2 flex flex-wrap items-center gap-2">
            <div class="text-sm font-semibold">转换结果</div>
            <button
              class="btn"
              onclick={() =>
                copyText(
                  "range-json-sec",
                  JSON.stringify({ startTime: rangeResult.startSec, endTime: rangeResult.endSec }, null, 2),
                )}
            >
              {copied === "range-json-sec" ? "已复制" : "复制 JSON (秒)"}
            </button>
            <button
              class="btn"
              onclick={() =>
                copyText(
                  "range-json-ms",
                  JSON.stringify({ startTime: rangeResult.startMs, endTime: rangeResult.endMs }, null, 2),
                )}
            >
              {copied === "range-json-ms" ? "已复制" : "复制 JSON (毫秒)"}
            </button>
          </div>
          <div class="grid gap-3 md:grid-cols-2">
            <div class="rounded-lg bg-muted p-3">
              <div class="mb-1 text-sm font-medium">开始时间</div>
              <div class="text-xs text-muted-foreground">秒级: {rangeResult.startSec}</div>
              <div class="text-xs text-muted-foreground">毫秒级: {rangeResult.startMs}</div>
              <div class="text-xs text-muted-foreground">ISO: {rangeResult.startIso}</div>
            </div>
            <div class="rounded-lg bg-muted p-3">
              <div class="mb-1 text-sm font-medium">结束时间</div>
              <div class="text-xs text-muted-foreground">秒级: {rangeResult.endSec}</div>
              <div class="text-xs text-muted-foreground">毫秒级: {rangeResult.endMs}</div>
              <div class="text-xs text-muted-foreground">ISO: {rangeResult.endIso}</div>
            </div>
          </div>
        </div>
      {/if}
      <div class="card p-4">
        <div class="mb-2 text-sm font-semibold">转换历史（最多 20 条）</div>
        {#if rangeHistory.length === 0}
          <div class="text-sm text-muted-foreground">暂无历史记录</div>
        {:else}
          <div class="space-y-2">
            {#each rangeHistory as item}
              <div class="rounded-md bg-muted px-3 py-2 font-mono text-xs">{item}</div>
            {/each}
          </div>
        {/if}
      </div>
    </section>
  {/if}

  {#if activeTab === "clock"}
    <section class="space-y-4">
      <div class="rounded-md bg-muted px-4 py-2 text-sm text-muted-foreground">{relativeDesc}</div>
      <div class="grid gap-3 md:grid-cols-3">
        {#each [
          { label: "本地时间", zone: localZone },
          { label: "UTC 时间", zone: "UTC" },
          { label: "北京时间", zone: "Asia/Shanghai" },
        ] as tz}
          <div class="card p-4">
            <div class="text-sm text-muted-foreground">{tz.label}</div>
            <div class="mt-1 font-mono text-2xl font-semibold">{formatDateTime(now, tz.zone)}</div>
            <div class="mt-1 text-xs text-muted-foreground">{tz.zone}</div>
          </div>
        {/each}
      </div>
      <div class="card p-4">
        <div class="mb-2 text-sm text-muted-foreground">当前时间戳</div>
        <div class="flex flex-wrap gap-8">
          <div>
            <div class="text-xs text-muted-foreground">秒级</div>
            <div class="font-mono text-lg font-semibold">{Math.floor(now.getTime() / 1000)}</div>
          </div>
          <div>
            <div class="text-xs text-muted-foreground">毫秒级</div>
            <div class="font-mono text-lg font-semibold">{now.getTime()}</div>
          </div>
        </div>
      </div>
    </section>
  {/if}

  {#if activeTab === "convert"}
    <section class="grid gap-4 md:grid-cols-2">
      <div class="card p-4">
        <div class="mb-2 text-sm font-semibold">时间戳 → 日期时间</div>
        <div class="space-y-3">
          <div class="flex gap-2">
            <input class="input font-mono" bind:value={tsInput} placeholder="如 1711900800 或 1711900800000" />
            <button class="btn" onclick={() => (tsInput = String(Math.floor(Date.now() / 1000)))}>当前</button>
          </div>
          <button class="btn btn-primary" onclick={handleConvertTs}>转换</button>
          {#if tsResult}
            <div class="rounded-md bg-muted p-3">
              <div class="flex items-center justify-between gap-2">
                <span class="text-sm text-muted-foreground">日期时间</span>
                <div class="flex items-center gap-2">
                  <code class="font-mono text-sm">{tsResult}</code>
                  <button class="btn" onclick={() => copyText("ts-result", tsResult)}>{copied === "ts-result" ? "已复制" : "复制"}</button>
                </div>
              </div>
              {#if tsType}
                <div class="mt-2 text-xs text-muted-foreground">{tsType}</div>
              {/if}
            </div>
          {/if}
        </div>
      </div>
      <div class="card p-4">
        <div class="mb-2 text-sm font-semibold">时间戳 → 日期时间历史（最多 20 条）</div>
        {#if tsToDateHistory.length === 0}
          <div class="text-sm text-muted-foreground">暂无历史记录</div>
        {:else}
          <div class="space-y-2">
            {#each tsToDateHistory as item}
              <div class="rounded-md bg-muted px-3 py-2 font-mono text-xs">{item}</div>
            {/each}
          </div>
        {/if}
      </div>

      <div class="card p-4">
        <div class="mb-2 text-sm font-semibold">日期时间 → 时间戳</div>
        <div class="space-y-3">
          <div class="flex gap-2">
            <input
              class="input font-mono"
              type="datetime-local"
              step="60"
              bind:this={convertDateInput}
              value={toLocalDatetimeValue(dateInput)}
              onchange={(e) => (dateInput = fromLocalDatetimeValue((e.target as HTMLInputElement).value))}
            />
            <button class="btn" onclick={() => openNativePicker(convertDateInput)}>选择</button>
            <button class="btn" onclick={() => (dateInput = nowLocalMinuteStr())}>当前</button>
          </div>
          <button class="btn btn-primary" onclick={handleConvertDate}>转换</button>
          {#if dateResult}
            <div class="space-y-2 rounded-md bg-muted p-3">
              <div class="flex items-center justify-between gap-2">
                <span class="text-sm text-muted-foreground">秒级</span>
                <div class="flex items-center gap-2">
                  <code class="font-mono text-sm">{dateResult.seconds}</code>
                  <button class="btn" onclick={() => copyText("date-sec", String(dateResult?.seconds ?? ""))}>
                    {copied === "date-sec" ? "已复制" : "复制"}
                  </button>
                </div>
              </div>
              <div class="flex items-center justify-between gap-2">
                <span class="text-sm text-muted-foreground">毫秒级</span>
                <div class="flex items-center gap-2">
                  <code class="font-mono text-sm">{dateResult.milliseconds}</code>
                  <button class="btn" onclick={() => copyText("date-ms", String(dateResult?.milliseconds ?? ""))}>
                    {copied === "date-ms" ? "已复制" : "复制"}
                  </button>
                </div>
              </div>
            </div>
          {/if}
        </div>
      </div>
      <div class="card p-4">
        <div class="mb-2 text-sm font-semibold">日期时间 → 时间戳历史（最多 20 条）</div>
        {#if dateToTsHistory.length === 0}
          <div class="text-sm text-muted-foreground">暂无历史记录</div>
        {:else}
          <div class="space-y-2">
            {#each dateToTsHistory as item}
              <div class="rounded-md bg-muted px-3 py-2 font-mono text-xs">{item}</div>
            {/each}
          </div>
        {/if}
      </div>

      {#if convertError}
        <div class="md:col-span-2 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">{convertError}</div>
      {/if}
    </section>
  {/if}

  {#if activeTab === "diff"}
    <section class="card p-4">
      <div class="mb-2 text-sm font-semibold">时间差计算</div>
      <div class="grid gap-3 md:grid-cols-2">
        <div class="space-y-2">
          <div class="text-sm text-muted-foreground">开始时间</div>
          <div class="flex gap-2">
            <input
              class="input font-mono"
              type="datetime-local"
              step="60"
              bind:this={diffDate1Input}
              value={toLocalDatetimeValue(diffDate1)}
              onchange={(e) => (diffDate1 = fromLocalDatetimeValue((e.target as HTMLInputElement).value))}
            />
            <button class="btn" onclick={() => openNativePicker(diffDate1Input)}>选择</button>
            <button class="btn" onclick={() => (diffDate1 = nowLocalMinuteStr())}>当前</button>
          </div>
        </div>
        <div class="space-y-2">
          <div class="text-sm text-muted-foreground">结束时间</div>
          <div class="flex gap-2">
            <input
              class="input font-mono"
              type="datetime-local"
              step="60"
              bind:this={diffDate2Input}
              value={toLocalDatetimeValue(diffDate2)}
              onchange={(e) => (diffDate2 = fromLocalDatetimeValue((e.target as HTMLInputElement).value))}
            />
            <button class="btn" onclick={() => openNativePicker(diffDate2Input)}>选择</button>
            <button class="btn" onclick={() => (diffDate2 = nowLocalMinuteStr())}>当前</button>
          </div>
        </div>
      </div>
      <div class="mt-3">
        <button class="btn btn-primary" onclick={handleCalcDiff}>计算差值</button>
      </div>
      {#if diffError}
        <div class="mt-3 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">{diffError}</div>
      {/if}
      {#if diffResult}
        <div class="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
          {#each [
            { label: "天", value: diffResult.days },
            { label: "小时", value: diffResult.hours },
            { label: "分钟", value: diffResult.minutes },
            { label: "秒", value: diffResult.seconds },
          ] as item}
            <div class="rounded-md bg-muted p-3 text-center">
              <div class="font-mono text-2xl font-bold">{item.value}</div>
              <div class="text-xs text-muted-foreground">{item.label}</div>
            </div>
          {/each}
        </div>
      {/if}
      <div class="mt-4 border-t pt-4">
        <div class="mb-2 text-sm font-semibold">时间差历史（最多 20 条）</div>
        {#if diffHistory.length === 0}
          <div class="text-sm text-muted-foreground">暂无历史记录</div>
        {:else}
          <div class="space-y-2">
            {#each diffHistory as item}
              <div class="rounded-md bg-muted px-3 py-2 font-mono text-xs">{item}</div>
            {/each}
          </div>
        {/if}
      </div>
    </section>
  {/if}
</div>

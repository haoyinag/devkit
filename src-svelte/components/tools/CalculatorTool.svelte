<script lang="ts">
  import { onMount } from "svelte";
  import { ensureAudioReady, playShortBeep } from "@/lib/beep";
  import {
    COUNTDOWN_PRESETS,
    clampCountdownMs,
    formatElapsed,
    parseDurationInput,
  } from "@/lib/stopwatch-utils";

  type Tab = "calculator" | "counter" | "timing";
  type TimingMode = "stopwatch" | "countdown";

  const CALCULATOR_KEYS = [
    "AC",
    "DEL",
    "/",
    "*",
    "7",
    "8",
    "9",
    "-",
    "4",
    "5",
    "6",
    "+",
    "1",
    "2",
    "3",
    "=",
    "0",
    ".",
  ] as const;

  let tab = $state<Tab>("calculator");
  let display = $state("0");
  let calcError = $state("");
  let justEvaluated = $state(false);
  let count = $state(0);

  // timing
  let timingMode = $state<TimingMode>("stopwatch");
  let stopwatchElapsedMs = $state(0);
  let stopwatchRunning = $state(false);
  let stopwatchAnchor = 0;

  let countdownHours = $state(0);
  let countdownMinutes = $state(1);
  let countdownSeconds = $state(0);
  let countdownTotalMs = $state(60_000);
  let countdownRemainingMs = $state(60_000);
  let countdownRunning = $state(false);
  let countdownFinished = $state(false);
  let countdownEndAt = 0;
  let countdownError = $state("");

  let tickHandle: ReturnType<typeof setInterval> | null = null;

  const operators = new Set(["+", "-", "*", "/"]);
  const tabActiveBg = "color-mix(in oklab, var(--primary) 22%, var(--card))";

  const isOperator = (s: string) => operators.has(s);
  const clearError = () => {
    if (calcError) calcError = "";
  };

  const stopTick = () => {
    if (tickHandle) {
      clearInterval(tickHandle);
      tickHandle = null;
    }
  };

  const startTick = () => {
    stopTick();
    tickHandle = setInterval(() => {
      if (tab !== "timing") return;
      if (timingMode === "stopwatch" && stopwatchRunning) {
        stopwatchElapsedMs = performance.now() - stopwatchAnchor;
      }
      if (timingMode === "countdown" && countdownRunning) {
        countdownRemainingMs = clampCountdownMs(countdownEndAt - performance.now());
        if (countdownRemainingMs <= 0) handleCountdownFinish();
      }
    }, 50);
  };

  const pauseStopwatch = () => {
    if (!stopwatchRunning) return;
    stopwatchElapsedMs = performance.now() - stopwatchAnchor;
    stopwatchRunning = false;
    if (!countdownRunning) stopTick();
  };

  const pauseCountdown = () => {
    if (!countdownRunning) return;
    countdownRemainingMs = clampCountdownMs(countdownEndAt - performance.now());
    countdownRunning = false;
    if (!stopwatchRunning) stopTick();
  };

  const pauseAllTiming = () => {
    pauseStopwatch();
    pauseCountdown();
  };

  const handleCountdownFinish = () => {
    countdownRemainingMs = 0;
    countdownRunning = false;
    countdownFinished = true;
    stopTick();
    playShortBeep();
  };

  const syncCountdownFromInputs = () => {
    try {
      const total = parseDurationInput(countdownHours, countdownMinutes, countdownSeconds);
      countdownTotalMs = total;
      if (!countdownRunning) countdownRemainingMs = total;
      countdownFinished = false;
      countdownError = "";
      return true;
    } catch (error) {
      countdownError = error instanceof Error ? error.message : "倒计时设置无效";
      return false;
    }
  };

  const applyCountdownPreset = (ms: number) => {
    pauseCountdown();
    countdownHours = Math.floor(ms / 3600000);
    countdownMinutes = Math.floor((ms % 3600000) / 60000);
    countdownSeconds = Math.floor((ms % 60000) / 1000);
    countdownTotalMs = ms;
    countdownRemainingMs = ms;
    countdownFinished = false;
    countdownError = "";
  };

  const startStopwatch = () => {
    ensureAudioReady();
    stopwatchAnchor = performance.now() - stopwatchElapsedMs;
    stopwatchRunning = true;
    startTick();
  };

  const resetStopwatch = () => {
    stopwatchRunning = false;
    stopwatchElapsedMs = 0;
    if (!countdownRunning) stopTick();
  };

  const startCountdown = () => {
    if (countdownFinished || countdownRemainingMs <= 0) {
      if (!syncCountdownFromInputs()) return;
    }
    ensureAudioReady();
    countdownEndAt = performance.now() + countdownRemainingMs;
    countdownRunning = true;
    countdownFinished = false;
    startTick();
  };

  const resetCountdown = () => {
    countdownRunning = false;
    countdownFinished = false;
    if (syncCountdownFromInputs()) countdownRemainingMs = countdownTotalMs;
    if (!stopwatchRunning) stopTick();
  };

  const handleTimingModeChange = (mode: TimingMode) => {
    pauseAllTiming();
    timingMode = mode;
  };

  $effect(() => {
    if (tab !== "timing") pauseAllTiming();
  });

  onMount(() => () => stopTick());

  const isExpressionValid = (expr: string): boolean => {
    const input = expr.trim();
    if (!input) return false;
    if (!/^[0-9+\-*/.]+$/.test(input)) return false;

    let dotInCurrentNumber = false;
    let hasDigit = false;
    for (let i = 0; i < input.length; i++) {
      const ch = input[i];
      if (ch >= "0" && ch <= "9") {
        hasDigit = true;
        continue;
      }
      if (ch === ".") {
        if (dotInCurrentNumber) return false;
        dotInCurrentNumber = true;
        continue;
      }
      if (isOperator(ch)) {
        const prev = input[i - 1];
        const next = input[i + 1];
        if (i === 0 || i === input.length - 1) return false;
        if (isOperator(prev) || prev === ".") return false;
        if (isOperator(next) || next === ".") return false;
        dotInCurrentNumber = false;
      }
    }

    return hasDigit;
  };

  const evaluateExpression = () => {
    clearError();
    const expr = display.trim();
    if (!isExpressionValid(expr)) {
      calcError = "表达式无效";
      return;
    }

    try {
      const result = Function(`"use strict"; return (${expr});`)();
      if (typeof result !== "number" || !Number.isFinite(result)) {
        calcError = "结果无效";
        return;
      }
      display = String(result);
      justEvaluated = true;
    } catch {
      calcError = "表达式无效";
    }
  };

  const appendDigit = (digit: string) => {
    clearError();
    if (justEvaluated) {
      display = digit;
      justEvaluated = false;
      return;
    }
    if (display === "0") display = digit;
    else display += digit;
  };

  const appendDot = () => {
    clearError();
    if (justEvaluated) {
      display = "0.";
      justEvaluated = false;
      return;
    }
    const parts = display.split(/[-+*/]/);
    const current = parts[parts.length - 1] ?? "";
    if (!current.includes(".")) display += ".";
  };

  const appendOperator = (operator: string) => {
    clearError();
    if (justEvaluated) justEvaluated = false;
    const last = display[display.length - 1];
    if (isOperator(last)) {
      display = display.slice(0, -1) + operator;
      return;
    }
    display += operator;
  };

  const handleBackspace = () => {
    clearError();
    if (justEvaluated) justEvaluated = false;
    if (display.length <= 1) {
      display = "0";
      return;
    }
    display = display.slice(0, -1);
  };

  const handleClear = () => {
    display = "0";
    calcError = "";
    justEvaluated = false;
  };

  const handleCalculatorKey = (key: (typeof CALCULATOR_KEYS)[number]) => {
    if (key === "AC") {
      handleClear();
      return;
    }
    if (key === "DEL") {
      handleBackspace();
      return;
    }
    if (key === "=") {
      evaluateExpression();
      return;
    }
    if (key === ".") {
      appendDot();
      return;
    }
    if (isOperator(key)) {
      appendOperator(key);
      return;
    }
    appendDigit(key);
  };
</script>

<div class="flex h-full flex-col gap-4 overflow-y-auto p-5">
  <div class="card p-4">
    <h2 class="text-2xl font-semibold">计算器 / 计数器 / 计时</h2>
    <p class="mt-1 text-sm text-muted-foreground">四则运算、基础计数、正计时与倒计时</p>
  </div>

  <div class="card p-3">
    <div class="flex flex-wrap gap-2">
      <button class="btn" style:background={tab === "calculator" ? tabActiveBg : undefined} onclick={() => (tab = "calculator")}>
        计算器
      </button>
      <button class="btn" style:background={tab === "counter" ? tabActiveBg : undefined} onclick={() => (tab = "counter")}>
        计数器
      </button>
      <button class="btn" style:background={tab === "timing" ? tabActiveBg : undefined} onclick={() => (tab = "timing")}>
        计时
      </button>
    </div>
  </div>

  {#if tab === "calculator"}
    <section class="card p-4">
      <div class="mb-3 rounded-lg border border-input bg-muted/40 px-3 py-2">
        <div class="mb-1 text-xs text-muted-foreground">表达式</div>
        <div class="font-mono text-2xl font-semibold">{display}</div>
      </div>

      {#if calcError}
        <div class="mb-3 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {calcError}
        </div>
      {/if}

      <div class="grid grid-cols-4 gap-2 sm:max-w-md">
        {#each CALCULATOR_KEYS as key}
          <button class={`btn h-11 ${key === "=" ? "col-span-2 btn-primary" : ""}`} onclick={() => handleCalculatorKey(key)}>
            {key === "DEL" ? "⌫" : key}
          </button>
        {/each}
      </div>
    </section>
  {/if}

  {#if tab === "counter"}
    <section class="card p-4">
      <div class="mb-3 text-sm text-muted-foreground">当前计数值</div>
      <div class="mb-4 font-mono text-5xl font-bold tabular-nums">{count}</div>
      <div class="flex flex-wrap gap-2">
        <button class="btn" onclick={() => (count -= 1)}>-1</button>
        <button class="btn btn-primary" onclick={() => (count += 1)}>+1</button>
        <button class="btn" onclick={() => (count = 0)}>重置</button>
      </div>
    </section>
  {/if}

  {#if tab === "timing"}
    <section class="card p-4 space-y-4">
      <div class="flex flex-wrap gap-2">
        <button
          class="btn"
          style:background={timingMode === "stopwatch" ? tabActiveBg : undefined}
          onclick={() => handleTimingModeChange("stopwatch")}
        >
          计时器
        </button>
        <button
          class="btn"
          style:background={timingMode === "countdown" ? tabActiveBg : undefined}
          onclick={() => handleTimingModeChange("countdown")}
        >
          倒计时
        </button>
      </div>

      {#if timingMode === "stopwatch"}
        <div>
          <div class="mb-3 text-sm text-muted-foreground">已计时</div>
          <div class="mb-4 font-mono text-5xl font-bold tabular-nums">{formatElapsed(stopwatchElapsedMs)}</div>
          <div class="flex flex-wrap gap-2">
            {#if stopwatchRunning}
              <button class="btn" onclick={pauseStopwatch}>暂停</button>
            {:else}
              <button class="btn btn-primary" onclick={startStopwatch}>开始</button>
            {/if}
            <button class="btn" onclick={resetStopwatch}>重置</button>
          </div>
        </div>
      {/if}

      {#if timingMode === "countdown"}
        <div class="space-y-4">
          <div>
            <div class="mb-3 text-sm text-muted-foreground">剩余时间</div>
            <div class="mb-4 font-mono text-5xl font-bold tabular-nums">{formatElapsed(countdownRemainingMs)}</div>
          </div>

          {#if countdownFinished}
            <div class="rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-primary">
              倒计时结束
            </div>
          {/if}

          <div class="grid grid-cols-3 gap-2 sm:max-w-md">
            <label class="space-y-1 text-xs text-muted-foreground">
              时
              <input
                class="input font-mono"
                type="number"
                min="0"
                max="23"
                bind:value={countdownHours}
                disabled={countdownRunning}
                onchange={syncCountdownFromInputs}
              />
            </label>
            <label class="space-y-1 text-xs text-muted-foreground">
              分
              <input
                class="input font-mono"
                type="number"
                min="0"
                max="59"
                bind:value={countdownMinutes}
                disabled={countdownRunning}
                onchange={syncCountdownFromInputs}
              />
            </label>
            <label class="space-y-1 text-xs text-muted-foreground">
              秒
              <input
                class="input font-mono"
                type="number"
                min="0"
                max="59"
                bind:value={countdownSeconds}
                disabled={countdownRunning}
                onchange={syncCountdownFromInputs}
              />
            </label>
          </div>

          <div>
            <div class="mb-2 text-xs text-muted-foreground">快捷预设</div>
            <div class="flex flex-wrap gap-2">
              {#each COUNTDOWN_PRESETS as preset}
                <button class="btn h-8 text-xs" disabled={countdownRunning} onclick={() => applyCountdownPreset(preset.ms)}>
                  {preset.label}
                </button>
              {/each}
            </div>
          </div>

          {#if countdownError}
            <div class="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
              {countdownError}
            </div>
          {/if}

          <div class="flex flex-wrap gap-2">
            {#if countdownRunning}
              <button class="btn" onclick={pauseCountdown}>暂停</button>
            {:else}
              <button class="btn btn-primary" onclick={startCountdown}>开始</button>
            {/if}
            <button class="btn" onclick={resetCountdown}>重置</button>
          </div>
        </div>
      {/if}
    </section>
  {/if}
</div>

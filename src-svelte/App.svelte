<script lang="ts">
  import { onDestroy } from "svelte";
  import type { Page } from "@/types";
  import Dashboard from "@app/components/Dashboard.svelte";
  import Sidebar from "@app/components/Sidebar.svelte";
  import ToolRenderer from "@app/components/ToolRenderer.svelte";

  let activePage = $state<Page>("home");
  let initialContent = $state("");
  let recentList = $state<string[]>(JSON.parse(localStorage.getItem("devkit-recent-tools") ?? "[]").slice(0, 5));
  let collapsed = $state(localStorage.getItem("devkit-sidebar-collapsed") === "true");
  let currentTheme = $state<"light" | "dark">(
    (localStorage.getItem("devkit-theme") as "light" | "dark" | null) ??
      (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"),
  );
  const PERF_LOG_STORAGE_KEY = "devkit-perf-log-enabled";
  let perfLogEnabled = $state(localStorage.getItem(PERF_LOG_STORAGE_KEY) === "true");

  const applyTheme = (theme: "light" | "dark") => {
    currentTheme = theme;
  };

  $effect(() => {
    localStorage.setItem("devkit-theme", currentTheme);
    document.documentElement.classList.toggle("dark", currentTheme === "dark");
  });

  const handleNavigate = (page: Page, content = "") => {
    activePage = page;
    initialContent = content;
    if (page !== "home") {
      recentList = [page, ...recentList.filter((p) => p !== page)].slice(0, 5);
      localStorage.setItem("devkit-recent-tools", JSON.stringify(recentList));
    }
  };

  // Perf diagnostics parity with React hook.
  let perfRaf = 0;
  let perfIv = 0;
  let perfPage = $state<Page>("home");
  let perfGaps: number[] = [];
  $effect(() => {
    perfPage = activePage;
  });

  const startPerfLogs = () => {
    console.info(`[DevKit perf] 已开启轮询日志；关闭侧边栏开关或清除 localStorage 项 ${PERF_LOG_STORAGE_KEY} 后停止。`);
    console.info(`[DevKit perf] navigate page=${activePage} t=${performance.now().toFixed(0)}`);
    let last = performance.now();
    const loop = (now: number) => {
      const gap = now - last;
      last = now;
      if (gap > 0 && gap < 500) {
        if (perfGaps.length >= 200) perfGaps.shift();
        perfGaps.push(gap);
      }
      perfRaf = requestAnimationFrame(loop);
    };
    perfRaf = requestAnimationFrame(loop);
    perfIv = window.setInterval(() => {
      if (perfGaps.length === 0) return;
      const snap = [...perfGaps].sort((a, b) => a - b);
      const n = snap.length;
      const sum = perfGaps.reduce((acc, x) => acc + x, 0);
      const max = Math.max(...perfGaps);
      const p95 = snap[Math.min(n - 1, Math.floor(n * 0.95))];
      const mem = (performance as Performance & { memory?: { usedJSHeapSize: number; totalJSHeapSize: number } }).memory;
      const heapStr = mem
        ? ` heap=${Math.round(mem.usedJSHeapSize / 1048576)}/${Math.round(mem.totalJSHeapSize / 1048576)}MB`
        : "";
      console.info(
        `[DevKit perf] ${perfPage}${heapStr} fps-gap mean=${(sum / n).toFixed(1)} p95=${p95.toFixed(1)} max=${max.toFixed(1)} n=${n}`,
      );
    }, 3000);
  };

  const stopPerfLogs = () => {
    if (perfIv) clearInterval(perfIv);
    if (perfRaf) cancelAnimationFrame(perfRaf);
    perfIv = 0;
    perfRaf = 0;
    perfGaps = [];
  };

  $effect(() => {
    localStorage.setItem(PERF_LOG_STORAGE_KEY, String(perfLogEnabled));
    stopPerfLogs();
    if (perfLogEnabled) startPerfLogs();
  });

  onDestroy(() => stopPerfLogs());
</script>

<div class="flex h-screen min-w-[640px] overflow-hidden">
  <Sidebar
    activePage={activePage}
    collapsed={collapsed}
    recent={recentList}
    theme={currentTheme}
    perfLogEnabled={perfLogEnabled}
    onNavigate={handleNavigate}
    onToggleCollapse={() => {
      collapsed = !collapsed;
      localStorage.setItem("devkit-sidebar-collapsed", String(collapsed));
    }}
    onToggleTheme={() => applyTheme(currentTheme === "dark" ? "light" : "dark")}
    onPerfLogChange={(enabled) => (perfLogEnabled = enabled)}
  />
  <main class="min-h-0 min-w-0 flex-1 overflow-auto">
    {#if activePage === "home"}
      <Dashboard recent={recentList} onNavigate={handleNavigate} />
    {:else}
      <ToolRenderer page={activePage} initialContent={initialContent} />
    {/if}
  </main>
</div>

import { useEffect, useRef } from "react";
import type { Page } from "@/types";

export const PERF_LOG_STORAGE_KEY = "devkit-perf-log-enabled";

interface MemoryInfo {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

function readMemory(): MemoryInfo | undefined {
  return (performance as Performance & { memory?: MemoryInfo }).memory;
}

const RING_SIZE = 200;

/** Fixed-size ring buffer — avoids per-frame splice/push GC pressure. */
class RingBuffer {
  private buf = new Float64Array(RING_SIZE);
  private idx = 0;
  private count = 0;

  push(v: number) {
    this.buf[this.idx] = v;
    this.idx = (this.idx + 1) % RING_SIZE;
    if (this.count < RING_SIZE) this.count++;
  }

  snapshot(): Float64Array {
    return this.buf.subarray(0, this.count);
  }
}

/**
 * 仅在用户手动打开「性能日志」时运行：rAF 采样帧间隔 + 定时 console 输出内存与帧时间统计。
 * 默认关闭，不设任何定时器。
 */
export function usePerfDiagnostics(activePage: Page, enabled: boolean): void {
  const pageRef = useRef(activePage);
  pageRef.current = activePage;

  useEffect(() => {
    if (!enabled) return;
    console.info(`[DevKit perf] 已开启轮询日志；关闭侧边栏开关或清除 localStorage 项 ${PERF_LOG_STORAGE_KEY} 后停止。`);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    console.info(`[DevKit perf] navigate page=${activePage} t=${performance.now().toFixed(0)}`);
  }, [activePage, enabled]);

  useEffect(() => {
    if (!enabled) return;

    let rafId = 0;
    const ring = new RingBuffer();
    let last = performance.now();

    const loop = (now: number) => {
      const gap = now - last;
      last = now;
      if (gap > 0 && gap < 500) ring.push(gap);
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);

    const intervalMs = 3000;
    const iv = window.setInterval(() => {
      const mem = readMemory();
      const snap = ring.snapshot();
      const n = snap.length;
      if (n === 0) return;
      let sum = 0;
      let max = 0;
      for (let i = 0; i < n; i++) {
        sum += snap[i];
        if (snap[i] > max) max = snap[i];
      }
      const sorted = Float64Array.from(snap).sort();
      const p95 = sorted[Math.min(n - 1, Math.floor(n * 0.95))];
      const mean = sum / n;

      const heapStr = mem
        ? ` heap=${Math.round(mem.usedJSHeapSize / 1048576)}/${Math.round(mem.totalJSHeapSize / 1048576)}MB`
        : "";
      console.info(
        `[DevKit perf] ${pageRef.current}${heapStr} fps-gap mean=${mean.toFixed(1)} p95=${p95.toFixed(1)} max=${max.toFixed(1)} n=${n}`,
      );
    }, intervalMs);

    return () => {
      window.clearInterval(iv);
      cancelAnimationFrame(rafId);
    };
  }, [enabled]);
}

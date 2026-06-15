const MAX_DURATION_MS = 24 * 60 * 60 * 1000;

export function formatElapsed(ms: number): string {
  const safe = Math.max(0, Math.floor(ms));
  const hours = Math.floor(safe / 3600000);
  const minutes = Math.floor((safe % 3600000) / 60000);
  const seconds = Math.floor((safe % 60000) / 1000);
  const millis = safe % 1000;
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const pad3 = (n: number) => String(n).padStart(3, "0");
  return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}.${pad3(millis)}`;
}

export function parseDurationInput(hours: number, minutes: number, seconds: number): number {
  const h = Number.isFinite(hours) ? Math.max(0, Math.floor(hours)) : 0;
  const m = Number.isFinite(minutes) ? Math.max(0, Math.floor(minutes)) : 0;
  const s = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  if (m >= 60 || s >= 60) {
    throw new Error("分钟和秒需在 0-59 范围内");
  }
  const total = h * 3600000 + m * 60000 + s * 1000;
  if (total <= 0) throw new Error("请设置大于 0 的倒计时");
  if (total > MAX_DURATION_MS) throw new Error("倒计时最长 24 小时");
  return total;
}

export function clampCountdownMs(ms: number): number {
  return Math.max(0, Math.min(Math.floor(ms), MAX_DURATION_MS));
}

export const COUNTDOWN_PRESETS = [
  { label: "1 分钟", ms: 60_000 },
  { label: "3 分钟", ms: 180_000 },
  { label: "5 分钟", ms: 300_000 },
  { label: "10 分钟", ms: 600_000 },
] as const;

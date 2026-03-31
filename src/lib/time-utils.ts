export function formatDateTime(date: Date, timeZone: string): string {
  const fmt = new Intl.DateTimeFormat("sv-SE", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  return fmt.format(date).replace(" ", " ");
}

export function timestampToDate(input: string): {
  date: Date;
  type: "seconds" | "milliseconds";
} {
  const num = Number(input.trim());
  if (isNaN(num)) {
    throw new Error("无效的时间戳");
  }
  if (num > 1e12) {
    return { date: new Date(num), type: "milliseconds" };
  }
  return { date: new Date(num * 1000), type: "seconds" };
}

export function dateStringToTimestamps(input: string): {
  seconds: number;
  milliseconds: number;
} {
  const date = new Date(input.trim());
  if (isNaN(date.getTime())) {
    throw new Error("无效的日期时间格式");
  }
  const ms = date.getTime();
  return {
    seconds: Math.floor(ms / 1000),
    milliseconds: ms,
  };
}

export interface TimeDiff {
  totalMs: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export function localDateStr(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export interface TimeRange {
  start: Date;
  end: Date;
}

export function getTimeRangePreset(preset: string): TimeRange {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  switch (preset) {
    case "today":
      return { start: todayStart, end: todayEnd };
    case "yesterday": {
      const ys = new Date(todayStart);
      ys.setDate(ys.getDate() - 1);
      const ye = new Date(ys);
      ye.setHours(23, 59, 59, 999);
      return { start: ys, end: ye };
    }
    case "thisWeek": {
      const day = now.getDay() || 7;
      const ws = new Date(todayStart);
      ws.setDate(ws.getDate() - day + 1);
      return { start: ws, end: todayEnd };
    }
    case "lastWeek": {
      const day = now.getDay() || 7;
      const ws = new Date(todayStart);
      ws.setDate(ws.getDate() - day - 6);
      const we = new Date(ws);
      we.setDate(we.getDate() + 6);
      we.setHours(23, 59, 59, 999);
      return { start: ws, end: we };
    }
    case "last7d": {
      const s = new Date(todayStart);
      s.setDate(s.getDate() - 6);
      return { start: s, end: todayEnd };
    }
    case "last30d": {
      const s = new Date(todayStart);
      s.setDate(s.getDate() - 29);
      return { start: s, end: todayEnd };
    }
    case "thisMonth":
      return {
        start: new Date(now.getFullYear(), now.getMonth(), 1),
        end: todayEnd,
      };
    case "lastMonth": {
      const ms = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const me = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { start: ms, end: me };
    }
    case "thisYear":
      return {
        start: new Date(now.getFullYear(), 0, 1),
        end: todayEnd,
      };
    default:
      return { start: todayStart, end: todayEnd };
  }
}

export function calculateTimeDiff(dateStr1: string, dateStr2: string): TimeDiff {
  const d1 = new Date(dateStr1.trim());
  const d2 = new Date(dateStr2.trim());
  if (isNaN(d1.getTime())) throw new Error("第一个日期格式无效");
  if (isNaN(d2.getTime())) throw new Error("第二个日期格式无效");

  const totalMs = Math.abs(d2.getTime() - d1.getTime());
  const totalSec = Math.floor(totalMs / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  return { totalMs, days, hours, minutes, seconds };
}

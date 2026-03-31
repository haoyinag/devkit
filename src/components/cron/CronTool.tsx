import { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, CalendarDays, Zap } from "lucide-react";

const DAY_NAMES = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

const PRESETS = [
  { label: "每分钟", value: "* * * * *" },
  { label: "每5分钟", value: "*/5 * * * *" },
  { label: "每小时", value: "0 * * * *" },
  { label: "每天 0:00", value: "0 0 * * *" },
  { label: "每天 9:00", value: "0 9 * * *" },
  { label: "每周一 9:00", value: "0 9 * * 1" },
  { label: "工作日 9:00", value: "0 9 * * 1-5" },
  { label: "每月1日", value: "0 0 1 * *" },
  { label: "每季度", value: "0 0 1 1,4,7,10 *" },
];

const FIELD_REF = [
  { pos: 1, field: "分钟", range: "0-59" },
  { pos: 2, field: "小时", range: "0-23" },
  { pos: 3, field: "日", range: "1-31" },
  { pos: 4, field: "月", range: "1-12" },
  { pos: 5, field: "星期", range: "0-7 (0,7=周日)" },
];

function parseField(field: string, min: number, max: number): number[] | null {
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

    if (rangePart === "*") {
      for (let i = min; i <= max; i += step) values.add(i);
    } else if (rangePart.includes("-")) {
      const [startStr, endStr] = rangePart.split("-");
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (isNaN(start) || isNaN(end) || start < min || end > max || start > end) return null;
      for (let i = start; i <= end; i += step) values.add(i);
    } else {
      const val = parseInt(rangePart, 10);
      if (isNaN(val) || val < min || val > max) return null;
      if (step > 1) {
        for (let i = val; i <= max; i += step) values.add(i);
      } else {
        values.add(val);
      }
    }
  }

  return values.size > 0 ? Array.from(values).sort((a, b) => a - b) : null;
}

function parseDowField(field: string): number[] | null {
  const result = parseField(field, 0, 7);
  if (!result) return null;
  const normalized = new Set(result.map((v) => (v === 7 ? 0 : v)));
  return Array.from(normalized).sort((a, b) => a - b);
}

function describeCron(expr: string): string {
  const parts = expr.trim().split(/\s+/);
  let minute: string, hour: string, dom: string, month: string, dow: string;

  if (parts.length === 5) {
    [minute, hour, dom, month, dow] = parts;
  } else if (parts.length === 6) {
    [, minute, hour, dom, month, dow] = parts;
  } else {
    return "无效的 Cron 表达式";
  }

  const segments: string[] = [];

  if (month !== "*") {
    const months = parseField(month, 1, 12);
    if (!months) return "无效的月份字段";
    if (month.startsWith("*/")) {
      segments.push(`每${month.slice(2)}个月`);
    } else {
      segments.push(months.map((m) => `${m}月`).join("、"));
    }
  }

  if (dow !== "*") {
    const days = parseDowField(dow);
    if (!days) return "无效的星期字段";
    if (days.length === 1) {
      segments.push(`每${DAY_NAMES[days[0]]}`);
    } else {
      const consecutive =
        days.length > 1 && days.every((d, i) => i === 0 || d === days[i - 1] + 1);
      if (consecutive) {
        segments.push(`每${DAY_NAMES[days[0]]}到${DAY_NAMES[days[days.length - 1]]}`);
      } else {
        segments.push(`每${days.map((d) => DAY_NAMES[d]).join("、")}`);
      }
    }
  }

  if (dom !== "*") {
    const doms = parseField(dom, 1, 31);
    if (!doms) return "无效的日期字段";
    if (dom.startsWith("*/")) {
      segments.push(`每${dom.slice(2)}天`);
    } else {
      segments.push(doms.map((d) => `${d}日`).join("、"));
    }
    if (dow === "*" && month === "*") {
      segments.unshift("每月");
    }
  }

  if (minute === "*" && hour === "*") {
    segments.push("每分钟");
  } else if (minute.startsWith("*/") && hour === "*") {
    segments.push(`每${minute.slice(2)}分钟`);
  } else if (hour === "*" && !minute.startsWith("*/")) {
    const mins = parseField(minute, 0, 59);
    if (!mins) return "无效的分钟字段";
    segments.push(`每小时第 ${mins.join("、")} 分`);
  } else if (hour !== "*") {
    const hours = parseField(hour, 0, 23);
    const mins = parseField(minute, 0, 59);
    if (!hours || !mins) return "无效的时间字段";

    if (hour.startsWith("*/")) {
      segments.push(`每${hour.slice(2)}小时`);
      if (minute !== "0" && minute !== "*") {
        segments.push(`第 ${mins.join("、")} 分`);
      }
    } else {
      const times = hours.map((h) =>
        mins.map((m) => `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`),
      ).flat();
      if (times.length <= 4) {
        segments.push(times.join(" 和 "));
      } else {
        segments.push(`${times.slice(0, 3).join("、")} 等 ${times.length} 个时间点`);
      }
    }
    if (segments.length === 1 && dow === "*" && dom === "*" && month === "*") {
      segments.unshift("每天");
    }
  }

  return segments.join(" ") || "每分钟";
}

interface ParsedCron {
  minutes: number[];
  hours: number[];
  doms: number[];
  months: number[];
  dows: number[];
}

function parseCron(expr: string): ParsedCron | null {
  const parts = expr.trim().split(/\s+/);
  let minute: string, hour: string, dom: string, month: string, dow: string;

  if (parts.length === 5) {
    [minute, hour, dom, month, dow] = parts;
  } else if (parts.length === 6) {
    [, minute, hour, dom, month, dow] = parts;
  } else {
    return null;
  }

  const minutes = parseField(minute, 0, 59);
  const hours = parseField(hour, 0, 23);
  const doms = parseField(dom, 1, 31);
  const months = parseField(month, 1, 12);
  const dows = parseDowField(dow);

  if (!minutes || !hours || !doms || !months || !dows) return null;
  return { minutes, hours, doms, months, dows };
}

function getNextExecutions(expr: string, count: number): Date[] {
  const parsed = parseCron(expr);
  if (!parsed) return [];

  const { minutes, hours, doms, months, dows } = parsed;
  const minuteSet = new Set(minutes);
  const hourSet = new Set(hours);
  const domSet = new Set(doms);
  const monthSet = new Set(months);
  const dowSet = new Set(dows);

  const results: Date[] = [];
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes() + 1, 0, 0);
  const limit = new Date(start.getTime() + 365 * 24 * 60 * 60 * 1000);

  const cursor = new Date(start);

  while (results.length < count && cursor < limit) {
    if (!monthSet.has(cursor.getMonth() + 1)) {
      cursor.setMonth(cursor.getMonth() + 1, 1);
      cursor.setHours(0, 0, 0, 0);
      continue;
    }
    if (!domSet.has(cursor.getDate())) {
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(0, 0, 0, 0);
      continue;
    }
    if (!dowSet.has(cursor.getDay())) {
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(0, 0, 0, 0);
      continue;
    }
    if (!hourSet.has(cursor.getHours())) {
      cursor.setHours(cursor.getHours() + 1, 0, 0, 0);
      continue;
    }
    if (!minuteSet.has(cursor.getMinutes())) {
      cursor.setMinutes(cursor.getMinutes() + 1, 0, 0);
      continue;
    }

    results.push(new Date(cursor));
    cursor.setMinutes(cursor.getMinutes() + 1, 0, 0);
  }

  return results;
}

function formatExecDate(date: Date): string {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  const day = DAY_NAMES[date.getDay()];
  return `${y}-${mo}-${d} ${h}:${mi}:${s} (${day})`;
}

function relativeTime(date: Date): string {
  const diff = date.getTime() - Date.now();
  if (diff < 0) return "已过";
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}分钟后`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时后`;
  const days = Math.floor(hours / 24);
  return `${days}天后`;
}

export function CronTool() {
  const [expression, setExpression] = useState("0 9 * * 1-5");

  const handlePreset = useCallback((value: string) => {
    setExpression(value);
  }, []);

  const { description, executions, error } = useMemo(() => {
    const trimmed = expression.trim();
    if (!trimmed) return { description: "", executions: [], error: "" };

    const parts = trimmed.split(/\s+/);
    if (parts.length < 5 || parts.length > 6) {
      return { description: "", executions: [], error: "Cron 表达式应包含 5 或 6 个字段" };
    }

    const parsed = parseCron(trimmed);
    if (!parsed) {
      return { description: "", executions: [], error: "无效的 Cron 表达式，请检查各字段取值" };
    }

    const desc = describeCron(trimmed);
    if (desc.startsWith("无效")) {
      return { description: "", executions: [], error: desc };
    }

    const execs = getNextExecutions(trimmed, 10);
    return { description: desc, executions: execs, error: "" };
  }, [expression]);

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      <h2 className="mb-4 text-2xl font-bold tracking-tight">Cron 表达式解析</h2>

      <div className="space-y-4">
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-3">
              <input
                type="text"
                value={expression}
                onChange={(e) => setExpression(e.target.value)}
                spellCheck={false}
                placeholder="输入 Cron 表达式，如 0 9 * * 1-5"
                className="w-full rounded-md border bg-background px-4 py-3 font-mono text-lg focus:outline-none focus:ring-2 focus:ring-ring"
              />

              {error && (
                <Badge variant="destructive" className="text-sm">
                  {error}
                </Badge>
              )}

              {description && !error && (
                <div className="flex items-center gap-2 rounded-md bg-muted px-4 py-2">
                  <Zap className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{description}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">常用预设</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <Button
                  key={p.value}
                  variant={expression === p.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => handlePreset(p.value)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {executions.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <CalendarDays className="h-4 w-4" />
                接下来 {executions.length} 次执行时间
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {executions.map((date, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded px-3 py-1.5 text-sm odd:bg-muted/50"
                  >
                    <span className="font-mono">{formatExecDate(date)}</span>
                    <span className="text-muted-foreground">{relativeTime(date)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Clock className="h-4 w-4" />
              字段参考
            </CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4">位置</th>
                  <th className="pb-2 pr-4">字段</th>
                  <th className="pb-2">取值范围</th>
                </tr>
              </thead>
              <tbody>
                {FIELD_REF.map((f) => (
                  <tr key={f.pos} className="border-b last:border-0">
                    <td className="py-1.5 pr-4 font-mono">{f.pos}</td>
                    <td className="py-1.5 pr-4">{f.field}</td>
                    <td className="py-1.5 font-mono text-muted-foreground">{f.range}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

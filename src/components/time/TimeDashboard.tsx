import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/time-utils";

const TIMEZONES = [
  { label: "本地时间", zone: Intl.DateTimeFormat().resolvedOptions().timeZone },
  { label: "UTC 时间", zone: "UTC" },
  { label: "北京时间", zone: "Asia/Shanghai" },
];

function relativeTime(now: Date): string {
  const h = now.getHours();
  const progress = ((h * 60 + now.getMinutes()) / 1440) * 100;
  const period =
    h < 6 ? "凌晨" : h < 9 ? "早晨" : h < 12 ? "上午" : h < 14 ? "中午" : h < 17 ? "下午" : h < 19 ? "傍晚" : "晚上";

  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  const remaining = endOfDay.getTime() - now.getTime();
  const remH = Math.floor(remaining / 3600000);
  const remM = Math.floor((remaining % 3600000) / 60000);

  return `${period} · 今日已过 ${progress.toFixed(1)}% · 剩余 ${remH}h ${remM}m`;
}

export function TimeDashboard() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="space-y-4">
      <div className="rounded-md bg-muted px-4 py-2 text-sm text-muted-foreground">
        {relativeTime(now)}
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {TIMEZONES.map(({ label, zone }) => (
          <Card key={zone}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-mono text-2xl font-bold tracking-tight">
                {formatDateTime(now, zone)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{zone}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">当前时间戳</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div>
              <span className="text-xs text-muted-foreground">秒级</span>
              <p className="font-mono text-lg font-bold">{Math.floor(now.getTime() / 1000)}</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">毫秒级</span>
              <p className="font-mono text-lg font-bold">{now.getTime()}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

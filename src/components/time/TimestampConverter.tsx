import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  timestampToDate,
  dateStringToTimestamps,
  formatDateTime,
  nowLocalMinuteStr,
} from "@/lib/time-utils";
import { DateTimeMinuteInput } from "./DateTimeMinuteInput";

function CopyableValue({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timerRef.current), []);
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 1200);
    });
  }, [value]);

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1">
        <span className="font-mono text-sm font-medium">{value}</span>
        <button
          onClick={handleCopy}
          className="rounded px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          {copied ? "已复制" : "复制"}
        </button>
      </div>
    </div>
  );
}

export function TimestampConverter() {
  const [tsInput, setTsInput] = useState("");
  const [dateInput, setDateInput] = useState("");
  const [tsResult, setTsResult] = useState<string | null>(null);
  const [tsType, setTsType] = useState<string | null>(null);
  const [dateResult, setDateResult] = useState<{
    seconds: number;
    milliseconds: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTimestampConvert = useCallback(() => {
    try {
      const { date, type } = timestampToDate(tsInput);
      setTsResult(formatDateTime(date, "Asia/Shanghai"));
      setTsType(type === "seconds" ? "秒级 (10位)" : "毫秒级 (13位)");
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "转换失败");
      setTsResult(null);
      setTsType(null);
    }
  }, [tsInput]);

  const handleDateConvert = useCallback(() => {
    try {
      const result = dateStringToTimestamps(dateInput);
      setDateResult(result);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "转换失败");
      setDateResult(null);
    }
  }, [dateInput]);

  const handleNow = useCallback(() => {
    setTsInput(String(Math.floor(Date.now() / 1000)));
  }, []);

  const handleNowDate = useCallback(() => {
    setDateInput(nowLocalMinuteStr());
  }, []);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">时间戳 → 日期时间</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>时间戳</Label>
            <div className="flex gap-2">
              <Input
                value={tsInput}
                onChange={(e) => setTsInput(e.target.value)}
                placeholder="如 1711900800 或 1711900800000"
                className="font-mono"
                onKeyDown={(e) => e.key === "Enter" && handleTimestampConvert()}
              />
              <Button onClick={handleNow} variant="outline" size="sm" className="shrink-0">
                当前
              </Button>
            </div>
          </div>
          <Button onClick={handleTimestampConvert} size="sm">
            转换
          </Button>
          {tsResult && (
            <div className="rounded-md bg-muted p-3">
              <CopyableValue label="日期时间" value={tsResult} />
              {tsType && (
                <Badge variant="secondary" className="mt-2">
                  {tsType}
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">日期时间 → 时间戳</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>日期时间</Label>
            <div className="flex gap-2">
              <DateTimeMinuteInput
                value={dateInput}
                onChange={setDateInput}
                onKeyDown={(e) => e.key === "Enter" && handleDateConvert()}
              />
              <Button onClick={handleNowDate} variant="outline" size="sm" className="shrink-0">
                当前
              </Button>
            </div>
          </div>
          <Button onClick={handleDateConvert} size="sm">
            转换
          </Button>
          {dateResult && (
            <div className="space-y-2 rounded-md bg-muted p-3">
              <CopyableValue label="秒级" value={String(dateResult.seconds)} />
              <CopyableValue label="毫秒级" value={String(dateResult.milliseconds)} />
            </div>
          )}
        </CardContent>
      </Card>

      {error && (
        <div className="md:col-span-2">
          <Badge variant="destructive">{error}</Badge>
        </div>
      )}
    </div>
  );
}

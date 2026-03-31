import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  localDateStr,
  getTimeRangePreset,
  dateStringToTimestamps,
} from "@/lib/time-utils";

const PRESETS = [
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

interface RangeResult {
  startSec: number;
  startMs: number;
  startIso: string;
  endSec: number;
  endMs: number;
  endIso: string;
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="ml-2 inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
      title="复制"
    >
      {copied ? "已复制" : "复制"}
    </button>
  );
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <span className="shrink-0 text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center">
        <code className="rounded bg-muted px-2 py-0.5 font-mono text-sm">
          {value}
        </code>
        <CopyBtn text={value} />
      </div>
    </div>
  );
}

export function TimeRangeGenerator() {
  const [startStr, setStartStr] = useState("");
  const [endStr, setEndStr] = useState("");
  const [result, setResult] = useState<RangeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const applyPreset = useCallback((presetId: string) => {
    const { start, end } = getTimeRangePreset(presetId);
    const s = localDateStr(start);
    const e = localDateStr(end);
    setStartStr(s);
    setEndStr(e);
    computeResult(s, e);
  }, []);

  const computeResult = useCallback((s: string, e: string) => {
    try {
      if (!s.trim() || !e.trim()) {
        setError("请填写开始和结束时间");
        setResult(null);
        return;
      }
      const startTs = dateStringToTimestamps(s);
      const endTs = dateStringToTimestamps(e);
      const startDate = new Date(s.trim());
      const endDate = new Date(e.trim());
      setResult({
        startSec: startTs.seconds,
        startMs: startTs.milliseconds,
        startIso: startDate.toISOString(),
        endSec: endTs.seconds,
        endMs: endTs.milliseconds,
        endIso: endDate.toISOString(),
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "时间格式无效");
      setResult(null);
    }
  }, []);

  const handleGenerate = useCallback(() => {
    computeResult(startStr, endStr);
  }, [startStr, endStr, computeResult]);

  const handleNow = useCallback((setter: (v: string) => void) => {
    setter(localDateStr(new Date()));
  }, []);

  const handleCopyAll = useCallback(() => {
    if (!result) return;
    const text = [
      `startTime (秒): ${result.startSec}`,
      `startTime (毫秒): ${result.startMs}`,
      `startTime (ISO): ${result.startIso}`,
      `endTime (秒): ${result.endSec}`,
      `endTime (毫秒): ${result.endMs}`,
      `endTime (ISO): ${result.endIso}`,
    ].join("\n");
    navigator.clipboard.writeText(text);
  }, [result]);

  const handleCopyJson = useCallback(() => {
    if (!result) return;
    const json = JSON.stringify(
      {
        startTime: result.startSec,
        endTime: result.endSec,
      },
      null,
      2,
    );
    navigator.clipboard.writeText(json);
  }, [result]);

  const handleCopyJsonMs = useCallback(() => {
    if (!result) return;
    const json = JSON.stringify(
      {
        startTime: result.startMs,
        endTime: result.endMs,
      },
      null,
      2,
    );
    navigator.clipboard.writeText(json);
  }, [result]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">快捷时间范围</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <Button
                key={p.id}
                variant="outline"
                size="sm"
                onClick={() => applyPreset(p.id)}
              >
                {p.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">自定义时间范围</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>开始时间</Label>
              <div className="flex gap-2">
                <Input
                  value={startStr}
                  onChange={(e) => setStartStr(e.target.value)}
                  placeholder="如 2024-01-01 00:00:00"
                  className="font-mono"
                  onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
                />
                <Button
                  onClick={() => handleNow(setStartStr)}
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                >
                  当前
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>结束时间</Label>
              <div className="flex gap-2">
                <Input
                  value={endStr}
                  onChange={(e) => setEndStr(e.target.value)}
                  placeholder="如 2024-12-31 23:59:59"
                  className="font-mono"
                  onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
                />
                <Button
                  onClick={() => handleNow(setEndStr)}
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                >
                  当前
                </Button>
              </div>
            </div>
          </div>

          <Button onClick={handleGenerate} size="sm">
            生成时间戳
          </Button>

          {error && <Badge variant="destructive">{error}</Badge>}
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">转换结果</CardTitle>
              <div className="flex gap-2">
                <Button onClick={handleCopyJson} variant="outline" size="sm">
                  复制 JSON (秒)
                </Button>
                <Button onClick={handleCopyJsonMs} variant="outline" size="sm">
                  复制 JSON (毫秒)
                </Button>
                <Button onClick={handleCopyAll} variant="ghost" size="sm">
                  复制全部
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="mb-1 text-sm font-medium">开始时间 (startTime)</p>
              <div className="rounded-md bg-muted p-3">
                <ResultRow label="秒级" value={String(result.startSec)} />
                <ResultRow label="毫秒级" value={String(result.startMs)} />
                <ResultRow label="ISO 8601" value={result.startIso} />
              </div>
            </div>

            <Separator />

            <div>
              <p className="mb-1 text-sm font-medium">结束时间 (endTime)</p>
              <div className="rounded-md bg-muted p-3">
                <ResultRow label="秒级" value={String(result.endSec)} />
                <ResultRow label="毫秒级" value={String(result.endMs)} />
                <ResultRow label="ISO 8601" value={result.endIso} />
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

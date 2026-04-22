import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { calculateTimeDiff, nowLocalMinuteStr, type TimeDiff } from "@/lib/time-utils";
import { DateTimeMinuteInput } from "./DateTimeMinuteInput";

export function TimeDiffCalculator() {
  const [date1, setDate1] = useState("");
  const [date2, setDate2] = useState("");
  const [result, setResult] = useState<TimeDiff | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCalculate = useCallback(() => {
    try {
      setResult(calculateTimeDiff(date1, date2));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "计算失败");
      setResult(null);
    }
  }, [date1, date2]);

  const handleNow = useCallback((setter: (v: string) => void) => {
    setter(nowLocalMinuteStr());
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">时间差计算</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>开始时间</Label>
            <div className="flex gap-2">
              <DateTimeMinuteInput value={date1} onChange={setDate1} />
              <Button
                onClick={() => handleNow(setDate1)}
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
              <DateTimeMinuteInput value={date2} onChange={setDate2} />
              <Button
                onClick={() => handleNow(setDate2)}
                variant="outline"
                size="sm"
                className="shrink-0"
              >
                当前
              </Button>
            </div>
          </div>
        </div>

        <Button onClick={handleCalculate} size="sm">
          计算差值
        </Button>

        {error && <Badge variant="destructive">{error}</Badge>}

        {result && (
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "天", value: result.days },
              { label: "小时", value: result.hours },
              { label: "分钟", value: result.minutes },
              { label: "秒", value: result.seconds },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="rounded-md bg-muted p-3 text-center"
              >
                <p className="font-mono text-2xl font-bold">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

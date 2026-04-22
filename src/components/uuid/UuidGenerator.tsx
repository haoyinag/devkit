import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function UuidGenerator() {
  const [count, setCount] = useState(1);
  const [uppercase, setUppercase] = useState(false);
  const [noDashes, setNoDashes] = useState(false);
  const [uuids, setUuids] = useState<string[]>([]);
  const [copyLabel, setCopyLabel] = useState("复制全部");
  const copyTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(copyTimerRef.current), []);

  const generate = useCallback(() => {
    const list: string[] = [];
    for (let i = 0; i < Math.min(count, 100); i++) {
      let id: string = crypto.randomUUID();
      if (noDashes) id = id.replace(/-/g, "");
      if (uppercase) id = id.toUpperCase();
      list.push(id);
    }
    setUuids(list);
  }, [count, uppercase, noDashes]);

  const copyAll = useCallback(() => {
    navigator.clipboard.writeText(uuids.join("\n")).then(() => {
      setCopyLabel("已复制");
      clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopyLabel("复制全部"), 1500);
    });
  }, [uuids]);

  const copySingle = useCallback((v: string) => {
    navigator.clipboard.writeText(v);
  }, []);

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <h2 className="text-2xl font-bold tracking-tight">UUID 生成器</h2>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Label className="text-sm">数量</Label>
          <Input
            type="number"
            min={1}
            max={100}
            value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
            className="h-8 w-20 font-mono text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch id="uuid-upper" checked={uppercase} onCheckedChange={setUppercase} />
          <Label htmlFor="uuid-upper" className="text-sm">大写</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="uuid-dash" checked={noDashes} onCheckedChange={setNoDashes} />
          <Label htmlFor="uuid-dash" className="text-sm">无横线</Label>
        </div>
        <Button onClick={generate} size="sm">生成</Button>
        <Button onClick={copyAll} variant="ghost" size="sm" disabled={uuids.length === 0}>{copyLabel}</Button>
      </div>

      {uuids.length > 0 && (
        <Card className="min-h-0 flex-1 overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              已生成 {uuids.length} 个 UUID
            </CardTitle>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 overflow-y-auto pb-4">
            <div className="space-y-1">
              {uuids.map((id, i) => (
                <div
                  key={i}
                  className="group flex items-center justify-between rounded px-2 py-1 hover:bg-muted"
                >
                  <code className="font-mono text-sm">{id}</code>
                  <button
                    onClick={() => copySingle(id)}
                    className="invisible rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground group-hover:visible"
                  >
                    复制
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

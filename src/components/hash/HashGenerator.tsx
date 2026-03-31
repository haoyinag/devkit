import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { md5, sha } from "@/lib/hash-utils";

const ALGORITHMS = [
  { id: "md5", label: "MD5" },
  { id: "SHA-1", label: "SHA-1" },
  { id: "SHA-256", label: "SHA-256" },
  { id: "SHA-384", label: "SHA-384" },
  { id: "SHA-512", label: "SHA-512" },
];

export function HashGenerator() {
  const [input, setInput] = useState("");
  const [results, setResults] = useState<Record<string, string>>({});
  const [uppercase, setUppercase] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [computing, setComputing] = useState(false);

  const handleCompute = useCallback(async () => {
    if (!input) {
      setError("请输入要哈希的内容");
      return;
    }
    setComputing(true);
    setError(null);
    try {
      const hash: Record<string, string> = {};
      hash["md5"] = md5(input);
      for (const algo of ["SHA-1", "SHA-256", "SHA-384", "SHA-512"]) {
        hash[algo] = await sha(algo, input);
      }
      setResults(hash);
    } catch (e) {
      setError(e instanceof Error ? e.message : "计算失败");
    } finally {
      setComputing(false);
    }
  }, [input]);

  const copyValue = useCallback(
    (v: string) => {
      const text = uppercase ? v.toUpperCase() : v;
      navigator.clipboard.writeText(text);
    },
    [uppercase],
  );

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <h2 className="text-2xl font-bold tracking-tight">Hash 计算</h2>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={handleCompute} size="sm" disabled={computing}>
          {computing ? "计算中..." : "计算全部"}
        </Button>
        <div className="flex items-center gap-2">
          <Switch id="hash-upper" checked={uppercase} onCheckedChange={setUppercase} />
          <Label htmlFor="hash-upper" className="text-sm">大写</Label>
        </div>
        <Button onClick={() => { setInput(""); setResults({}); setError(null); }} variant="ghost" size="sm">清空</Button>
      </div>

      {error && <Badge variant="destructive" className="w-fit">{error}</Badge>}

      <div className="rounded-xl bg-card ring-1 ring-foreground/10">
        <div className="px-4 pt-3 pb-1">
          <Label className="text-sm text-muted-foreground">输入文本</Label>
        </div>
        <div className="px-4 pb-4">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入要计算哈希的文本"
            rows={4}
            className="block w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 font-mono text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            spellCheck={false}
          />
        </div>
      </div>

      {Object.keys(results).length > 0 && (
        <Card className="min-h-0 overflow-y-auto">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">结果</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {ALGORITHMS.map(({ id, label }) => {
              const val = results[id];
              if (!val) return null;
              const display = uppercase ? val.toUpperCase() : val;
              return (
                <div key={id}>
                  <div className="mb-1 text-xs font-medium text-muted-foreground">{label}</div>
                  <div className="group flex items-center gap-2 rounded bg-muted px-3 py-2">
                    <code className="flex-1 break-all font-mono text-sm">{display}</code>
                    <button
                      onClick={() => copyValue(val)}
                      className="shrink-0 rounded px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      复制
                    </button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

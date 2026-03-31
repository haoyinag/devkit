import { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const PRESETS = [
  { label: "邮箱", pattern: "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}" },
  { label: "手机号", pattern: "1[3-9]\\d{9}" },
  { label: "URL", pattern: "https?://[^\\s]+" },
  { label: "IPv4", pattern: "\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}" },
  { label: "日期", pattern: "\\d{4}-\\d{2}-\\d{2}" },
  { label: "中文", pattern: "[\\u4e00-\\u9fa5]+" },
];

interface MatchInfo {
  index: number;
  text: string;
  groups: Record<string, string>;
}

export function RegexTester() {
  const [pattern, setPattern] = useState("");
  const [flagG, setFlagG] = useState(true);
  const [flagI, setFlagI] = useState(false);
  const [flagM, setFlagM] = useState(false);
  const [flagS, setFlagS] = useState(false);
  const [testStr, setTestStr] = useState("");
  const [error, setError] = useState<string | null>(null);

  const flags = useMemo(() => {
    let f = "";
    if (flagG) f += "g";
    if (flagI) f += "i";
    if (flagM) f += "m";
    if (flagS) f += "s";
    return f;
  }, [flagG, flagI, flagM, flagS]);

  const { matches, highlightedParts } = useMemo(() => {
    if (!pattern || !testStr) return { matches: [] as MatchInfo[], highlightedParts: [] as { text: string; matched: boolean }[] };
    try {
      const re = new RegExp(pattern, flags.includes("g") ? flags : flags + "g");
      const found: MatchInfo[] = [];
      let m: RegExpExecArray | null;
      while ((m = re.exec(testStr)) !== null) {
        found.push({
          index: m.index,
          text: m[0],
          groups: m.groups ? { ...m.groups } : {},
        });
        if (!m[0]) break;
      }

      const parts: { text: string; matched: boolean }[] = [];
      let last = 0;
      for (const match of found) {
        if (match.index > last) {
          parts.push({ text: testStr.slice(last, match.index), matched: false });
        }
        parts.push({ text: match.text, matched: true });
        last = match.index + match.text.length;
      }
      if (last < testStr.length) {
        parts.push({ text: testStr.slice(last), matched: false });
      }

      setError(null);
      return { matches: found, highlightedParts: parts };
    } catch (e) {
      setError(e instanceof Error ? e.message : "正则表达式无效");
      return { matches: [] as MatchInfo[], highlightedParts: [] as { text: string; matched: boolean }[] };
    }
  }, [pattern, testStr, flags]);

  const applyPreset = useCallback((p: string) => {
    setPattern(p);
  }, []);

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-6">
      <h2 className="text-2xl font-bold tracking-tight">正则测试</h2>

      <div className="space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 space-y-1">
            <Label className="text-sm">正则表达式</Label>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">/</span>
              <Input
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
                placeholder="输入正则表达式"
                className="font-mono text-sm"
              />
              <span className="text-muted-foreground">/{flags}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <Switch id="f-g" checked={flagG} onCheckedChange={setFlagG} />
            <Label htmlFor="f-g" className="text-xs">global</Label>
          </div>
          <div className="flex items-center gap-1.5">
            <Switch id="f-i" checked={flagI} onCheckedChange={setFlagI} />
            <Label htmlFor="f-i" className="text-xs">ignoreCase</Label>
          </div>
          <div className="flex items-center gap-1.5">
            <Switch id="f-m" checked={flagM} onCheckedChange={setFlagM} />
            <Label htmlFor="f-m" className="text-xs">multiline</Label>
          </div>
          <div className="flex items-center gap-1.5">
            <Switch id="f-s" checked={flagS} onCheckedChange={setFlagS} />
            <Label htmlFor="f-s" className="text-xs">dotAll</Label>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <Button key={p.label} variant="outline" size="sm" className="h-7 text-xs" onClick={() => applyPreset(p.pattern)}>
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      {error && <Badge variant="destructive" className="w-fit">{error}</Badge>}

      <div className="rounded-xl bg-card ring-1 ring-foreground/10">
        <div className="px-4 pt-3 pb-1">
          <Label className="text-sm text-muted-foreground">测试文本</Label>
        </div>
        <div className="px-4 pb-4">
          <textarea
            value={testStr}
            onChange={(e) => setTestStr(e.target.value)}
            placeholder="输入要测试的文本"
            rows={5}
            className="block w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 font-mono text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            spellCheck={false}
          />
        </div>
      </div>

      {highlightedParts.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              匹配高亮 ({matches.length} 个匹配)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="overflow-auto whitespace-pre-wrap rounded bg-muted p-3 font-mono text-sm">
              {highlightedParts.map((part, i) =>
                part.matched ? (
                  <mark key={i} className="rounded-sm bg-primary/20 px-0.5 text-primary">
                    {part.text}
                  </mark>
                ) : (
                  <span key={i}>{part.text}</span>
                ),
              )}
            </pre>
          </CardContent>
        </Card>
      )}

      {matches.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">匹配详情</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {matches.slice(0, 50).map((m, i) => (
                <div key={i} className="flex items-center gap-3 rounded px-2 py-1 text-sm hover:bg-muted">
                  <span className="w-8 shrink-0 text-right text-xs text-muted-foreground">#{i + 1}</span>
                  <code className="font-mono">{m.text}</code>
                  <span className="text-xs text-muted-foreground">@{m.index}</span>
                  {Object.keys(m.groups).length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      groups: {JSON.stringify(m.groups)}
                    </span>
                  )}
                </div>
              ))}
              {matches.length > 50 && (
                <p className="px-2 text-xs text-muted-foreground">...还有 {matches.length - 50} 个匹配</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  initialContent?: string;
}

function decodeBase64Url(str: string): string {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  return decodeURIComponent(
    Array.from(atob(padded), (c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0")).join(""),
  );
}

function formatExpiry(exp: number): string {
  const now = Date.now() / 1000;
  const date = new Date(exp * 1000);
  const diff = exp - now;
  const dateStr = date.toLocaleString("sv-SE", { timeZone: "Asia/Shanghai" });
  if (diff < 0) {
    const ago = Math.abs(diff);
    if (ago < 3600) return `${dateStr} (${Math.floor(ago / 60)} 分钟前已过期)`;
    if (ago < 86400) return `${dateStr} (${Math.floor(ago / 3600)} 小时前已过期)`;
    return `${dateStr} (${Math.floor(ago / 86400)} 天前已过期)`;
  }
  if (diff < 3600) return `${dateStr} (${Math.floor(diff / 60)} 分钟后过期)`;
  if (diff < 86400) return `${dateStr} (${Math.floor(diff / 3600)} 小时后过期)`;
  return `${dateStr} (${Math.floor(diff / 86400)} 天后过期)`;
}

export function JwtDecoder({ initialContent }: Props) {
  const [input, setInput] = useState(initialContent ?? "");
  const [header, setHeader] = useState<string | null>(null);
  const [payload, setPayload] = useState<string | null>(null);
  const [expInfo, setExpInfo] = useState<string | null>(null);
  const [isExpired, setIsExpired] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const decode = useCallback(() => {
    try {
      const token = input.trim().replace(/^Bearer\s+/i, "");
      const parts = token.split(".");
      if (parts.length !== 3) throw new Error("JWT 格式无效：需要三段由 . 分隔");

      const h = JSON.parse(decodeBase64Url(parts[0]));
      const p = JSON.parse(decodeBase64Url(parts[1]));
      setHeader(JSON.stringify(h, null, 2));
      setPayload(JSON.stringify(p, null, 2));

      if (p.exp) {
        setExpInfo(formatExpiry(p.exp));
        setIsExpired(p.exp < Date.now() / 1000);
      } else {
        setExpInfo(null);
        setIsExpired(false);
      }
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "解码失败");
      setHeader(null);
      setPayload(null);
      setExpInfo(null);
    }
  }, [input]);

  useEffect(() => {
    if (initialContent) decode();
  }, [initialContent, decode]);

  const copySection = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
  }, []);

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <h2 className="text-2xl font-bold tracking-tight">JWT 解码</h2>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={decode} size="sm">解码</Button>
        <Button onClick={() => { setInput(""); setHeader(null); setPayload(null); setError(null); setExpInfo(null); }} variant="ghost" size="sm">清空</Button>
      </div>

      {error && <Badge variant="destructive" className="w-fit">{error}</Badge>}

      <div className="rounded-xl bg-card ring-1 ring-foreground/10">
        <div className="px-4 pt-3 pb-1">
          <Label className="text-sm text-muted-foreground">JWT Token（支持带 Bearer 前缀）</Label>
        </div>
        <div className="px-4 pb-4">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="粘贴 JWT Token"
            rows={3}
            className="block w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 font-mono text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            spellCheck={false}
          />
        </div>
      </div>

      {expInfo && (
        <Badge variant={isExpired ? "destructive" : "secondary"} className="w-fit">
          {isExpired ? "已过期" : "未过期"}: {expInfo}
        </Badge>
      )}

      {(header || payload) && (
        <div className="grid min-h-0 flex-1 grid-cols-2 gap-4">
          {header && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Header</CardTitle>
                  <button onClick={() => copySection(header)} className="rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-accent">复制</button>
                </div>
              </CardHeader>
              <CardContent>
                <pre className="overflow-auto rounded bg-muted p-3 font-mono text-sm">{header}</pre>
              </CardContent>
            </Card>
          )}
          {payload && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Payload</CardTitle>
                  <button onClick={() => copySection(payload)} className="rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-accent">复制</button>
                </div>
              </CardHeader>
              <CardContent>
                <pre className="overflow-auto rounded bg-muted p-3 font-mono text-sm">{payload}</pre>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

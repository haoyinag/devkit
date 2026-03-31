import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface Props {
  initialContent?: string;
}

export function Base64Tool({ initialContent }: Props) {
  const [input, setInput] = useState(initialContent ?? "");
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copyLabel, setCopyLabel] = useState("复制");

  const handleEncode = useCallback(() => {
    try {
      const encoded = btoa(
        encodeURIComponent(input).replace(/%([0-9A-F]{2})/g, (_, p1) =>
          String.fromCharCode(parseInt(p1, 16)),
        ),
      );
      setOutput(encoded);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "编码失败");
    }
  }, [input]);

  const handleDecode = useCallback(() => {
    try {
      const decoded = decodeURIComponent(
        Array.from(atob(input.trim()), (c) =>
          "%" + c.charCodeAt(0).toString(16).padStart(2, "0"),
        ).join(""),
      );
      setOutput(decoded);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "解码失败，输入不是合法的 Base64");
    }
  }, [input]);

  const handleCopy = useCallback(() => {
    if (output) {
      navigator.clipboard.writeText(output).then(() => {
        setCopyLabel("已复制");
        setTimeout(() => setCopyLabel("复制"), 1500);
      });
    }
  }, [output]);

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <h2 className="text-2xl font-bold tracking-tight">Base64 编解码</h2>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={handleEncode} size="sm">编码</Button>
        <Button onClick={handleDecode} variant="secondary" size="sm">解码</Button>
        <Button onClick={handleCopy} variant="ghost" size="sm" disabled={!output}>{copyLabel}</Button>
        <Button onClick={() => { setInput(""); setOutput(""); setError(null); }} variant="ghost" size="sm">清空</Button>
      </div>

      {error && <Badge variant="destructive" className="w-fit">{error}</Badge>}

      <div className="grid min-h-0 flex-1 grid-cols-2 gap-4">
        <div className="flex flex-col overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
          <div className="px-4 pt-3 pb-1">
            <Label className="text-sm text-muted-foreground">输入</Label>
          </div>
          <div className="min-h-0 flex-1 px-4 pb-4">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="输入要编码或解码的文本"
              className="block h-full w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 font-mono text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              spellCheck={false}
            />
          </div>
        </div>
        <div className="flex flex-col overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
          <div className="px-4 pt-3 pb-1">
            <Label className="text-sm text-muted-foreground">输出</Label>
          </div>
          <div className="min-h-0 flex-1 px-4 pb-4">
            <textarea
              value={output}
              readOnly
              placeholder="结果"
              className="block h-full w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 font-mono text-sm outline-none placeholder:text-muted-foreground dark:bg-input/30"
              spellCheck={false}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState, useCallback, useRef, useEffect } from "react";
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
  const copyTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(copyTimerRef.current), []);

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
        clearTimeout(copyTimerRef.current);
        copyTimerRef.current = setTimeout(() => setCopyLabel("复制"), 1500);
      });
    }
  }, [output]);

  return (
    <div className="tool-page-shell">
      <div className="tool-page-header">
        <h2 className="tool-page-title">Base64 编解码</h2>
      </div>

      <div className="tool-page-actions">
        <Button onClick={handleEncode} size="sm">编码</Button>
        <Button onClick={handleDecode} variant="secondary" size="sm">解码</Button>
        <Button onClick={handleCopy} variant="ghost" size="sm" disabled={!output}>{copyLabel}</Button>
        <Button onClick={() => { setInput(""); setOutput(""); setError(null); }} variant="ghost" size="sm">清空</Button>
      </div>

      {error && <Badge variant="destructive" className="w-fit">{error}</Badge>}

      <div className="tool-dual-grid">
        <div className="tool-panel">
          <div className="tool-panel-label">
            <Label className="text-sm text-muted-foreground">输入</Label>
          </div>
          <div className="tool-panel-body">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="输入要编码或解码的文本"
              className="tool-input-area"
              spellCheck={false}
            />
          </div>
        </div>
        <div className="tool-panel">
          <div className="tool-panel-label">
            <Label className="text-sm text-muted-foreground">输出</Label>
          </div>
          <div className="tool-panel-body">
            <textarea
              value={output}
              readOnly
              placeholder="结果"
              className="tool-input-area"
              spellCheck={false}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

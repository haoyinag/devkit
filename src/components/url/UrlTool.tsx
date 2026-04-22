import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface Props {
  initialContent?: string;
}

export function UrlTool({ initialContent }: Props) {
  const [input, setInput] = useState(initialContent ?? "");
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copyLabel, setCopyLabel] = useState("复制");
  const copyTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(copyTimerRef.current), []);

  const handleEncode = useCallback(() => {
    try {
      setOutput(encodeURIComponent(input));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "编码失败");
    }
  }, [input]);

  const handleEncodeAll = useCallback(() => {
    try {
      setOutput(encodeURI(input));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "编码失败");
    }
  }, [input]);

  const handleDecode = useCallback(() => {
    try {
      setOutput(decodeURIComponent(input.trim()));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "解码失败");
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
        <h2 className="tool-page-title">URL 编解码</h2>
      </div>

      <div className="tool-page-actions">
        <Button onClick={handleEncode} size="sm">编码 (Component)</Button>
        <Button onClick={handleEncodeAll} variant="secondary" size="sm">编码 (URI)</Button>
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
              placeholder="输入 URL 或已编码的字符串"
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

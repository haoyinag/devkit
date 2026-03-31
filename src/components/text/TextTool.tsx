import { useState, useCallback, useMemo } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TEXTAREA_CLASS =
  "block w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 font-mono text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

function useCopy() {
  const [copied, setCopied] = useState(false);
  const copy = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  }, []);
  return { copied, copy };
}

function CopyButton({ text }: { text: string }) {
  const { copied, copy } = useCopy();
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-7 gap-1 text-xs"
      onClick={() => copy(text)}
      disabled={!text}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {copied ? "已复制" : "复制"}
    </Button>
  );
}

// ── Case Conversion helpers ──

function splitWords(input: string): string[] {
  return input
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .split(/[\s_\-]+/)
    .filter(Boolean);
}

function toCamelCase(words: string[]): string {
  return words
    .map((w, i) =>
      i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
    )
    .join("");
}

function toSnakeCase(words: string[]): string {
  return words.map((w) => w.toLowerCase()).join("_");
}

function toKebabCase(words: string[]): string {
  return words.map((w) => w.toLowerCase()).join("-");
}

function toPascalCase(words: string[]): string {
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join("");
}

function toConstantCase(words: string[]): string {
  return words.map((w) => w.toUpperCase()).join("_");
}

function toTitleCase(words: string[]): string {
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

function toSentenceCase(words: string[]): string {
  return words
    .map((w, i) =>
      i === 0 ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase(),
    )
    .join(" ");
}

const CASE_BUTTONS = [
  { label: "camelCase", fn: toCamelCase },
  { label: "snake_case", fn: toSnakeCase },
  { label: "kebab-case", fn: toKebabCase },
  { label: "PascalCase", fn: toPascalCase },
  { label: "CONSTANT_CASE", fn: toConstantCase },
  { label: "lowercase", fn: (w: string[]) => w.join(" ").toLowerCase() },
  { label: "UPPERCASE", fn: (w: string[]) => w.join(" ").toUpperCase() },
  { label: "Title Case", fn: toTitleCase },
  { label: "Sentence case", fn: toSentenceCase },
] as const;

// ── Encode/Escape helpers ──

const HTML_ENTITY_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

const HTML_DECODE_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(HTML_ENTITY_MAP).map(([k, v]) => [v, k]),
);

function htmlEncode(str: string): string {
  return str.replace(/[&<>"']/g, (ch) => HTML_ENTITY_MAP[ch] ?? ch);
}

function htmlDecode(str: string): string {
  return str.replace(/&(?:amp|lt|gt|quot|#39);/g, (ent) => HTML_DECODE_MAP[ent] ?? ent);
}

function unicodeEscape(str: string): string {
  return Array.from(str)
    .map((ch) => {
      const code = ch.codePointAt(0)!;
      return code > 127 ? `\\u${code.toString(16).padStart(4, "0")}` : ch;
    })
    .join("");
}

function unicodeUnescape(str: string): string {
  return str.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16)),
  );
}

function jsEscape(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/'/g, "\\'")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t")
    .replace(/\0/g, "\\0");
}

function jsUnescape(str: string): string {
  return str
    .replace(/\\0/g, "\0")
    .replace(/\\t/g, "\t")
    .replace(/\\r/g, "\r")
    .replace(/\\n/g, "\n")
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

// ── Tab: Case Conversion ──

function CaseTab() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");

  const convert = useCallback(
    (fn: (words: string[]) => string) => {
      const words = splitWords(input);
      setOutput(words.length ? fn(words) : "");
    },
    [input],
  );

  return (
    <div className="space-y-4">
      <textarea
        className={TEXTAREA_CLASS}
        rows={5}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="输入要转换的文本"
        spellCheck={false}
      />
      <div className="flex flex-wrap gap-2">
        {CASE_BUTTONS.map((b) => (
          <Button
            key={b.label}
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => convert(b.fn)}
          >
            {b.label}
          </Button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">结果</span>
        <CopyButton text={output} />
      </div>
      <textarea
        className={TEXTAREA_CLASS}
        rows={5}
        value={output}
        readOnly
        placeholder="转换结果"
        spellCheck={false}
      />
    </div>
  );
}

// ── Tab: Dedup & Sort ──

function DedupSortTab() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");

  const inputLines = useMemo(() => input.split("\n"), [input]);
  const outputLines = useMemo(() => (output ? output.split("\n") : []), [output]);

  const apply = useCallback(
    (fn: (lines: string[]) => string[]) => {
      setOutput(fn(inputLines).join("\n"));
    },
    [inputLines],
  );

  const actions = useMemo(
    () => [
      { label: "去重", fn: (lines: string[]) => [...new Set(lines)] },
      { label: "排序 A-Z", fn: (lines: string[]) => [...lines].sort((a, b) => a.localeCompare(b)) },
      { label: "排序 Z-A", fn: (lines: string[]) => [...lines].sort((a, b) => b.localeCompare(a)) },
      {
        label: "数字排序",
        fn: (lines: string[]) => [...lines].sort((a, b) => parseFloat(a) - parseFloat(b)),
      },
      {
        label: "数字倒序",
        fn: (lines: string[]) => [...lines].sort((a, b) => parseFloat(b) - parseFloat(a)),
      },
      { label: "去空行", fn: (lines: string[]) => lines.filter((l) => l.trim() !== "") },
      { label: "去首尾空白", fn: (lines: string[]) => lines.map((l) => l.trim()) },
    ],
    [],
  );

  return (
    <div className="space-y-4">
      <textarea
        className={TEXTAREA_CLASS}
        rows={6}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="每行一个条目"
        spellCheck={false}
      />
      <div className="flex flex-wrap items-center gap-2">
        {actions.map((a) => (
          <Button
            key={a.label}
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => apply(a.fn)}
          >
            {a.label}
          </Button>
        ))}
      </div>
      {output && (
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Badge variant="secondary">输入 {inputLines.length} 行</Badge>
          <span>→</span>
          <Badge variant="secondary">输出 {outputLines.length} 行</Badge>
        </div>
      )}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">结果</span>
        <CopyButton text={output} />
      </div>
      <textarea
        className={TEXTAREA_CLASS}
        rows={6}
        value={output}
        readOnly
        placeholder="处理结果"
        spellCheck={false}
      />
    </div>
  );
}

// ── Tab: Encode/Escape ──

const ENCODE_BUTTONS = [
  { label: "HTML 实体编码", fn: htmlEncode },
  { label: "HTML 实体解码", fn: htmlDecode },
  { label: "Unicode 转义", fn: unicodeEscape },
  { label: "Unicode 反转义", fn: unicodeUnescape },
  { label: "JS 字符串转义", fn: jsEscape },
  { label: "JS 字符串反转义", fn: jsUnescape },
] as const;

function EncodeEscapeTab() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");

  const transform = useCallback(
    (fn: (s: string) => string) => {
      setOutput(fn(input));
    },
    [input],
  );

  return (
    <div className="space-y-4">
      <textarea
        className={TEXTAREA_CLASS}
        rows={5}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="输入要编码/转义的文本"
        spellCheck={false}
      />
      <div className="flex flex-wrap gap-2">
        {ENCODE_BUTTONS.map((b) => (
          <Button
            key={b.label}
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => transform(b.fn)}
          >
            {b.label}
          </Button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">结果</span>
        <CopyButton text={output} />
      </div>
      <textarea
        className={TEXTAREA_CLASS}
        rows={5}
        value={output}
        readOnly
        placeholder="编码/转义结果"
        spellCheck={false}
      />
    </div>
  );
}

// ── Tab: Statistics ──

function StatsTab() {
  const [input, setInput] = useState("");

  const stats = useMemo(() => {
    if (!input) return null;
    const chars = [...input].length;
    const charsNoSpace = [...input.replace(/\s/g, "")].length;
    const words = input.trim() ? input.trim().split(/\s+/).length : 0;
    const lines = input.split("\n").length;
    const bytes = new TextEncoder().encode(input).length;
    const paragraphs = input.trim()
      ? input
          .split(/\n\s*\n/)
          .filter((p) => p.trim()).length
      : 0;

    return [
      { label: "字符数", value: chars },
      { label: "字符数（不含空格）", value: charsNoSpace },
      { label: "单词数", value: words },
      { label: "行数", value: lines },
      { label: "字节数", value: bytes },
      { label: "段落数", value: paragraphs },
    ];
  }, [input]);

  return (
    <div className="space-y-4">
      <textarea
        className={TEXTAREA_CLASS}
        rows={8}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="输入要统计的文本"
        spellCheck={false}
      />
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-lg border bg-card p-3 text-center"
            >
              <div className="text-2xl font-bold tabular-nums">{s.value.toLocaleString()}</div>
              <div className="mt-1 text-xs text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main ──

export function TextTool() {
  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-6">
      <h2 className="text-2xl font-bold tracking-tight">文本处理</h2>
      <Tabs defaultValue="case" className="min-h-0 flex-1">
        <TabsList>
          <TabsTrigger value="case">大小写转换</TabsTrigger>
          <TabsTrigger value="dedup">去重排序</TabsTrigger>
          <TabsTrigger value="encode">编码转义</TabsTrigger>
          <TabsTrigger value="stats">统计</TabsTrigger>
        </TabsList>
        <TabsContent value="case" className="mt-4 overflow-y-auto">
          <CaseTab />
        </TabsContent>
        <TabsContent value="dedup" className="mt-4 overflow-y-auto">
          <DedupSortTab />
        </TabsContent>
        <TabsContent value="encode" className="mt-4 overflow-y-auto">
          <EncodeEscapeTab />
        </TabsContent>
        <TabsContent value="stats" className="mt-4 overflow-y-auto">
          <StatsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

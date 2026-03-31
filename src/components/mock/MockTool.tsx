import { useState, useCallback } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TEXTAREA_CLASS =
  "block w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 font-mono text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^https?:\/\//;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})/;

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

// ── Schema inference ──

function inferSchema(value: unknown): object {
  if (value === null) return { type: "null" };

  if (typeof value === "boolean") return { type: "boolean" };

  if (typeof value === "number") {
    return Number.isInteger(value) ? { type: "integer" } : { type: "number" };
  }

  if (typeof value === "string") {
    const schema: Record<string, string> = { type: "string" };
    if (ISO_DATE_RE.test(value)) schema.format = "date-time";
    else if (EMAIL_RE.test(value)) schema.format = "email";
    else if (URL_RE.test(value)) schema.format = "uri";
    return schema;
  }

  if (Array.isArray(value)) {
    return {
      type: "array",
      items: value.length > 0 ? inferSchema(value[0]) : {},
    };
  }

  if (typeof value === "object") {
    const properties: Record<string, object> = {};
    const required: string[] = [];
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      properties[k] = inferSchema(v);
      required.push(k);
    }
    return { type: "object", properties, required };
  }

  return {};
}

// ── Mock generation ──

const SYLLABLES = [
  "al", "ba", "ce", "da", "el", "fi", "go", "hi", "in", "jo",
  "ka", "la", "mi", "no", "op", "pa", "qu", "re", "si", "to",
];

let _counter = 0;

function nextId() {
  return ++_counter;
}

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randReadableString() {
  const len = randInt(2, 3);
  let s = "";
  for (let i = 0; i < len; i++) s += SYLLABLES[randInt(0, SYLLABLES.length - 1)];
  return `${s}_${nextId()}`;
}

function generateMock(schema: Record<string, unknown>): unknown {
  const type = schema.type as string | undefined;
  const format = schema.format as string | undefined;

  switch (type) {
    case "string": {
      if (format === "date-time") {
        const d = new Date(
          Date.now() - randInt(0, 365 * 24 * 60 * 60 * 1000),
        );
        return d.toISOString();
      }
      if (format === "email") return `user${nextId()}@example.com`;
      if (format === "uri") return `https://example.com/path/${nextId()}`;
      return randReadableString();
    }
    case "integer":
      return randInt(1, 1000);
    case "number":
      return Math.round(Math.random() * 1000 * 100) / 100;
    case "boolean":
      return Math.random() < 0.5;
    case "null":
      return null;
    case "array": {
      const items = (schema.items ?? {}) as Record<string, unknown>;
      const count = randInt(1, 3);
      return Array.from({ length: count }, () => generateMock(items));
    }
    case "object": {
      const properties = (schema.properties ?? {}) as Record<string, Record<string, unknown>>;
      const obj: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(properties)) {
        obj[k] = generateMock(v);
      }
      return obj;
    }
    default:
      return null;
  }
}

// ── Tab: JSON → Schema ──

function JsonToSchemaTab() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleInfer = useCallback(() => {
    try {
      const parsed = JSON.parse(input);
      const schema = inferSchema(parsed);
      setOutput(JSON.stringify(schema, null, 2));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "JSON 解析失败");
      setOutput("");
    }
  }, [input]);

  return (
    <div className="space-y-4">
      <textarea
        className={TEXTAREA_CLASS}
        rows={8}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder='粘贴 JSON 样本数据，例如 {"name": "Alice", "age": 30}'
        spellCheck={false}
      />
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={handleInfer}>
          推断 Schema
        </Button>
      </div>
      {error && <Badge variant="destructive" className="w-fit">{error}</Badge>}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Schema 结果</span>
        <CopyButton text={output} />
      </div>
      <textarea
        className={TEXTAREA_CLASS}
        rows={10}
        value={output}
        readOnly
        placeholder="推断出的 JSON Schema"
        spellCheck={false}
      />
    </div>
  );
}

// ── Tab: Schema → Mock ──

function SchemaToMockTab() {
  const [input, setInput] = useState("");
  const [count, setCount] = useState(1);
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = useCallback(() => {
    try {
      const schema = JSON.parse(input) as Record<string, unknown>;
      const results =
        count === 1
          ? generateMock(schema)
          : Array.from({ length: count }, () => generateMock(schema));
      setOutput(JSON.stringify(results, null, 2));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Schema 解析失败");
      setOutput("");
    }
  }, [input, count]);

  return (
    <div className="space-y-4">
      <textarea
        className={TEXTAREA_CLASS}
        rows={8}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder='粘贴 JSON Schema，例如 {"type": "object", "properties": {"name": {"type": "string"}}}'
        spellCheck={false}
      />
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={handleGenerate}>
          生成 Mock
        </Button>
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
          数量
          <input
            type="number"
            min={1}
            max={100}
            value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
            className="h-7 w-16 rounded-md border border-input bg-transparent px-2 text-center text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </label>
      </div>
      {error && <Badge variant="destructive" className="w-fit">{error}</Badge>}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Mock 数据</span>
        <CopyButton text={output} />
      </div>
      <textarea
        className={TEXTAREA_CLASS}
        rows={10}
        value={output}
        readOnly
        placeholder="生成的 Mock 数据"
        spellCheck={false}
      />
    </div>
  );
}

// ── Tab: 快速 Mock ──

function QuickMockTab() {
  const [input, setInput] = useState("");
  const [count, setCount] = useState(1);
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = useCallback(() => {
    try {
      const parsed = JSON.parse(input);
      const schema = inferSchema(parsed) as Record<string, unknown>;
      const results =
        count === 1
          ? generateMock(schema)
          : Array.from({ length: count }, () => generateMock(schema));
      setOutput(JSON.stringify(results, null, 2));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "JSON 解析失败");
      setOutput("");
    }
  }, [input, count]);

  return (
    <div className="space-y-4">
      <textarea
        className={TEXTAREA_CLASS}
        rows={8}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder='粘贴一条 JSON 样本数据，自动推断 Schema 并生成 Mock'
        spellCheck={false}
      />
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={handleGenerate}>
          生成
        </Button>
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
          数量
          <input
            type="number"
            min={1}
            max={100}
            value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
            className="h-7 w-16 rounded-md border border-input bg-transparent px-2 text-center text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </label>
      </div>
      {error && <Badge variant="destructive" className="w-fit">{error}</Badge>}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Mock 数据</span>
        <CopyButton text={output} />
      </div>
      <textarea
        className={TEXTAREA_CLASS}
        rows={10}
        value={output}
        readOnly
        placeholder="生成的 Mock 数据"
        spellCheck={false}
      />
    </div>
  );
}

// ── Main ──

export function MockTool() {
  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-6">
      <h2 className="text-2xl font-bold tracking-tight">Mock 数据生成</h2>
      <Tabs defaultValue="quick" className="min-h-0 flex-1">
        <TabsList>
          <TabsTrigger value="json-to-schema">JSON → Schema</TabsTrigger>
          <TabsTrigger value="schema-to-mock">Schema → Mock</TabsTrigger>
          <TabsTrigger value="quick">快速 Mock</TabsTrigger>
        </TabsList>
        <TabsContent value="json-to-schema" className="mt-4 overflow-y-auto">
          <JsonToSchemaTab />
        </TabsContent>
        <TabsContent value="schema-to-mock" className="mt-4 overflow-y-auto">
          <SchemaToMockTab />
        </TabsContent>
        <TabsContent value="quick" className="mt-4 overflow-y-auto">
          <QuickMockTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

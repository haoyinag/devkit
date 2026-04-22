import { useState, useCallback, useRef, useEffect } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OpenApiMockTab } from "@/components/mock/OpenApiMockTab";
import { SwaggerMarkdownMockTab } from "@/components/mock/SwaggerMarkdownMockTab";
import { inferSchema, generateMock } from "@/lib/json-mock-infer";
import { looksLikeSwaggerTsvTable, parseSwaggerTsvTable } from "@/lib/swagger-table-tsv";

const TEXTAREA_CLASS =
  "block w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 font-mono text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

function useCopy() {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timerRef.current), []);
  const copy = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 1200);
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

// ── Tab: JSON / 表格 → Schema ──

function JsonToSchemaTab() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [tableWarnings, setTableWarnings] = useState<string[]>([]);
  const [lastSchemaObj, setLastSchemaObj] = useState<Record<string, unknown> | null>(null);
  const [mockCount, setMockCount] = useState(1);
  const [mockOut, setMockOut] = useState("");
  const [mockErr, setMockErr] = useState<string | null>(null);

  const handleInfer = useCallback(() => {
    setTableWarnings([]);
    setMockErr(null);
    setMockOut("");
    const raw = input.trim();
    if (!raw) {
      setError("请先粘贴内容");
      setOutput("");
      setLastSchemaObj(null);
      return;
    }

    if (raw.startsWith("{") || raw.startsWith("[")) {
      try {
        const parsed = JSON.parse(raw);
        const schema = inferSchema(parsed) as Record<string, unknown>;
        setLastSchemaObj(schema);
        setOutput(JSON.stringify(schema, null, 2));
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "JSON 解析失败");
        setOutput("");
        setLastSchemaObj(null);
      }
      return;
    }

    const tsv = parseSwaggerTsvTable(raw);
    if (tsv) {
      setLastSchemaObj(tsv.schema as Record<string, unknown>);
      setOutput(JSON.stringify(tsv.schema, null, 2));
      setTableWarnings(tsv.warnings);
      setError(null);
      return;
    }

    if (looksLikeSwaggerTsvTable(raw)) {
      setError("内容像表格但未解析出任何字段：请确认列之间为制表符（Tab），且最后一列为类型（如 integer(int64)）。");
    } else {
      setError("无法识别：请以 { 或 [ 开头的 JSON 样本，或粘贴 Knife4j / Swagger 的制表符表格（字段名、说明、类型）。");
    }
    setOutput("");
    setLastSchemaObj(null);
  }, [input]);

  const handleMockFromSchema = useCallback(() => {
    setMockErr(null);
    setMockOut("");
    if (!lastSchemaObj) {
      setMockErr("请先成功推断 Schema");
      return;
    }
    try {
      const n = Math.max(1, Math.min(100, mockCount));
      const results =
        n === 1
          ? generateMock(lastSchemaObj)
          : Array.from({ length: n }, () => generateMock(lastSchemaObj));
      setMockOut(JSON.stringify(results, null, 2));
    } catch (e) {
      setMockErr(e instanceof Error ? e.message : "生成失败");
    }
  }, [lastSchemaObj, mockCount]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        支持两种输入：<strong>JSON 样本</strong>（推断类型）；或从文档页复制的{" "}
        <strong>制表符表格</strong>（字段名、中文说明、<code className="rounded bg-muted px-1">integer(int64)</code>{" "}
        等，列之间为 Tab）。
      </p>
      <textarea
        className={TEXTAREA_CLASS}
        rows={10}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={`JSON 示例：{"recordId": 1, "recordType": "x"}\n\n或粘贴表格行，例如：\nrecordId\t记录id\tinteger(int64)`}
        spellCheck={false}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={handleInfer}>
          推断 Schema
        </Button>
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
          Mock 条数
          <input
            type="number"
            min={1}
            max={100}
            value={mockCount}
            onChange={(e) => setMockCount(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
            className="h-7 w-16 rounded-md border border-input bg-transparent px-2 text-center text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </label>
        <Button size="sm" variant="secondary" onClick={handleMockFromSchema} disabled={!lastSchemaObj}>
          从当前 Schema 生成 Mock
        </Button>
      </div>
      {error && <Badge variant="destructive" className="w-fit whitespace-pre-wrap">{error}</Badge>}
      {tableWarnings.length > 0 && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
          <div className="font-medium">表格解析提示</div>
          <ul className="mt-1 list-inside list-disc">
            {tableWarnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}
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
      {mockErr && <Badge variant="destructive" className="w-fit">{mockErr}</Badge>}
      {mockOut && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Mock 预览</span>
            <CopyButton text={mockOut} />
          </div>
          <textarea className={TEXTAREA_CLASS} rows={8} readOnly value={mockOut} spellCheck={false} />
        </div>
      )}
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
      <Tabs defaultValue="openapi" className="min-h-0 flex-1">
        <TabsList className="flex-wrap gap-1">
          <TabsTrigger value="openapi">OpenAPI</TabsTrigger>
          <TabsTrigger value="swagger-md">Swagger 文档</TabsTrigger>
          <TabsTrigger value="json-to-schema">JSON / 表格 → Schema</TabsTrigger>
          <TabsTrigger value="schema-to-mock">Schema → Mock</TabsTrigger>
          <TabsTrigger value="quick">快速 Mock</TabsTrigger>
        </TabsList>
        <TabsContent value="openapi" className="mt-4 overflow-y-auto">
          <OpenApiMockTab />
        </TabsContent>
        <TabsContent value="swagger-md" className="mt-4 overflow-y-auto">
          <SwaggerMarkdownMockTab />
        </TabsContent>
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

import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { buildMswSnippet, type HttpMethod } from "@/lib/openapi-mock";
import { generateMock, listSchemaArrayPaths } from "@/lib/json-mock-infer";
import {
  buildMockSchemaFromParsed,
  parseSwaggerMarkdownDoc,
  type SwaggerMdJsonBlock,
} from "@/lib/swagger-doc-markdown";

const TEXTAREA_CLASS =
  "block w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 font-mono text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

const INPUT_CLASS =
  "w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

function useCopy() {
  const [copied, setCopied] = useState(false);
  const copy = useCallback((text: string) => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  }, []);
  return { copied, copy };
}

function CopyBtn({ text, label }: { text: string; label: string }) {
  const { copied, copy } = useCopy();
  return (
    <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={() => copy(text)} disabled={!text}>
      {copied ? "已复制" : label}
    </Button>
  );
}

function blockSummary(b: SwaggerMdJsonBlock, idx: number): string {
  const kind = b.kind === "request" ? "请求" : b.kind === "response" ? "响应" : "未标注";
  const preview = JSON.stringify(b.parsed).slice(0, 72);
  return `#${idx + 1} ${kind} · ${preview}${preview.length >= 72 ? "…" : ""}`;
}

export function SwaggerMarkdownMockTab() {
  const [doc, setDoc] = useState("");
  const [target, setTarget] = useState<"response" | "request">("response");
  const [useTable, setUseTable] = useState(true);
  const [count, setCount] = useState(1);
  const [arrayItemCount, setArrayItemCount] = useState(2);
  const [arrayDepthLimit, setArrayDepthLimit] = useState(6);
  const [mswBase, setMswBase] = useState("**");
  const [outJson, setOutJson] = useState("");
  const [outMsw, setOutMsw] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const parsed = useMemo(() => {
    if (!doc.trim()) return null;
    return parseSwaggerMarkdownDoc(doc);
  }, [doc]);

  const schemaPreview = useMemo(() => {
    if (!parsed) return null;
    return buildMockSchemaFromParsed(parsed, target, useTable);
  }, [parsed, target, useTable]);

  const arrayPaths = useMemo(() => {
    if (!schemaPreview) return [];
    return listSchemaArrayPaths(schemaPreview, arrayDepthLimit);
  }, [schemaPreview, arrayDepthLimit]);

  const handleGenerate = useCallback(() => {
    setErr(null);
    setOutJson("");
    setOutMsw("");
    if (!doc.trim()) {
      setErr("请先粘贴 Swagger / Knife4j「复制文档」Markdown");
      return;
    }
    const p = parseSwaggerMarkdownDoc(doc);
    const schema = buildMockSchemaFromParsed(p, target, useTable);
    const n = Math.max(1, Math.min(50, count));
    const arrayOptions = {
      arrayLength: Math.max(1, Math.min(100, arrayItemCount)),
      arrayDepthLimit: Math.max(0, Math.min(12, arrayDepthLimit)),
    };
    try {
      const parts: unknown[] = [];
      for (let i = 0; i < n; i++) {
        parts.push(generateMock(schema, arrayOptions));
      }
      const payload = n === 1 ? parts[0] : parts;
      setOutJson(JSON.stringify(payload, null, 2));

      const method = (p.method ?? "post").toLowerCase() as HttpMethod;
      const path = p.path ?? "/unknown";
      const pattern = `${mswBase.replace(/\/$/, "")}${path.startsWith("/") ? "" : "/"}${path}`;
      setOutMsw(buildMswSnippet({ method, urlPattern: pattern, bodyObject: parts[0] }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }, [doc, target, useTable, count, arrayItemCount, arrayDepthLimit, mswBase]);

  return (
    <div className="space-y-4">
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>
          从{" "}
          <span className="font-medium text-foreground">Knife4j / Swagger UI「复制文档」</span>{" "}
          得到的 Markdown 可直接粘贴到下方。工具会识别{" "}
          <code className="rounded bg-muted px-1">接口地址</code>、
          <code className="rounded bg-muted px-1">请求方式</code>，在「请求示例 / 响应示例」标题下提取 JSON，并可选用「响应参数」表格增强类型（如{" "}
          <code className="rounded bg-muted px-1">integer(int64)</code>）。
        </p>
        <p>
          <span className="font-medium text-foreground">使用示例</span>：粘贴整段接口文档 → 选择「响应」或「请求」→ 勾选是否合并响应参数表 →
          设置顶层条数和数组条数 → 点「生成 Mock」。JSON 可拷到 MSW / 本地 mock；MSW 片段中的路径来自解析出的接口地址，可按需改前缀。
        </p>
        <p>
          <span className="font-medium text-foreground">局限</span>：无法替代完整 OpenAPI；嵌套层级过深的表格可能解析不全；未出现「响应示例」时，会尝试使用文档中其它 JSON
          代码块。
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Swagger 文档（Markdown）</label>
        <textarea
          className={TEXTAREA_CLASS}
          rows={10}
          value={doc}
          onChange={(e) => setDoc(e.target.value)}
          placeholder="粘贴从接口文档复制的 Markdown…"
          spellCheck={false}
        />
      </div>

      {parsed && (
        <div className="rounded-lg border border-border p-3 space-y-2 text-sm">
          <div className="flex flex-wrap gap-2">
            {parsed.title && (
              <Badge variant="outline" className="font-normal">
                {parsed.title}
              </Badge>
            )}
            {parsed.method && (
              <Badge variant="secondary" className="font-mono">
                {parsed.method.toUpperCase()}
              </Badge>
            )}
            {parsed.path && (
              <Badge variant="outline" className="max-w-full truncate font-mono">
                {parsed.path}
              </Badge>
            )}
          </div>
          {parsed.jsonBlocks.length > 0 && (
            <div className="text-xs text-muted-foreground space-y-0.5">
              <span className="font-medium text-foreground">识别到的 JSON 块</span>
              <ul className="list-disc pl-4">
                {parsed.jsonBlocks.map((b, i) => (
                  <li key={i}>{blockSummary(b, i)}</li>
                ))}
              </ul>
            </div>
          )}
          {parsed.warnings.map((w, i) => (
            <Badge key={i} variant="secondary" className="mr-1 font-normal whitespace-pre-wrap">
              {w}
            </Badge>
          ))}
        </div>
      )}

      {schemaPreview && (
        <div className="rounded-lg border border-border p-3 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">数组生成策略</span>
          <span className="ml-2">
            深度 {arrayDepthLimit} 层内的数组固定生成 {arrayItemCount} 条
          </span>
          {arrayPaths.length > 0 ? (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {arrayPaths.map((path) => (
                <Badge key={path} variant="outline" className="font-mono font-normal">
                  {path}
                </Badge>
              ))}
            </div>
          ) : (
            <div className="mt-1">当前选择的示例中未检测到数组，或数组位于检测层级之外。</div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5 text-sm">
          <span className="text-muted-foreground">示例来源</span>
          <select
            className={INPUT_CLASS + " max-w-[12rem]"}
            value={target}
            onChange={(e) => setTarget(e.target.value as "response" | "request")}
          >
            <option value="response">响应示例</option>
            <option value="request">请求示例</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={useTable}
            onChange={(e) => setUseTable(e.target.checked)}
            className="rounded border-input"
          />
          合并「响应参数」表格类型（仅响应）
        </label>
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
          顶层条数
          <input
            type="number"
            min={1}
            max={50}
            value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
            className="h-7 w-14 rounded-md border border-input bg-transparent px-2 text-center text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </label>
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
          数组条数
          <input
            type="number"
            min={1}
            max={100}
            value={arrayItemCount}
            onChange={(e) => setArrayItemCount(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
            className="h-7 w-16 rounded-md border border-input bg-transparent px-2 text-center text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </label>
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
          数组检测层级
          <input
            type="number"
            min={0}
            max={12}
            value={arrayDepthLimit}
            onChange={(e) => setArrayDepthLimit(Math.max(0, Math.min(12, Number(e.target.value) || 0)))}
            className="h-7 w-14 rounded-md border border-input bg-transparent px-2 text-center text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </label>
        <label className="flex flex-1 min-w-[8rem] items-center gap-2 text-sm text-muted-foreground">
          MSW 前缀
          <input
            className={INPUT_CLASS}
            value={mswBase}
            onChange={(e) => setMswBase(e.target.value)}
            placeholder="**"
            spellCheck={false}
          />
        </label>
        <Button size="sm" onClick={handleGenerate} disabled={!doc.trim()}>
          生成 Mock
        </Button>
      </div>

      {err && <Badge variant="destructive" className="w-fit whitespace-pre-wrap">{err}</Badge>}

      {outJson && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">JSON</span>
            <CopyBtn text={outJson} label="复制 JSON" />
          </div>
          <textarea className={TEXTAREA_CLASS} rows={12} readOnly value={outJson} spellCheck={false} />
        </div>
      )}

      {outMsw && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">MSW 片段（首条数据）</span>
            <CopyBtn text={outMsw} label="复制 MSW" />
          </div>
          <textarea className={TEXTAREA_CLASS} rows={14} readOnly value={outMsw} spellCheck={false} />
        </div>
      )}
    </div>
  );
}

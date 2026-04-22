import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  buildMswSnippet,
  dereferenceSpec,
  detectSpecKind,
  formatOperationLabel,
  generateResponseMock,
  getResponseBodyInfo,
  isProbablyHtml,
  listJsonMediaTypes,
  listOperations,
  listResponseStatusKeys,
  parseOpenApiDocument,
  type HttpMethod,
} from "@/lib/openapi-mock";

const TEXTAREA_CLASS =
  "block w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 font-mono text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

const INPUT_CLASS =
  "w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

function parseHeaderLines(text: string): [string, string][] {
  const out: [string, string][] = [];
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf(":");
    if (i <= 0) continue;
    const name = t.slice(0, i).trim();
    const value = t.slice(i + 1).trim();
    if (name) out.push([name, value]);
  }
  return out;
}

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

interface HttpFetchResult {
  status: number;
  final_url: string;
  content_type: string | null;
  body: string;
}

async function fetchSpecRemote(url: string, headerText: string): Promise<HttpFetchResult> {
  const headers = parseHeaderLines(headerText);
  if (isTauri()) {
    return invoke<HttpFetchResult>("http_fetch_get", { url: url.trim(), headers });
  }
  const h = new Headers();
  for (const [k, v] of headers) {
    h.set(k, v);
  }
  const r = await fetch(url.trim(), { headers: h, mode: "cors" });
  const body = await r.text();
  return {
    status: r.status,
    final_url: r.url,
    content_type: r.headers.get("content-type"),
    body,
  };
}

function pickDefaultStatus(keys: string[]): string {
  const ok = keys.find((k) => k.startsWith("2"));
  return ok ?? keys[0] ?? "200";
}

export function OpenApiMockTab() {
  const [docUrl, setDocUrl] = useState("");
  const [headerText, setHeaderText] = useState("");
  const [specText, setSpecText] = useState("");
  const [fetchLoading, setFetchLoading] = useState(false);
  const [fetchErr, setFetchErr] = useState<string | null>(null);

  const [workingSpec, setWorkingSpec] = useState<unknown>(null);
  const [derefBusy, setDerefBusy] = useState(false);
  const [derefErr, setDerefErr] = useState<string | null>(null);
  const [parseErr, setParseErr] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [selPath, setSelPath] = useState("");
  const [selMethod, setSelMethod] = useState<HttpMethod>("get");
  const [selStatus, setSelStatus] = useState("200");
  const [selMedia, setSelMedia] = useState("application/json");

  const [preferExample, setPreferExample] = useState(true);
  const [count, setCount] = useState(1);
  const [mswBase, setMswBase] = useState("**");

  const [outJson, setOutJson] = useState("");
  const [outMsw, setOutMsw] = useState("");
  const [genErr, setGenErr] = useState<string | null>(null);
  const [genBusy, setGenBusy] = useState(false);

  const specKind = useMemo(() => detectSpecKind(workingSpec), [workingSpec]);

  const operations = useMemo(() => listOperations(workingSpec), [workingSpec]);

  const filteredOps = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return operations;
    return operations.filter((op) => {
      const hay = `${op.path} ${op.method} ${op.operationId ?? ""} ${op.summary ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [operations, search]);

  const statusKeys = useMemo(
    () => (selPath ? listResponseStatusKeys(workingSpec, selPath, selMethod) : []),
    [workingSpec, selPath, selMethod],
  );

  const mediaTypes = useMemo(
    () => (selPath && selStatus ? listJsonMediaTypes(workingSpec, selPath, selMethod, selStatus) : []),
    [workingSpec, selPath, selMethod, selStatus],
  );

  useEffect(() => {
    if (filteredOps.length === 0) return;
    const still = filteredOps.some((o) => o.path === selPath && o.method === selMethod);
    if (!selPath || !still) {
      const first = filteredOps[0];
      setSelPath(first.path);
      setSelMethod(first.method);
    }
  }, [filteredOps, selPath, selMethod]);

  useEffect(() => {
    if (!selPath) return;
    const keys = listResponseStatusKeys(workingSpec, selPath, selMethod);
    if (keys.length === 0) return;
    if (!keys.includes(selStatus)) {
      setSelStatus(pickDefaultStatus(keys));
    }
  }, [workingSpec, selPath, selMethod, selStatus]);

  useEffect(() => {
    if (!selPath || !selStatus) return;
    const mts = listJsonMediaTypes(workingSpec, selPath, selMethod, selStatus);
    if (mts.length === 0) return;
    if (!mts.includes(selMedia)) {
      setSelMedia(mts[0]);
    }
  }, [workingSpec, selPath, selMethod, selStatus, selMedia]);

  const loadFromText = useCallback(async (raw: string) => {
    setParseErr(null);
    setDerefErr(null);
    setWorkingSpec(null);
    setOutJson("");
    setOutMsw("");
    setGenErr(null);
    try {
      const parsed = parseOpenApiDocument(raw);
      setDerefBusy(true);
      try {
        const deref = await dereferenceSpec(parsed);
        setWorkingSpec(deref);
      } catch (e) {
        setDerefErr(e instanceof Error ? e.message : String(e));
        setWorkingSpec(parsed);
      } finally {
        setDerefBusy(false);
      }
    } catch (e) {
      setParseErr(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const handleFetch = useCallback(async () => {
    setFetchErr(null);
    setFetchLoading(true);
    try {
      const r = await fetchSpecRemote(docUrl, headerText);
      if (r.status >= 400) {
        setFetchErr(`HTTP ${r.status}，请检查 URL 或鉴权请求头`);
      }
      if (isProbablyHtml(r.body, r.content_type)) {
        setFetchErr(
          "返回内容疑似 HTML（多为 Swagger UI 页面）。请改用 raw OpenAPI 地址，例如 /v3/api-docs、/openapi.json，或导出 YAML/JSON 后粘贴到下方。",
        );
        setSpecText(r.body.slice(0, 8000));
        return;
      }
      setSpecText(r.body);
      await loadFromText(r.body);
    } catch (e) {
      setFetchErr(e instanceof Error ? e.message : String(e));
    } finally {
      setFetchLoading(false);
    }
  }, [docUrl, headerText, loadFromText]);

  const handleParsePasted = useCallback(async () => {
    setSpecText(specText);
    await loadFromText(specText);
  }, [specText, loadFromText]);

  const handleGenerate = useCallback(async () => {
    if (!workingSpec || !selPath) {
      setGenErr("请先加载文档并选择接口");
      return;
    }
    setGenBusy(true);
    setGenErr(null);
    try {
      const kind = detectSpecKind(workingSpec);
      const media =
        kind === "swagger2" ? "application/json" : selMedia || mediaTypes[0] || "application/json";
      const { schema, example } = getResponseBodyInfo(workingSpec, selPath, selMethod, selStatus, media);
      const n = Math.max(1, Math.min(50, count));
      const parts: unknown[] = [];
      for (let i = 0; i < n; i++) {
        parts.push(
          await generateResponseMock({
            schema,
            example,
            preferExample: preferExample && i === 0,
          }),
        );
      }
      const payload = n === 1 ? parts[0] : parts;
      setOutJson(JSON.stringify(payload, null, 2));

      const single = n === 1 ? parts[0] : parts;
      const pattern = `${mswBase.replace(/\/$/, "")}${selPath.startsWith("/") ? "" : "/"}${selPath}`;
      setOutMsw(buildMswSnippet({ method: selMethod, urlPattern: pattern, bodyObject: single }));
    } catch (e) {
      setGenErr(e instanceof Error ? e.message : String(e));
      setOutJson("");
      setOutMsw("");
    } finally {
      setGenBusy(false);
    }
  }, [
    workingSpec,
    selPath,
    selMethod,
    selStatus,
    selMedia,
    mediaTypes,
    preferExample,
    count,
    mswBase,
  ]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        在桌面版（Tauri）下可通过本机请求拉取内网 Swagger，避免浏览器 CORS。解析后使用{" "}
        <code className="rounded bg-muted px-1">json-schema-faker</code> 按 Schema 生成数据，并尽量使用文档中的{" "}
        <code className="rounded bg-muted px-1">example</code>。
      </p>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium">文档 URL</label>
          <input
            className={INPUT_CLASS}
            value={docUrl}
            onChange={(e) => setDocUrl(e.target.value)}
            placeholder="https://api.example.com/v3/api-docs"
            spellCheck={false}
          />
          <Button size="sm" onClick={() => void handleFetch()} disabled={fetchLoading || !docUrl.trim()}>
            {fetchLoading ? "拉取中…" : "拉取并解析"}
          </Button>
          {!isTauri() && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              当前为浏览器预览模式，跨域请求可能失败；请使用桌面应用或改为粘贴文档。
            </p>
          )}
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">请求头（可选，每行 Name: Value）</label>
          <textarea
            className={TEXTAREA_CLASS}
            rows={4}
            value={headerText}
            onChange={(e) => setHeaderText(e.target.value)}
            placeholder={"Authorization: Bearer <token>\nX-Custom: value"}
            spellCheck={false}
          />
        </div>
      </div>

      {fetchErr && <Badge variant="destructive" className="w-fit whitespace-pre-wrap">{fetchErr}</Badge>}

      <div className="space-y-2">
        <label className="text-sm font-medium">OpenAPI / Swagger 原文（YAML 或 JSON）</label>
        <textarea
          className={TEXTAREA_CLASS}
          rows={6}
          value={specText}
          onChange={(e) => setSpecText(e.target.value)}
          placeholder="粘贴 YAML/JSON，或先输入 URL 拉取"
          spellCheck={false}
        />
        <Button size="sm" variant="secondary" onClick={() => void handleParsePasted()} disabled={!specText.trim()}>
          仅解析当前文本
        </Button>
      </div>

      {parseErr && <Badge variant="destructive" className="w-fit">{parseErr}</Badge>}
      {derefErr && (
        <Badge variant="secondary" className="w-fit whitespace-pre-wrap">
          $ref 展开失败，已退回未展开文档：{derefErr}
        </Badge>
      )}
      {derefBusy && <span className="text-sm text-muted-foreground">正在展开 $ref…</span>}

      {workingSpec !== null && typeof workingSpec === "object" ? (
        <div className="rounded-lg border border-border p-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">格式</span>
            <Badge variant="outline">{specKind}</Badge>
            <span className="text-muted-foreground">共 {operations.length} 个 operation</span>
          </div>

          <input
            className={INPUT_CLASS}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="筛选 path / method / operationId / summary"
            spellCheck={false}
          />

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">接口</label>
              <select
                className={INPUT_CLASS}
                value={filteredOps.some((o) => o.path === selPath && o.method === selMethod) ? `${selMethod}\t${selPath}` : ""}
                onChange={(e) => {
                  const v = e.target.value;
                  const [method, path] = v.split("\t") as [HttpMethod, string];
                  setSelMethod(method);
                  setSelPath(path);
                }}
              >
                {filteredOps.length === 0 && <option value="">无匹配</option>}
                {filteredOps.map((op) => (
                  <option key={`${op.method}:${op.path}`} value={`${op.method}\t${op.path}`}>
                    {formatOperationLabel(op)}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">响应码</label>
                <select
                  className={INPUT_CLASS}
                  value={statusKeys.includes(selStatus) ? selStatus : statusKeys[0] ?? ""}
                  onChange={(e) => setSelStatus(e.target.value)}
                  disabled={statusKeys.length === 0}
                >
                  {statusKeys.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Content-Type</label>
                <select
                  className={INPUT_CLASS}
                  value={mediaTypes.includes(selMedia) ? selMedia : mediaTypes[0] ?? ""}
                  onChange={(e) => setSelMedia(e.target.value)}
                  disabled={mediaTypes.length === 0}
                >
                  {mediaTypes.length === 0 ? (
                    <option value="">无 JSON schema</option>
                  ) : (
                    mediaTypes.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={preferExample}
              onChange={(e) => setPreferExample(e.target.checked)}
              className="rounded border-input"
            />
            首条优先使用文档 example（若存在）
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
              条数
              <input
                type="number"
                min={1}
                max={50}
                value={count}
                onChange={(e) => setCount(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
                className="h-7 w-14 rounded-md border border-input bg-transparent px-2 text-center text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </label>
            <label className="flex flex-1 min-w-[8rem] items-center gap-2 text-sm text-muted-foreground">
              MSW 路径前缀
              <input
                className={INPUT_CLASS}
                value={mswBase}
                onChange={(e) => setMswBase(e.target.value)}
                placeholder="**"
                spellCheck={false}
              />
            </label>
            <Button size="sm" onClick={() => void handleGenerate()} disabled={genBusy || !selPath}>
              {genBusy ? "生成中…" : "生成 Mock"}
            </Button>
          </div>
        </div>
      ) : null}

      {genErr && <Badge variant="destructive" className="w-fit whitespace-pre-wrap">{genErr}</Badge>}

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
            <span className="text-sm font-medium">MSW 片段</span>
            <CopyBtn text={outMsw} label="复制 MSW" />
          </div>
          <textarea className={TEXTAREA_CLASS} rows={14} readOnly value={outMsw} spellCheck={false} />
        </div>
      )}
    </div>
  );
}

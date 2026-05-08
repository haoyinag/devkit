<script lang="ts">
  import { invoke, isTauri } from "@tauri-apps/api/core";
  import { buildMockSchemaFromParsed, parseSwaggerMarkdownDoc } from "@/lib/swagger-doc-markdown";
  import { looksLikeSwaggerTsvTable, parseSwaggerTsvTable } from "@/lib/swagger-table-tsv";
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
  import { generateMock, inferSchema, listSchemaArrayPaths } from "@/lib/json-mock-infer";

  type Tab = "openapi" | "swagger-md" | "json-to-schema" | "schema-to-mock" | "quick";
  const tabs: { id: Tab; label: string }[] = [
    { id: "openapi", label: "OpenAPI" },
    { id: "swagger-md", label: "Swagger 文档" },
    { id: "json-to-schema", label: "JSON / 表格 → Schema" },
    { id: "schema-to-mock", label: "Schema → Mock" },
    { id: "quick", label: "快速 Mock" },
  ];
  let activeTab = $state<Tab>("openapi");
  let copied = $state("");

  // shared helpers
  const copyText = async (key: string, text: string) => {
    await navigator.clipboard.writeText(text);
    copied = key;
    setTimeout(() => {
      if (copied === key) copied = "";
    }, 1200);
  };
  const cap = (n: number, min: number, max: number) => Math.max(min, Math.min(max, Number.isFinite(n) ? Math.round(n) : min));

  // quick tab
  let quickInput = $state("");
  let quickCount = $state(1);
  let quickOut = $state("");
  let quickErr = $state("");
  const handleQuick = () => {
    try {
      const parsed = JSON.parse(quickInput);
      const schema = inferSchema(parsed) as Record<string, unknown>;
      const n = cap(quickCount, 1, 100);
      const data = n === 1 ? generateMock(schema) : Array.from({ length: n }, () => generateMock(schema));
      quickOut = JSON.stringify(data, null, 2);
      quickErr = "";
    } catch (error) {
      quickErr = error instanceof Error ? error.message : "JSON 解析失败";
      quickOut = "";
    }
  };

  // schema to mock tab
  let schemaInput = $state("");
  let schemaCount = $state(1);
  let schemaOut = $state("");
  let schemaErr = $state("");
  const handleSchemaToMock = () => {
    try {
      const schema = JSON.parse(schemaInput) as Record<string, unknown>;
      const n = cap(schemaCount, 1, 100);
      const data = n === 1 ? generateMock(schema) : Array.from({ length: n }, () => generateMock(schema));
      schemaOut = JSON.stringify(data, null, 2);
      schemaErr = "";
    } catch (error) {
      schemaErr = error instanceof Error ? error.message : "Schema 解析失败";
      schemaOut = "";
    }
  };

  // json/table to schema tab
  let jtInput = $state("");
  let jtSchemaOut = $state("");
  let jtMockOut = $state("");
  let jtErr = $state("");
  let jtMockErr = $state("");
  let jtWarnings = $state<string[]>([]);
  let jtCount = $state(1);
  let jtLastSchema: Record<string, unknown> | null = $state(null);

  const handleInferSchema = () => {
    const raw = jtInput.trim();
    jtWarnings = [];
    jtMockOut = "";
    jtMockErr = "";
    if (!raw) {
      jtErr = "请先粘贴内容";
      jtSchemaOut = "";
      jtLastSchema = null;
      return;
    }
    if (raw.startsWith("{") || raw.startsWith("[")) {
      try {
        const schema = inferSchema(JSON.parse(raw)) as Record<string, unknown>;
        jtLastSchema = schema;
        jtSchemaOut = JSON.stringify(schema, null, 2);
        jtErr = "";
      } catch (error) {
        jtErr = error instanceof Error ? error.message : "JSON 解析失败";
        jtSchemaOut = "";
        jtLastSchema = null;
      }
      return;
    }
    const tsv = parseSwaggerTsvTable(raw);
    if (tsv) {
      jtLastSchema = tsv.schema as Record<string, unknown>;
      jtSchemaOut = JSON.stringify(tsv.schema, null, 2);
      jtWarnings = tsv.warnings;
      jtErr = "";
      return;
    }
    jtLastSchema = null;
    jtSchemaOut = "";
    jtErr = looksLikeSwaggerTsvTable(raw)
      ? "内容像表格但未解析出字段，请确认列之间是 Tab 分隔。"
      : "无法识别输入，请提供 JSON 样本或 Swagger 表格。";
  };

  const handleMockFromCurrentSchema = () => {
    if (!jtLastSchema) {
      jtMockErr = "请先成功推断 Schema";
      jtMockOut = "";
      return;
    }
    try {
      const n = cap(jtCount, 1, 100);
      const data = n === 1 ? generateMock(jtLastSchema) : Array.from({ length: n }, () => generateMock(jtLastSchema));
      jtMockOut = JSON.stringify(data, null, 2);
      jtMockErr = "";
    } catch (error) {
      jtMockErr = error instanceof Error ? error.message : "生成失败";
      jtMockOut = "";
    }
  };

  // swagger markdown tab
  let swDoc = $state("");
  let swTarget = $state<"response" | "request">("response");
  let swUseTable = $state(true);
  let swCount = $state(1);
  let swArrayCount = $state(2);
  let swArrayDepth = $state(6);
  let swMswBase = $state("**");
  let swErr = $state("");
  let swOutJson = $state("");
  let swOutMsw = $state("");
  const swParsed = $derived(swDoc.trim() ? parseSwaggerMarkdownDoc(swDoc) : null);
  const swSchema = $derived(swParsed ? buildMockSchemaFromParsed(swParsed, swTarget, swUseTable) : null);
  const swArrayPaths = $derived(swSchema ? listSchemaArrayPaths(swSchema, swArrayDepth) : []);
  const handleSwaggerGenerate = () => {
    swErr = "";
    swOutJson = "";
    swOutMsw = "";
    if (!swDoc.trim()) {
      swErr = "请先粘贴 Swagger / Knife4j 复制文档 Markdown";
      return;
    }
    try {
      const parsed = parseSwaggerMarkdownDoc(swDoc);
      const schema = buildMockSchemaFromParsed(parsed, swTarget, swUseTable);
      const n = cap(swCount, 1, 50);
      const arrayLength = cap(swArrayCount, 1, 100);
      const arrayDepthLimit = cap(swArrayDepth, 0, 12);
      const items = Array.from({ length: n }, () => generateMock(schema, { arrayLength, arrayDepthLimit }));
      const payload = n === 1 ? items[0] : items;
      swOutJson = JSON.stringify(payload, null, 2);
      const method = ((parsed.method ?? "post").toLowerCase() as HttpMethod) || "post";
      const path = parsed.path ?? "/unknown";
      const pattern = `${swMswBase.replace(/\/$/, "")}${path.startsWith("/") ? "" : "/"}${path}`;
      swOutMsw = buildMswSnippet({ method, urlPattern: pattern, bodyObject: items[0] });
    } catch (error) {
      swErr = error instanceof Error ? error.message : "生成失败";
    }
  };

  // openapi tab
  interface HttpFetchResult {
    status: number;
    final_url: string;
    content_type: string | null;
    body: string;
  }

  const parseHeaderLines = (text: string): [string, string][] =>
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const i = line.indexOf(":");
        return i > 0 ? [line.slice(0, i).trim(), line.slice(i + 1).trim()] : ["", ""];
      })
      .filter((x): x is [string, string] => Boolean(x[0]));

  const fetchSpecRemote = async (url: string, headerText: string): Promise<HttpFetchResult> => {
    const headers = parseHeaderLines(headerText);
    if (isTauri()) return invoke<HttpFetchResult>("http_fetch_get", { url: url.trim(), headers });
    const h = new Headers();
    headers.forEach(([k, v]) => h.set(k, v));
    const r = await fetch(url.trim(), { headers: h, mode: "cors" });
    return {
      status: r.status,
      final_url: r.url,
      content_type: r.headers.get("content-type"),
      body: await r.text(),
    };
  };

  let oaDocUrl = $state("");
  let oaHeaderText = $state("");
  let oaSpecText = $state("");
  let oaFetchLoading = $state(false);
  let oaFetchErr = $state("");
  let oaWorkingSpec = $state<unknown>(null);
  let oaDerefBusy = $state(false);
  let oaDerefErr = $state("");
  let oaParseErr = $state("");
  let oaSearch = $state("");
  let oaSelPath = $state("");
  let oaSelMethod = $state<HttpMethod>("get");
  let oaSelStatus = $state("200");
  let oaSelMedia = $state("application/json");
  let oaPreferExample = $state(true);
  let oaCount = $state(1);
  let oaMswBase = $state("**");
  let oaOutJson = $state("");
  let oaOutMsw = $state("");
  let oaGenErr = $state("");
  let oaGenBusy = $state(false);

  const oaKind = $derived(detectSpecKind(oaWorkingSpec));
  const oaOperations = $derived(listOperations(oaWorkingSpec));
  const oaFilteredOps = $derived.by(() => {
    const q = oaSearch.trim().toLowerCase();
    if (!q) return oaOperations;
    return oaOperations.filter((op) => `${op.path} ${op.method} ${op.operationId ?? ""} ${op.summary ?? ""}`.toLowerCase().includes(q));
  });
  const oaStatusKeys = $derived(oaSelPath ? listResponseStatusKeys(oaWorkingSpec, oaSelPath, oaSelMethod) : []);
  const oaMediaTypes = $derived(oaSelPath && oaSelStatus ? listJsonMediaTypes(oaWorkingSpec, oaSelPath, oaSelMethod, oaSelStatus) : []);

  const loadFromText = async (raw: string) => {
    oaParseErr = "";
    oaDerefErr = "";
    oaWorkingSpec = null;
    oaOutJson = "";
    oaOutMsw = "";
    oaGenErr = "";
    try {
      const parsed = parseOpenApiDocument(raw);
      oaDerefBusy = true;
      try {
        oaWorkingSpec = await dereferenceSpec(parsed);
      } catch (error) {
        oaDerefErr = error instanceof Error ? error.message : String(error);
        oaWorkingSpec = parsed;
      } finally {
        oaDerefBusy = false;
      }
    } catch (error) {
      oaParseErr = error instanceof Error ? error.message : String(error);
    }
  };

  const handleOpenApiFetch = async () => {
    oaFetchLoading = true;
    oaFetchErr = "";
    try {
      const r = await fetchSpecRemote(oaDocUrl, oaHeaderText);
      if (r.status >= 400) oaFetchErr = `HTTP ${r.status}，请检查 URL 或鉴权请求头`;
      if (isProbablyHtml(r.body, r.content_type)) {
        oaFetchErr =
          "返回内容疑似 HTML（通常是 Swagger UI 页），请改用 raw OpenAPI 地址（如 /v3/api-docs）。";
        oaSpecText = r.body.slice(0, 8000);
        return;
      }
      oaSpecText = r.body;
      await loadFromText(r.body);
    } catch (error) {
      oaFetchErr = error instanceof Error ? error.message : String(error);
    } finally {
      oaFetchLoading = false;
    }
  };

  const handleOpenApiGenerate = async () => {
    if (!oaWorkingSpec || !oaSelPath) {
      oaGenErr = "请先加载文档并选择接口";
      return;
    }
    oaGenBusy = true;
    oaGenErr = "";
    try {
      const media = oaKind === "swagger2" ? "application/json" : oaSelMedia || oaMediaTypes[0] || "application/json";
      const { schema, example } = getResponseBodyInfo(oaWorkingSpec, oaSelPath, oaSelMethod, oaSelStatus, media);
      const n = cap(oaCount, 1, 50);
      const items: unknown[] = [];
      for (let i = 0; i < n; i += 1) {
        items.push(await generateResponseMock({ schema, example, preferExample: oaPreferExample && i === 0 }));
      }
      const payload = n === 1 ? items[0] : items;
      oaOutJson = JSON.stringify(payload, null, 2);
      const pattern = `${oaMswBase.replace(/\/$/, "")}${oaSelPath.startsWith("/") ? "" : "/"}${oaSelPath}`;
      oaOutMsw = buildMswSnippet({ method: oaSelMethod, urlPattern: pattern, bodyObject: n === 1 ? items[0] : items });
    } catch (error) {
      oaGenErr = error instanceof Error ? error.message : String(error);
      oaOutJson = "";
      oaOutMsw = "";
    } finally {
      oaGenBusy = false;
    }
  };
</script>

<div class="flex h-full flex-col gap-4 overflow-auto p-5">
  <div class="card p-4">
    <h2 class="text-2xl font-semibold">Mock 数据生成</h2>
    <p class="mt-1 text-sm text-muted-foreground">已补齐 React 版常用能力：OpenAPI、Swagger 文档、Schema 推断与多种 Mock 生成流程</p>
  </div>

  <div class="card p-3">
    <div class="flex flex-wrap gap-2">
      {#each tabs as tab}
        <button class="btn" style:background={activeTab === tab.id ? "color-mix(in oklab, var(--primary) 20%, var(--card))" : undefined} onclick={() => (activeTab = tab.id)}>{tab.label}</button>
      {/each}
    </div>
  </div>

  {#if activeTab === "quick"}
    <section class="card space-y-3 p-4">
      <textarea class="input h-48 font-mono" bind:value={quickInput} placeholder="粘贴一条 JSON 样本数据，自动推断 Schema 并生成 Mock"></textarea>
      <div class="flex flex-wrap items-center gap-2">
        <button class="btn btn-primary" onclick={handleQuick}>生成</button>
        <label class="text-sm text-muted-foreground">数量
          <input class="input ml-2 inline-block w-20 text-center" type="number" min="1" max="100" bind:value={quickCount} />
        </label>
      </div>
      {#if quickErr}<div class="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">{quickErr}</div>{/if}
      <div class="flex items-center gap-2">
        <span class="text-sm text-muted-foreground">Mock 数据</span>
        <button class="btn" onclick={() => copyText("quick", quickOut)}>{copied === "quick" ? "已复制" : "复制"}</button>
      </div>
      <textarea class="input h-60 font-mono" readonly value={quickOut}></textarea>
    </section>
  {/if}

  {#if activeTab === "schema-to-mock"}
    <section class="card space-y-3 p-4">
      <textarea class="input h-48 font-mono" bind:value={schemaInput} placeholder="粘贴 JSON Schema（object/properties 结构）"></textarea>
      <div class="flex flex-wrap items-center gap-2">
        <button class="btn btn-primary" onclick={handleSchemaToMock}>生成 Mock</button>
        <label class="text-sm text-muted-foreground">数量
          <input class="input ml-2 inline-block w-20 text-center" type="number" min="1" max="100" bind:value={schemaCount} />
        </label>
      </div>
      {#if schemaErr}<div class="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">{schemaErr}</div>{/if}
      <div class="flex items-center gap-2">
        <span class="text-sm text-muted-foreground">Mock 数据</span>
        <button class="btn" onclick={() => copyText("schema", schemaOut)}>{copied === "schema" ? "已复制" : "复制"}</button>
      </div>
      <textarea class="input h-60 font-mono" readonly value={schemaOut}></textarea>
    </section>
  {/if}

  {#if activeTab === "json-to-schema"}
    <section class="card space-y-3 p-4">
      <p class="text-sm text-muted-foreground">支持输入 JSON 样本或 Swagger/Knife4j 复制出的制表符表格（字段名、说明、类型）。</p>
      <textarea class="input h-48 font-mono" bind:value={jtInput} placeholder="JSON 示例或表格：recordId<Tab>记录id<Tab>integer(int64)"></textarea>
      <div class="flex flex-wrap items-center gap-2">
        <button class="btn btn-primary" onclick={handleInferSchema}>推断 Schema</button>
        <label class="text-sm text-muted-foreground">Mock 条数
          <input class="input ml-2 inline-block w-20 text-center" type="number" min="1" max="100" bind:value={jtCount} />
        </label>
        <button class="btn" onclick={handleMockFromCurrentSchema} disabled={!jtLastSchema}>从当前 Schema 生成 Mock</button>
      </div>
      {#if jtErr}<div class="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">{jtErr}</div>{/if}
      {#if jtWarnings.length > 0}
        <div class="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
          <div class="font-medium">表格解析提示</div>
          <ul class="list-disc pl-5">
            {#each jtWarnings as w}<li>{w}</li>{/each}
          </ul>
        </div>
      {/if}
      <div class="flex items-center gap-2">
        <span class="text-sm text-muted-foreground">Schema 结果</span>
        <button class="btn" onclick={() => copyText("jt-schema", jtSchemaOut)}>{copied === "jt-schema" ? "已复制" : "复制"}</button>
      </div>
      <textarea class="input h-56 font-mono" readonly value={jtSchemaOut}></textarea>
      {#if jtMockErr}<div class="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">{jtMockErr}</div>{/if}
      {#if jtMockOut}
        <div class="flex items-center gap-2">
          <span class="text-sm text-muted-foreground">Mock 预览</span>
          <button class="btn" onclick={() => copyText("jt-mock", jtMockOut)}>{copied === "jt-mock" ? "已复制" : "复制"}</button>
        </div>
        <textarea class="input h-56 font-mono" readonly value={jtMockOut}></textarea>
      {/if}
    </section>
  {/if}

  {#if activeTab === "swagger-md"}
    <section class="space-y-3">
      <div class="card space-y-3 p-4">
        <p class="text-sm text-muted-foreground">粘贴 Knife4j / Swagger 的“复制文档”Markdown，支持解析路径、方法、JSON 示例、响应参数表并生成 Mock/MSW。</p>
        <textarea class="input h-56 font-mono" bind:value={swDoc} placeholder="粘贴 Swagger 文档 Markdown..."></textarea>
        {#if swParsed}
          <div class="rounded-md border border-border px-3 py-2 text-sm">
            <div class="flex flex-wrap gap-2">
              {#if swParsed.title}<span class="rounded border px-2 py-0.5">{swParsed.title}</span>{/if}
              {#if swParsed.method}<span class="rounded border px-2 py-0.5 font-mono">{swParsed.method.toUpperCase()}</span>{/if}
              {#if swParsed.path}<span class="rounded border px-2 py-0.5 font-mono">{swParsed.path}</span>{/if}
            </div>
            {#if swParsed.warnings.length > 0}
              <ul class="mt-2 list-disc pl-5 text-xs text-muted-foreground">
                {#each swParsed.warnings as w}<li>{w}</li>{/each}
              </ul>
            {/if}
          </div>
        {/if}
        <div class="flex flex-wrap items-center gap-2">
          <label class="text-sm text-muted-foreground">示例来源
            <select class="input ml-2 inline-block w-40" bind:value={swTarget}>
              <option value="response">响应示例</option>
              <option value="request">请求示例</option>
            </select>
          </label>
          <label class="text-sm"><input type="checkbox" bind:checked={swUseTable} /> 合并响应参数表</label>
          <label class="text-sm text-muted-foreground">顶层条数<input class="input ml-2 inline-block w-16 text-center" type="number" min="1" max="50" bind:value={swCount} /></label>
          <label class="text-sm text-muted-foreground">数组条数<input class="input ml-2 inline-block w-16 text-center" type="number" min="1" max="100" bind:value={swArrayCount} /></label>
          <label class="text-sm text-muted-foreground">数组层级<input class="input ml-2 inline-block w-16 text-center" type="number" min="0" max="12" bind:value={swArrayDepth} /></label>
          <label class="text-sm text-muted-foreground">MSW 前缀<input class="input ml-2 inline-block w-24 text-center" bind:value={swMswBase} /></label>
          <button class="btn btn-primary" onclick={handleSwaggerGenerate}>生成 Mock</button>
        </div>
        {#if swArrayPaths.length > 0}
          <div class="text-xs text-muted-foreground">数组路径：{swArrayPaths.join(", ")}</div>
        {/if}
      </div>
      {#if swErr}<div class="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">{swErr}</div>{/if}
      {#if swOutJson}
        <div class="card p-4">
          <div class="mb-2 flex items-center gap-2"><span class="text-sm font-medium">JSON</span><button class="btn" onclick={() => copyText("sw-json", swOutJson)}>{copied === "sw-json" ? "已复制" : "复制 JSON"}</button></div>
          <textarea class="input h-64 font-mono" readonly value={swOutJson}></textarea>
        </div>
      {/if}
      {#if swOutMsw}
        <div class="card p-4">
          <div class="mb-2 flex items-center gap-2"><span class="text-sm font-medium">MSW 片段</span><button class="btn" onclick={() => copyText("sw-msw", swOutMsw)}>{copied === "sw-msw" ? "已复制" : "复制 MSW"}</button></div>
          <textarea class="input h-64 font-mono" readonly value={swOutMsw}></textarea>
        </div>
      {/if}
    </section>
  {/if}

  {#if activeTab === "openapi"}
    <section class="space-y-3">
      <div class="card space-y-3 p-4">
        <p class="text-sm text-muted-foreground">支持 URL 拉取（Tauri 下可拉内网）或粘贴 OpenAPI/Swagger YAML/JSON，按 operation + 响应码生成 Mock 和 MSW。</p>
        <div class="grid gap-3 md:grid-cols-2">
          <div class="space-y-2">
            <div class="text-sm font-medium">文档 URL</div>
            <input class="input" bind:value={oaDocUrl} placeholder="https://api.example.com/v3/api-docs" />
            <button class="btn btn-primary" onclick={handleOpenApiFetch} disabled={oaFetchLoading || !oaDocUrl.trim()}>
              {oaFetchLoading ? "拉取中..." : "拉取并解析"}
            </button>
          </div>
          <div class="space-y-2">
            <div class="text-sm font-medium">请求头（可选，每行 Name: Value）</div>
            <textarea class="input h-24 font-mono" bind:value={oaHeaderText} placeholder={"Authorization: Bearer <token>\nX-Custom: value"}></textarea>
          </div>
        </div>
        <div class="space-y-2">
          <div class="text-sm font-medium">OpenAPI / Swagger 原文（YAML 或 JSON）</div>
          <textarea class="input h-44 font-mono" bind:value={oaSpecText} placeholder="粘贴 YAML/JSON 或先输入 URL 拉取"></textarea>
          <button class="btn" onclick={() => loadFromText(oaSpecText)} disabled={!oaSpecText.trim()}>仅解析当前文本</button>
        </div>
        {#if oaFetchErr}<div class="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">{oaFetchErr}</div>{/if}
        {#if oaParseErr}<div class="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">{oaParseErr}</div>{/if}
        {#if oaDerefErr}<div class="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">{oaDerefErr}</div>{/if}
        {#if oaDerefBusy}<div class="text-sm text-muted-foreground">正在展开 $ref...</div>{/if}
      </div>

      {#if oaOperations.length > 0}
        <div class="card space-y-3 p-4">
          <div class="text-sm text-muted-foreground">格式 <span class="font-mono">{oaKind}</span> · 共 {oaOperations.length} 个 operation</div>
          <input class="input" bind:value={oaSearch} placeholder="筛选 path / method / operationId / summary" />
          <div class="grid gap-3 md:grid-cols-2">
            <div class="space-y-1">
              <div class="text-xs text-muted-foreground">接口</div>
              <select
                class="input"
                value={oaFilteredOps.some((o) => o.path === oaSelPath && o.method === oaSelMethod) ? `${oaSelMethod}\t${oaSelPath}` : ""}
                onchange={(e) => {
                  const [m, p] = (e.target as HTMLSelectElement).value.split("\t");
                  oaSelMethod = (m as HttpMethod) || "get";
                  oaSelPath = p ?? "";
                }}
              >
                {#if oaFilteredOps.length === 0}<option value="">无匹配</option>{/if}
                {#each oaFilteredOps as op}
                  <option value={`${op.method}\t${op.path}`}>{formatOperationLabel(op)}</option>
                {/each}
              </select>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div class="space-y-1">
                <div class="text-xs text-muted-foreground">响应码</div>
                <select class="input" bind:value={oaSelStatus} disabled={oaStatusKeys.length === 0}>
                  {#each oaStatusKeys as k}<option value={k}>{k}</option>{/each}
                </select>
              </div>
              <div class="space-y-1">
                <div class="text-xs text-muted-foreground">Content-Type</div>
                <select class="input" bind:value={oaSelMedia} disabled={oaMediaTypes.length === 0}>
                  {#if oaMediaTypes.length === 0}<option value="">无 JSON schema</option>{/if}
                  {#each oaMediaTypes as m}<option value={m}>{m}</option>{/each}
                </select>
              </div>
            </div>
          </div>
          <label class="text-sm"><input type="checkbox" bind:checked={oaPreferExample} /> 首条优先使用 example</label>
          <div class="flex flex-wrap items-center gap-3">
            <label class="text-sm text-muted-foreground">条数<input class="input ml-2 inline-block w-16 text-center" type="number" min="1" max="50" bind:value={oaCount} /></label>
            <label class="text-sm text-muted-foreground">MSW 前缀<input class="input ml-2 inline-block w-24 text-center" bind:value={oaMswBase} /></label>
            <button class="btn btn-primary" onclick={handleOpenApiGenerate} disabled={oaGenBusy || !oaSelPath}>
              {oaGenBusy ? "生成中..." : "生成 Mock"}
            </button>
          </div>
        </div>
      {/if}

      {#if oaGenErr}<div class="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">{oaGenErr}</div>{/if}
      {#if oaOutJson}
        <div class="card p-4">
          <div class="mb-2 flex items-center gap-2"><span class="text-sm font-medium">JSON</span><button class="btn" onclick={() => copyText("oa-json", oaOutJson)}>{copied === "oa-json" ? "已复制" : "复制 JSON"}</button></div>
          <textarea class="input h-72 font-mono" readonly value={oaOutJson}></textarea>
        </div>
      {/if}
      {#if oaOutMsw}
        <div class="card p-4">
          <div class="mb-2 flex items-center gap-2"><span class="text-sm font-medium">MSW 片段</span><button class="btn" onclick={() => copyText("oa-msw", oaOutMsw)}>{copied === "oa-msw" ? "已复制" : "复制 MSW"}</button></div>
          <textarea class="input h-72 font-mono" readonly value={oaOutMsw}></textarea>
        </div>
      {/if}
    </section>
  {/if}
</div>

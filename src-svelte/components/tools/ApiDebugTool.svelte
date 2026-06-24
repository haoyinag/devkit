<script lang="ts">
  import { invoke, isTauri } from "@tauri-apps/api/core";
  import {
    buildMswHandler,
    cloneScenario,
    compareResponses,
    createScenario,
    exportMockDefinition,
    regenerateMockBody,
    responseToMockDraft,
    restoreFixedMockBody,
    type DebugScenario,
    type MockDraft,
    type RequestSnapshot,
    type ResponseSnapshot,
    type ResponseDiff,
    type StoredEntry,
  } from "@/lib/api-debug-workflow";
  import {
    createEditableEntry,
    entriesToObject,
    entriesToStringRecord,
    parseReplayRequest,
    type EditableEntry,
    type RequestBodyMode,
  } from "@/lib/request-replay";
  import ResponseInspector from "@app/components/tools/api-debug/ResponseInspector.svelte";
  import RequestEntryEditor from "@app/components/tools/request-replay/RequestEntryEditor.svelte";
  import { Braces, ChevronDown, ChevronUp, Clock3, Copy, History, Play, RotateCcw, Trash2, WandSparkles } from "@lucide/svelte";

  type RequestTab = "params" | "headers" | "body";
  type ResponseTab = "body" | "headers";
  type MockOutputTab = "body" | "msw" | "definition";

  interface HttpReplayResult {
    status: number;
    statusText: string;
    finalUrl: string;
    headers: Record<string, string>;
    body: string;
    durationMs: number;
    sizeBytes: number;
  }

  interface DebugHistoryRecord {
    id: string;
    createdAt: number;
    request: RequestSnapshot;
    status?: number;
    statusText?: string;
    durationMs?: number;
    error?: string;
  }

  interface CopyExample {
    id: string;
    label: string;
    description: string;
    code: string;
  }

  const HISTORY_STORAGE_KEY = "devkit-api-debug-history-v1";
  const HISTORY_LIMIT = 20;
  const SCENARIO_STORAGE_KEY = "devkit-api-debug-scenarios-v1";
  const SCENARIO_LIMIT = 50;
  const MAX_BASELINE_BODY_CHARS = 250_000;
  const sampleInput = JSON.stringify(
    {
      url: "https://httpbin.org/anything",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer replace-me",
      },
      params: {
        page: 1,
        keyword: "devkit",
      },
      body: {
        name: "DevKit",
        enabled: true,
        options: { mode: "debug" },
      },
      timeout: 30000,
    },
    null,
    2,
  );
  const pastePlaceholder =
    '粘贴 JSON.stringify 后的请求信息，例如 {"url":"...","method":"POST","headers":{},"params":{},"body":{}}';
  const rawJsonPlaceholder = '例如 [{"id":1}] 或其他合法 JSON';
  const axiosLogSnippet = `const baseURL = new URL(config.baseURL ?? "/", window.location.origin);
console.log(
  JSON.stringify({
    url: new URL(config.url ?? "", baseURL).toString(),
    method: config.method?.toUpperCase() ?? "GET",
    headers: Object.fromEntries(
      Object.entries(config.headers?.toJSON?.() ?? config.headers ?? {}),
    ),
    params: config.params,
    body: config.data,
    timeout: config.timeout,
  }),
);`;
  const axiosInterceptorSnippet = `axios.interceptors.request.use((config) => {
  const baseURL = new URL(config.baseURL ?? "/", window.location.origin);
  console.log(
    JSON.stringify({
      url: new URL(config.url ?? "", baseURL).toString(),
      method: config.method?.toUpperCase() ?? "GET",
      headers: Object.fromEntries(
        Object.entries(config.headers?.toJSON?.() ?? config.headers ?? {}),
      ),
      params: config.params,
      body: config.data,
      timeout: config.timeout,
    }),
  );
  return config;
});`;
  const rawAxiosConfigExample = JSON.stringify(
    {
      baseURL: "https://api.example.com/v1",
      url: "/users",
      method: "post",
      headers: { Authorization: "Bearer replace-me", "Content-Type": "application/json" },
      params: { page: 1 },
      data: "{\"name\":\"DevKit\"}",
      timeout: 30000,
    },
    null,
    2,
  );
  const configAndBodyExample = `request config:
{"url":"https://api.example.com/users/1","method":"PATCH","headers":{"Authorization":"Bearer replace-me"}}

request body:
{"enabled":true,"remark":"debug"}`;
  const copyExamples: CopyExample[] = [
    {
      id: "axios-log",
      label: "已有 Axios 拦截器",
      description: "推荐：把日志片段粘贴到现有 request interceptor 回调中。",
      code: axiosLogSnippet,
    },
    {
      id: "axios-full",
      label: "完整 Axios 拦截器",
      description: "项目还没有 request interceptor 时，直接添加这一段。",
      code: axiosInterceptorSnippet,
    },
    {
      id: "standard-json",
      label: "标准请求 JSON",
      description: "不改项目代码时，也可以手动整理成这类 JSON。",
      code: sampleInput,
    },
    {
      id: "axios-config",
      label: "原始 Axios config",
      description: "兼容 baseURL、url、data 和分组 headers。",
      code: rawAxiosConfigExample,
    },
    {
      id: "config-body",
      label: "配置 + Body 两段 JSON",
      description: "请求配置和 Body 分开复制时可直接连续粘贴。",
      code: configAndBodyExample,
    },
  ];

  const loadHistory = (): DebugHistoryRecord[] => {
    try {
      const parsed = JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) ?? "[]");
      return Array.isArray(parsed) ? parsed.slice(0, HISTORY_LIMIT) : [];
    } catch {
      return [];
    }
  };
  const loadScenarios = (): DebugScenario[] => {
    try {
      const parsed = JSON.parse(localStorage.getItem(SCENARIO_STORAGE_KEY) ?? "[]");
      return Array.isArray(parsed) ? parsed.slice(0, SCENARIO_LIMIT) : [];
    } catch {
      return [];
    }
  };

  let pasteText = $state("");
  let imported = $state(false);
  let importExpanded = $state(true);
  let examplesExpanded = $state(false);
  let historyExpanded = $state(false);
  let scenariosExpanded = $state(false);
  let parseError = $state("");
  let warnings = $state<string[]>([]);
  let url = $state("");
  let method = $state("GET");
  let headers = $state<EditableEntry[]>([]);
  let params = $state<EditableEntry[]>([]);
  let bodyMode = $state<RequestBodyMode>("none");
  let bodyFields = $state<EditableEntry[]>([]);
  let bodyText = $state("");
  let timeoutMs = $state(30000);
  let requestTab = $state<RequestTab>("params");
  let sending = $state(false);
  let requestError = $state("");
  let response = $state<HttpReplayResult | null>(null);
  let responseTab = $state<ResponseTab>("body");
  let copied = $state("");
  let history = $state<DebugHistoryRecord[]>(loadHistory());
  let scenarios = $state<DebugScenario[]>(loadScenarios());
  let scenarioNotice = $state("");
  let mockDraft = $state<MockDraft | null>(null);
  let mockError = $state("");
  let mockOutputTab = $state<MockOutputTab>("body");
  let activeScenarioId = $state("");
  let responseDiff = $state<ResponseDiff | null>(null);

  const enabledCount = (entries: EditableEntry[]) => entries.filter((entry) => entry.enabled && entry.key.trim()).length;
  const toStoredEntries = (entries: EditableEntry[]): StoredEntry[] =>
    entries.map(({ key, value, enabled, valueType }) => ({ key, value, enabled, valueType }));
  const fromStoredEntries = (entries: StoredEntry[]): EditableEntry[] =>
    entries.map((entry) => createEditableEntry(entry.key, entry.value, entry.enabled, entry.valueType));

  const currentSnapshot = (): RequestSnapshot => ({
    url,
    method,
    headers: toStoredEntries(headers),
    params: toStoredEntries(params),
    bodyMode,
    bodyFields: toStoredEntries(bodyFields),
    bodyText,
    timeoutMs,
  });

  const persistHistory = (next: DebugHistoryRecord[]) => {
    history = next.slice(0, HISTORY_LIMIT);
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
    } catch {
      // Keep the in-memory history usable when local storage is unavailable or full.
    }
  };
  const persistScenarios = (next: DebugScenario[]) => {
    scenarios = next.slice(0, SCENARIO_LIMIT);
    try {
      localStorage.setItem(SCENARIO_STORAGE_KEY, JSON.stringify(scenarios));
    } catch {
      // Keep scenarios usable in memory if local storage is unavailable.
    }
  };

  const defaultScenarioName = (snapshot: RequestSnapshot) => {
    let label = snapshot.url;
    try {
      label = new URL(snapshot.url).pathname;
    } catch {
      // Relative URLs already make useful labels.
    }
    return `${snapshot.method} ${label}`;
  };

  const saveScenario = (request: RequestSnapshot, baseline?: ResponseSnapshot) => {
    const storedBaseline = baseline && baseline.body.length <= MAX_BASELINE_BODY_CHARS ? baseline : undefined;
    const scenario = createScenario(defaultScenarioName(request), request, storedBaseline);
    persistScenarios([scenario, ...scenarios]);
    scenarioNotice = baseline && !storedBaseline
      ? "响应超过 250,000 字符，仅保存请求场景"
      : storedBaseline
        ? "已保存带响应基线的场景"
        : "已保存请求场景";
    scenariosExpanded = true;
    setTimeout(() => {
      scenarioNotice = "";
    }, 1500);
  };

  const renameScenario = (id: string, name: string) => {
    persistScenarios(
      scenarios.map((scenario) =>
        scenario.id === id ? { ...scenario, name: name.trim() || defaultScenarioName(scenario.request), updatedAt: Date.now() } : scenario,
      ),
    );
  };

  const duplicateScenario = (scenario: DebugScenario) => {
    persistScenarios([cloneScenario(scenario), ...scenarios]);
  };

  const deleteScenario = (id: string) => {
    persistScenarios(scenarios.filter((scenario) => scenario.id !== id));
  };

  const addHistory = (result?: HttpReplayResult, error?: string) => {
    const record: DebugHistoryRecord = {
      id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
      createdAt: Date.now(),
      request: currentSnapshot(),
      status: result?.status,
      statusText: result?.statusText,
      durationMs: result?.durationMs,
      error,
    };
    persistHistory([record, ...history]);
  };

  const applySnapshot = (snapshot: RequestSnapshot) => {
    url = snapshot.url;
    method = snapshot.method;
    headers = fromStoredEntries(snapshot.headers);
    params = fromStoredEntries(snapshot.params);
    bodyMode = snapshot.bodyMode;
    bodyFields = fromStoredEntries(snapshot.bodyFields);
    bodyText = snapshot.bodyText;
    timeoutMs = snapshot.timeoutMs;
    warnings = [];
    parseError = "";
    requestError = "";
    response = null;
    responseDiff = null;
    imported = true;
    importExpanded = false;
    requestTab = snapshot.params.length > 0 ? "params" : snapshot.bodyMode !== "none" ? "body" : "headers";
  };

  const loadHistoryRecord = (record: DebugHistoryRecord) => {
    applySnapshot(record.request);
    activeScenarioId = "";
    historyExpanded = false;
  };
  const loadScenario = (scenario: DebugScenario) => {
    applySnapshot(scenario.request);
    activeScenarioId = scenario.id;
    scenariosExpanded = false;
  };

  const openMockDraft = (request: RequestSnapshot, sourceResponse: ResponseSnapshot, sourceScenarioId?: string) => {
    mockDraft = responseToMockDraft(request, sourceResponse, sourceScenarioId);
    mockError = "";
    mockOutputTab = "body";
  };

  const generateMockDraft = () => {
    if (!mockDraft) return;
    try {
      mockDraft = regenerateMockBody(mockDraft);
      mockError = "";
    } catch (error) {
      mockError = error instanceof Error ? error.message : String(error);
    }
  };

  const restoreMockDraft = () => {
    if (!mockDraft) return;
    mockDraft = restoreFixedMockBody(mockDraft);
    mockError = "";
  };

  const formatMockBody = () => {
    if (!mockDraft) return;
    try {
      mockDraft = { ...mockDraft, body: JSON.stringify(JSON.parse(mockDraft.body), null, 2) };
      mockError = "";
    } catch (error) {
      mockError = error instanceof Error ? `Mock Body 不是有效 JSON: ${error.message}` : String(error);
    }
  };

  const deleteHistoryRecord = (id: string) => {
    persistHistory(history.filter((record) => record.id !== id));
  };

  const clearHistory = () => {
    persistHistory([]);
  };

  const updateActiveBaseline = () => {
    if (!activeScenarioId || !response) return;
    persistScenarios(
      scenarios.map((scenario) =>
        scenario.id === activeScenarioId
          ? { ...scenario, request: currentSnapshot(), baseline: response, updatedAt: Date.now() }
          : scenario,
      ),
    );
    responseDiff = null;
    scenarioNotice = "已更新当前场景基线";
    setTimeout(() => {
      scenarioNotice = "";
    }, 1500);
  };

  const handleParse = () => {
    try {
      const parsed = parseReplayRequest(pasteText);
      url = parsed.url;
      method = parsed.method;
      headers = parsed.headers;
      params = parsed.params;
      bodyMode = parsed.bodyMode;
      bodyFields = parsed.bodyFields;
      bodyText = parsed.bodyText;
      timeoutMs = parsed.timeoutMs;
      warnings = parsed.warnings;
      parseError = "";
      requestError = "";
      response = null;
      responseDiff = null;
      activeScenarioId = "";
      imported = true;
      importExpanded = false;
      requestTab = parsed.params.length > 0 ? "params" : parsed.bodyMode !== "none" ? "body" : "headers";
    } catch (error) {
      parseError = error instanceof Error ? error.message : String(error);
    }
  };

  const handleReset = () => {
    pasteText = "";
    imported = false;
    importExpanded = true;
    parseError = "";
    warnings = [];
    url = "";
    method = "GET";
    headers = [];
    params = [];
    bodyMode = "none";
    bodyFields = [];
    bodyText = "";
    timeoutMs = 30000;
    requestError = "";
    response = null;
    responseDiff = null;
    activeScenarioId = "";
  };

  const buildBody = (): string | undefined => {
    if (bodyMode === "none") return undefined;
    if (bodyMode === "form") {
      const form = new URLSearchParams();
      for (const entry of bodyFields) {
        if (entry.enabled && entry.key.trim()) form.append(entry.key.trim(), entry.value);
      }
      return form.toString();
    }
    if (bodyMode === "json") {
      if (bodyFields.length > 0) return JSON.stringify(entriesToObject(bodyFields));
      const trimmed = bodyText.trim();
      if (!trimmed) return "";
      JSON.parse(trimmed);
      return trimmed;
    }
    return bodyText;
  };

  const sendInBrowser = async (
    requestUrl: string,
    requestHeaders: Record<string, string>,
    body: string | undefined,
  ): Promise<HttpReplayResult> => {
    const target = new URL(requestUrl);
    for (const entry of params) {
      if (entry.enabled && entry.key.trim()) target.searchParams.append(entry.key.trim(), entry.value);
    }
    const controller = new AbortController();
    const started = performance.now();
    const timer = window.setTimeout(() => controller.abort(), Math.max(100, timeoutMs));
    try {
      const result = await fetch(target, {
        method,
        headers: requestHeaders,
        body: ["GET", "HEAD"].includes(method) ? undefined : body,
        signal: controller.signal,
      });
      const responseBody = await result.text();
      return {
        status: result.status,
        statusText: result.statusText,
        finalUrl: result.url,
        headers: Object.fromEntries(result.headers.entries()),
        body: responseBody,
        durationMs: Math.round(performance.now() - started),
        sizeBytes: new Blob([responseBody]).size,
      };
    } finally {
      clearTimeout(timer);
    }
  };

  const handleSend = async () => {
    sending = true;
    requestError = "";
    response = null;
    responseDiff = null;
    try {
      const normalizedUrl = new URL(url.trim()).toString();
      const requestHeaders = entriesToStringRecord(headers);
      const body = buildBody();
      if (bodyMode === "json" && !Object.keys(requestHeaders).some((key) => key.toLowerCase() === "content-type")) {
        requestHeaders["Content-Type"] = "application/json";
      }
      if (bodyMode === "form" && !Object.keys(requestHeaders).some((key) => key.toLowerCase() === "content-type")) {
        requestHeaders["Content-Type"] = "application/x-www-form-urlencoded";
      }

      const result = isTauri()
        ? await invoke<HttpReplayResult>("http_replay_send", {
            input: {
              url: normalizedUrl,
              method,
              headers: requestHeaders,
              query: params
                .filter((entry) => entry.enabled && entry.key.trim())
                .map((entry) => [entry.key.trim(), entry.value]),
              bodyKind: bodyMode,
              body,
              timeoutMs,
            },
          })
        : await sendInBrowser(normalizedUrl, requestHeaders, body);
      response = result;
      addHistory(result);
      const activeScenario = scenarios.find((scenario) => scenario.id === activeScenarioId);
      responseDiff = activeScenario?.baseline ? compareResponses(activeScenario.baseline, result) : null;
      responseTab = "body";
    } catch (error) {
      if (error instanceof SyntaxError && bodyMode === "json") {
        requestError = `Body JSON 无效: ${error.message}`;
      } else {
        requestError = error instanceof Error ? error.message : String(error);
      }
      addHistory(undefined, requestError);
    } finally {
      sending = false;
    }
  };

  const formattedResponseBody = $derived.by(() => {
    if (!response?.body) return "";
    try {
      return JSON.stringify(JSON.parse(response.body), null, 2);
    } catch {
      return response.body;
    }
  });

  const responseHeaderText = $derived(
    response ? Object.entries(response.headers).map(([key, value]) => `${key}: ${value}`).join("\n") : "",
  );
  const mockOutputText = $derived.by(() => {
    if (!mockDraft) return "";
    if (mockOutputTab === "msw") return buildMswHandler(mockDraft);
    if (mockOutputTab === "definition") return exportMockDefinition(mockDraft);
    return mockDraft.body;
  });

  const copyText = async (key: string, value: string) => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    copied = key;
    setTimeout(() => {
      if (copied === key) copied = "";
    }, 1200);
  };

  const statusTone = (status: number) => {
    if (status >= 200 && status < 300) return "text-emerald-600 dark:text-emerald-400";
    if (status >= 400) return "text-red-600 dark:text-red-400";
    return "text-amber-600 dark:text-amber-400";
  };
  const diffKindLabel = (kind: ResponseDiff["items"][number]["kind"]) =>
    ({ added: "新增", removed: "删除", changed: "修改", type: "类型变化" })[kind];
  const diffKindTone = (kind: ResponseDiff["items"][number]["kind"]) =>
    ({
      added: "text-emerald-600 dark:text-emerald-400",
      removed: "text-red-600 dark:text-red-400",
      changed: "text-amber-600 dark:text-amber-400",
      type: "text-violet-600 dark:text-violet-400",
    })[kind];
  const diffValueText = (value: unknown) => value === undefined ? "-" : JSON.stringify(value, null, 2);
</script>

<div class="tool-page-shell overflow-auto p-5">
  <section class="bg-brand-gradient-soft rounded-2xl border p-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 class="tool-page-title">接口调试</h2>
        <p class="mt-1 text-sm text-muted-foreground">粘贴请求拦截器输出，自动生成可编辑表单，然后直接发起真实请求。</p>
      </div>
      <div class="flex gap-2">
        <button class="btn inline-flex items-center gap-1.5" onclick={() => (pasteText = sampleInput)}>
          <Braces size={14} />
          填入示例
        </button>
        <button class="btn inline-flex items-center gap-1.5" onclick={handleReset}>
          <RotateCcw size={14} />
          重置
        </button>
      </div>
    </div>
  </section>

  <section class="card overflow-hidden">
    <button
      class="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      onclick={() => (importExpanded = !importExpanded)}
    >
      <span class="flex items-center gap-2 font-medium">
        <WandSparkles size={16} class="text-[var(--primary)]" />
        粘贴请求 JSON
        {#if imported}<span class="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-300">已生成表单</span>{/if}
      </span>
      {#if importExpanded}<ChevronUp size={16} />{:else}<ChevronDown size={16} />{/if}
    </button>
    {#if importExpanded}
      <div class="space-y-3 border-t p-4">
        <textarea
          class="input h-44 resize-y font-mono text-sm"
          bind:value={pasteText}
          placeholder={pastePlaceholder}
          spellcheck="false"
        ></textarea>
        <div class="flex flex-wrap items-center gap-2">
          <button class="btn btn-primary inline-flex items-center gap-1.5" onclick={handleParse} disabled={!pasteText.trim()}>
            <WandSparkles size={14} />
            解析并生成表单
          </button>
          <span class="text-xs text-muted-foreground">支持 Axios config、重复 stringify，以及“配置 JSON + Body JSON”两段内容。</span>
        </div>
        <div class="rounded-xl border">
          <button
            class="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium"
            onclick={() => (examplesExpanded = !examplesExpanded)}
          >
            <span>如何获取请求信息？查看全部支持格式</span>
            {#if examplesExpanded}<ChevronUp size={15} />{:else}<ChevronDown size={15} />{/if}
          </button>
          {#if examplesExpanded}
            <div class="grid gap-2 border-t p-3 lg:grid-cols-2">
              {#each copyExamples as example}
                <article class="rounded-xl border bg-[var(--surface-2)]/45 p-3">
                  <div class="flex items-start justify-between gap-3">
                    <div>
                      <div class="text-sm font-semibold">{example.label}</div>
                      <p class="mt-1 text-xs leading-relaxed text-muted-foreground">{example.description}</p>
                    </div>
                    <button class="btn shrink-0 inline-flex items-center gap-1.5" onclick={() => copyText(example.id, example.code)}>
                      <Copy size={13} />
                      {copied === example.id ? "已复制" : "复制"}
                    </button>
                  </div>
                  <pre class="mt-2 max-h-36 overflow-auto whitespace-pre-wrap rounded-lg bg-[var(--background)] p-2 font-mono text-[11px] leading-relaxed">{example.code}</pre>
                </article>
              {/each}
            </div>
          {/if}
        </div>
        {#if parseError}
          <div class="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">{parseError}</div>
        {/if}
      </div>
    {/if}
  </section>

  <section class="card overflow-hidden">
    <div class="flex items-center gap-2 px-4 py-3">
      <button
        class="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
        onclick={() => (scenariosExpanded = !scenariosExpanded)}
      >
        <span class="flex items-center gap-2 font-medium">
          <Braces size={16} class="text-[var(--primary)]" />
          已保存场景
          <span class="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-xs text-muted-foreground">{scenarios.length}/{SCENARIO_LIMIT}</span>
          {#if scenarioNotice}<span class="text-xs font-normal text-emerald-600 dark:text-emerald-400">{scenarioNotice}</span>{/if}
        </span>
        {#if scenariosExpanded}<ChevronUp size={16} />{:else}<ChevronDown size={16} />{/if}
      </button>
    </div>
    {#if scenariosExpanded}
      <div class="space-y-2 border-t p-3">
        <p class="px-1 text-xs text-amber-700 dark:text-amber-300">
          场景长期保存在本机 localStorage，可能包含 Token/Cookie；最多保留 50 条。
        </p>
        {#if scenarios.length === 0}
          <div class="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">暂无已保存场景</div>
        {:else}
          {#each scenarios as scenario (scenario.id)}
            <article class="flex flex-wrap items-center gap-2 rounded-xl border p-3">
              <button class="min-w-0 flex-1 text-left" onclick={() => loadScenario(scenario)}>
                <div class="flex items-center gap-2">
                  <span class="rounded-md bg-[var(--surface-2)] px-2 py-0.5 font-mono text-xs font-semibold">{scenario.request.method}</span>
                  {#if scenario.baseline}
                    <span class="text-xs font-semibold text-emerald-600 dark:text-emerald-400">基线 {scenario.baseline.status}</span>
                  {:else}
                    <span class="text-xs text-muted-foreground">仅请求</span>
                  {/if}
                  <span class="text-xs text-muted-foreground">{new Date(scenario.updatedAt).toLocaleString()}</span>
                </div>
                <div class="mt-1 truncate font-mono text-xs text-muted-foreground" title={scenario.request.url}>{scenario.request.url}</div>
              </button>
              <input
                class="input h-9 w-48 text-sm"
                value={scenario.name}
                aria-label="场景名称"
                onchange={(event) => renameScenario(scenario.id, (event.target as HTMLInputElement).value)}
              />
              <button class="btn shrink-0" onclick={() => loadScenario(scenario)}>载入</button>
              {#if scenario.baseline}
                <button class="btn shrink-0" onclick={() => openMockDraft(scenario.request, scenario.baseline!, scenario.id)}>转 Mock</button>
              {/if}
              <button class="btn shrink-0" onclick={() => duplicateScenario(scenario)}>复制</button>
              <button class="btn shrink-0 px-2 text-muted-foreground" onclick={() => deleteScenario(scenario.id)} title="删除场景">
                <Trash2 size={14} />
              </button>
            </article>
          {/each}
        {/if}
      </div>
    {/if}
  </section>

  <section class="card overflow-hidden">
    <div class="flex items-center gap-2 px-4 py-3">
      <button
        class="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
        onclick={() => (historyExpanded = !historyExpanded)}
      >
        <span class="flex items-center gap-2 font-medium">
          <History size={16} class="text-[var(--primary)]" />
          调试记录
          <span class="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-xs text-muted-foreground">{history.length}/{HISTORY_LIMIT}</span>
        </span>
        {#if historyExpanded}<ChevronUp size={16} />{:else}<ChevronDown size={16} />{/if}
      </button>
      {#if history.length > 0}
        <button class="btn shrink-0 text-xs" onclick={clearHistory}>清空全部</button>
      {/if}
    </div>
    {#if historyExpanded}
      <div class="space-y-2 border-t p-3">
        <p class="px-1 text-xs text-amber-700 dark:text-amber-300">
          最近 20 条保存在本机 localStorage，请求 Header 可能包含 Token/Cookie；共享设备使用后请及时删除。
        </p>
        {#if history.length === 0}
          <div class="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">暂无调试记录</div>
        {:else}
          {#each history as record (record.id)}
            <article class="flex items-center gap-3 rounded-xl border p-3">
              <button class="min-w-0 flex-1 text-left" onclick={() => loadHistoryRecord(record)}>
                <div class="flex flex-wrap items-center gap-2">
                  <span class="rounded-md bg-[var(--surface-2)] px-2 py-0.5 font-mono text-xs font-semibold">{record.request.method}</span>
                  {#if record.status}
                    <span class={`text-xs font-semibold ${statusTone(record.status)}`}>{record.status} {record.statusText}</span>
                  {:else if record.error}
                    <span class="text-xs font-semibold text-red-600 dark:text-red-400">请求失败</span>
                  {/if}
                  {#if record.durationMs !== undefined}<span class="text-xs text-muted-foreground">{record.durationMs} ms</span>{/if}
                  <span class="text-xs text-muted-foreground">{new Date(record.createdAt).toLocaleString()}</span>
                </div>
                <div class="mt-1 truncate font-mono text-sm" title={record.request.url}>{record.request.url}</div>
                {#if record.error}<div class="mt-1 truncate text-xs text-red-600/80 dark:text-red-400/80">{record.error}</div>{/if}
              </button>
              <button class="btn shrink-0 inline-flex items-center gap-1.5" onclick={() => loadHistoryRecord(record)}>
                载入
              </button>
              <button class="btn shrink-0" onclick={() => saveScenario(record.request)}>保存场景</button>
              <button class="btn shrink-0 px-2 text-muted-foreground" onclick={() => deleteHistoryRecord(record.id)} title="删除记录">
                <Trash2 size={14} />
              </button>
            </article>
          {/each}
        {/if}
      </div>
    {/if}
  </section>

  {#if imported}
    {#if warnings.length > 0}
      <div class="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
        {#each warnings as warning}<div>{warning}</div>{/each}
      </div>
    {/if}

    <section class="card p-4">
      <div class="grid gap-2 md:grid-cols-[120px_minmax(260px,1fr)_130px_auto]">
        <select class="input h-10 font-semibold" bind:value={method}>
          {#each ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as item}
            <option value={item}>{item}</option>
          {/each}
        </select>
        <input class="input h-10 font-mono text-sm" bind:value={url} placeholder="https://api.example.com/path" />
        <label class="relative">
          <input class="input h-10 pr-9 text-right text-sm" type="number" min="100" max="300000" bind:value={timeoutMs} />
          <Clock3 size={14} class="pointer-events-none absolute right-3 top-3 text-muted-foreground" />
        </label>
        <button class="btn btn-primary inline-flex h-10 items-center justify-center gap-1.5 px-5" onclick={handleSend} disabled={sending || !url.trim()}>
          <Play size={14} />
          {sending ? "请求中..." : "发送"}
        </button>
      </div>
      <p class="mt-2 text-xs text-muted-foreground">超时单位为毫秒。请求结束后会加入本机最近 20 条调试记录，可随时载入或删除。</p>
    </section>

    <section class="card overflow-hidden">
      <div class="flex gap-1 border-b px-3 pt-2">
        {#each ([
          ["params", `Query (${enabledCount(params)})`],
          ["headers", `Headers (${enabledCount(headers)})`],
          ["body", `Body${bodyMode === "none" ? "" : ` · ${bodyMode}`}`],
        ] as [RequestTab, string][]) as tab}
          <button
            class="rounded-t-lg px-3 py-2 text-sm font-medium transition-colors"
            class:bg-[var(--surface-2)]={requestTab === tab[0]}
            class:text-[var(--primary)]={requestTab === tab[0]}
            onclick={() => (requestTab = tab[0])}
          >
            {tab[1]}
          </button>
        {/each}
      </div>
      <div class="p-4">
        {#if requestTab === "params"}
          <RequestEntryEditor entries={params} onChange={(next) => (params = next)} keyPlaceholder="Query 参数名" emptyText="当前没有 Query 参数" />
        {:else if requestTab === "headers"}
          <RequestEntryEditor entries={headers} onChange={(next) => (headers = next)} keyPlaceholder="Header 名称" emptyText="当前没有请求头" />
        {:else}
          <div class="mb-4 flex flex-wrap items-center gap-2">
            <span class="text-sm text-muted-foreground">Body 类型</span>
            <select class="input h-9 w-48" bind:value={bodyMode}>
              <option value="none">无 Body</option>
              <option value="json">JSON</option>
              <option value="text">Raw Text</option>
              <option value="form">Form URL Encoded</option>
            </select>
          </div>
          {#if bodyMode === "json" && bodyFields.length > 0}
            <p class="mb-3 text-xs text-muted-foreground">对象字段已展开；嵌套对象和数组以 JSON 值显示，可直接修改。</p>
            <RequestEntryEditor entries={bodyFields} onChange={(next) => (bodyFields = next)} keyPlaceholder="Body 字段" emptyText="当前没有 Body 字段" showTypes />
          {:else if bodyMode === "form"}
            <RequestEntryEditor entries={bodyFields} onChange={(next) => (bodyFields = next)} keyPlaceholder="表单字段" emptyText="当前没有表单字段" />
          {:else if bodyMode === "json"}
            <textarea class="input h-56 resize-y font-mono text-sm" bind:value={bodyText} placeholder={rawJsonPlaceholder}></textarea>
          {:else if bodyMode === "text"}
            <textarea class="input h-56 resize-y font-mono text-sm" bind:value={bodyText} placeholder="输入原始请求体"></textarea>
          {:else}
            <div class="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">该请求不发送 Body</div>
          {/if}
        {/if}
      </div>
    </section>

    {#if requestError}
      <div class="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">{requestError}</div>
    {/if}

    {#if response}
      <section class="card overflow-hidden">
        <div class="flex flex-wrap items-center gap-3 border-b px-4 py-3">
          <span class={`text-lg font-semibold ${statusTone(response.status)}`}>{response.status} {response.statusText}</span>
          <span class="text-sm text-muted-foreground">{response.durationMs} ms</span>
          <span class="text-sm text-muted-foreground">{response.sizeBytes.toLocaleString()} bytes</span>
          <span class="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground" title={response.finalUrl}>{response.finalUrl}</span>
        </div>
        <div class="flex items-center gap-1 border-b px-3 pt-2">
          <button class="rounded-t-lg px-3 py-2 text-sm font-medium" class:bg-[var(--surface-2)]={responseTab === "body"} onclick={() => (responseTab = "body")}>Body</button>
          <button class="rounded-t-lg px-3 py-2 text-sm font-medium" class:bg-[var(--surface-2)]={responseTab === "headers"} onclick={() => (responseTab = "headers")}>Headers</button>
          <button
            class="btn ml-auto mb-2 inline-flex items-center gap-1.5"
            onclick={() => copyText(responseTab, responseTab === "body" ? formattedResponseBody : responseHeaderText)}
          >
            <Copy size={14} />
            {copied === responseTab ? "已复制" : "复制"}
          </button>
          <button class="btn mb-2" onclick={() => saveScenario(currentSnapshot(), response)}>保存为场景</button>
          <button class="btn mb-2" onclick={() => openMockDraft(currentSnapshot(), response)}>转为 Mock</button>
        </div>
        <ResponseInspector
          kind={responseTab}
          text={responseTab === "body" ? formattedResponseBody : responseHeaderText}
          headers={response.headers}
        />
      </section>
    {/if}

    {#if response && responseDiff}
      <section class="card overflow-hidden">
        <div class="flex flex-wrap items-center gap-3 border-b px-4 py-3">
          <span class="font-semibold">与场景基线对比</span>
          <span class={responseDiff.statusChanged ? "text-sm font-semibold text-amber-600 dark:text-amber-400" : "text-sm text-emerald-600 dark:text-emerald-400"}>
            状态码{responseDiff.statusChanged ? "有变化" : "未变化"}
          </span>
          <span class="text-sm text-muted-foreground">
            耗时 {responseDiff.durationDeltaMs >= 0 ? "+" : ""}{responseDiff.durationDeltaMs} ms
          </span>
          <span class="text-sm text-muted-foreground">
            Body {responseDiff.bodyChanged ? `${responseDiff.items.length} 处变化` : "无变化"}
          </span>
          <button class="btn ml-auto" onclick={updateActiveBaseline}>更新为当前基线</button>
        </div>
        <div class="max-h-80 overflow-auto p-3">
          {#if !responseDiff.bodyChanged}
            <div class="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">响应 Body 与基线一致</div>
          {:else}
            <div class="space-y-2">
              {#each responseDiff.items.slice(0, 100) as item}
                <article class="grid gap-2 rounded-lg border p-2 text-xs md:grid-cols-[90px_minmax(160px,0.7fr)_minmax(180px,1fr)_minmax(180px,1fr)]">
                  <span class={diffKindTone(item.kind)}>{diffKindLabel(item.kind)}</span>
                  <code class="break-all">{item.path}</code>
                  <pre class="max-h-24 overflow-auto whitespace-pre-wrap break-all text-muted-foreground">{diffValueText(item.before)}</pre>
                  <pre class="max-h-24 overflow-auto whitespace-pre-wrap break-all">{diffValueText(item.after)}</pre>
                </article>
              {/each}
              {#if responseDiff.items.length > 100}
                <div class="text-center text-xs text-muted-foreground">仅展示前 100 条，共 {responseDiff.items.length} 条变化</div>
              {/if}
            </div>
          {/if}
        </div>
      </section>
    {/if}

    {#if mockDraft}
      <section class="card overflow-hidden">
        <div class="flex flex-wrap items-center gap-2 border-b px-4 py-3">
          <span class="font-semibold">Mock 工作区</span>
          <span class="rounded-md bg-[var(--surface-2)] px-2 py-0.5 font-mono text-xs">{mockDraft.method} {mockDraft.path}</span>
          <span class="text-xs text-muted-foreground">{mockDraft.mode === "fixed" ? "固定真实响应" : "Schema 生成响应"}</span>
          <button class="btn ml-auto text-xs" onclick={() => (mockDraft = null)}>关闭</button>
        </div>
        <div class="space-y-4 p-4">
          <div class="grid gap-3 md:grid-cols-4">
            <label class="space-y-1 text-xs text-muted-foreground">
              Method
              <select class="input h-9 text-sm" bind:value={mockDraft.method}>
                {#each ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as item}<option value={item}>{item}</option>{/each}
              </select>
            </label>
            <label class="space-y-1 text-xs text-muted-foreground md:col-span-2">
              Path
              <input class="input h-9 font-mono text-sm" bind:value={mockDraft.path} />
            </label>
            <label class="space-y-1 text-xs text-muted-foreground">
              状态码
              <input class="input h-9 text-sm" type="number" min="100" max="599" bind:value={mockDraft.status} />
            </label>
            <label class="space-y-1 text-xs text-muted-foreground">
              延迟（ms）
              <input class="input h-9 text-sm" type="number" min="0" max="60000" bind:value={mockDraft.delayMs} />
            </label>
            <label class="space-y-1 text-xs text-muted-foreground">
              数组生成长度
              <input class="input h-9 text-sm" type="number" min="1" max="100" bind:value={mockDraft.arrayLength} disabled={!mockDraft.schema} />
            </label>
            <div class="flex items-end gap-2 md:col-span-2">
              <button class="btn btn-primary" onclick={generateMockDraft} disabled={!mockDraft.schema}>按 Schema 生成</button>
              <button class="btn" onclick={restoreMockDraft}>恢复真实响应</button>
              <button class="btn" onclick={formatMockBody}>格式化 JSON</button>
            </div>
          </div>
          {#if !mockDraft.schema}
            <div class="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
              当前真实响应不是 JSON，仅支持固定文本 Mock。
            </div>
          {/if}
          {#if mockError}
            <div class="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">{mockError}</div>
          {/if}
          <textarea class="input h-80 resize-y font-mono text-sm" bind:value={mockDraft.body} spellcheck="false"></textarea>
          <div class="overflow-hidden rounded-xl border">
            <div class="flex items-center gap-1 border-b px-3 pt-2">
              {#each ([
                ["body", "Mock Body"],
                ["msw", "MSW Handler"],
                ["definition", "Mock 定义 JSON"],
              ] as [MockOutputTab, string][]) as tab}
                <button
                  class="rounded-t-lg px-3 py-2 text-sm font-medium"
                  class:bg-[var(--surface-2)]={mockOutputTab === tab[0]}
                  onclick={() => (mockOutputTab = tab[0])}
                >
                  {tab[1]}
                </button>
              {/each}
              <button
                class="btn ml-auto mb-2 inline-flex items-center gap-1.5"
                onclick={() => copyText(`mock-${mockOutputTab}`, mockOutputText)}
              >
                <Copy size={14} />
                {copied === `mock-${mockOutputTab}` ? "已复制" : "复制当前输出"}
              </button>
            </div>
            <textarea
              class="min-h-64 w-full resize-y rounded-none border-0 bg-transparent p-4 font-mono text-sm"
              readonly
              value={mockOutputText}
              spellcheck="false"
            ></textarea>
          </div>
        </div>
      </section>
    {/if}
  {/if}
</div>

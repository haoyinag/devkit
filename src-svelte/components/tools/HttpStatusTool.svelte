<script lang="ts">
  type Category = "1xx" | "2xx" | "3xx" | "4xx" | "5xx";
  type StatusCode = { code: number; name: string; description: string; suggestion: string };
  const CATEGORY_META: Record<Category, { label: string; border: string; text: string; bg: string }> = {
    "1xx": { label: "1xx 信息", border: "border-l-blue-500", text: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10 text-blue-700 dark:text-blue-300" },
    "2xx": { label: "2xx 成功", border: "border-l-green-500", text: "text-green-600 dark:text-green-400", bg: "bg-green-500/10 text-green-700 dark:text-green-300" },
    "3xx": { label: "3xx 重定向", border: "border-l-yellow-500", text: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-300" },
    "4xx": { label: "4xx 客户端错误", border: "border-l-orange-500", text: "text-orange-600 dark:text-orange-400", bg: "bg-orange-500/10 text-orange-700 dark:text-orange-300" },
    "5xx": { label: "5xx 服务器错误", border: "border-l-red-500", text: "text-red-600 dark:text-red-400", bg: "bg-red-500/10 text-red-700 dark:text-red-300" },
  };
  const STATUS_CODES: StatusCode[] = [
    { code: 100, name: "Continue", description: "继续", suggestion: "客户端应继续发送请求体。" },
    { code: 200, name: "OK", description: "成功", suggestion: "请求成功，前端正常处理响应数据。" },
    { code: 201, name: "Created", description: "已创建", suggestion: "资源创建成功，常见于 POST 请求。" },
    { code: 204, name: "No Content", description: "无内容", suggestion: "请求成功但无返回体，常见于 DELETE。" },
    { code: 301, name: "Moved Permanently", description: "永久重定向", suggestion: "资源已永久移动，更新书签和链接。" },
    { code: 302, name: "Found", description: "临时重定向", suggestion: "资源临时移动，保持原 URL。" },
    { code: 304, name: "Not Modified", description: "未修改", suggestion: "资源未变化，使用缓存。" },
    { code: 400, name: "Bad Request", description: "请求错误", suggestion: "检查请求参数格式是否正确。" },
    { code: 401, name: "Unauthorized", description: "未认证", suggestion: "跳转登录页或刷新 Token。" },
    { code: 403, name: "Forbidden", description: "禁止访问", suggestion: "用户无权限，显示无权限提示。" },
    { code: 404, name: "Not Found", description: "未找到", suggestion: "资源不存在，显示 404 页面。" },
    { code: 405, name: "Method Not Allowed", description: "方法不允许", suggestion: "检查 HTTP 方法是否正确。" },
    { code: 422, name: "Unprocessable Entity", description: "无法处理", suggestion: "表单验证失败，显示字段错误。" },
    { code: 429, name: "Too Many Requests", description: "请求过多", suggestion: "触发限流，提示稍后重试。" },
    { code: 500, name: "Internal Server Error", description: "服务器内部错误", suggestion: "显示通用错误提示，建议稍后重试。" },
    { code: 502, name: "Bad Gateway", description: "网关错误", suggestion: "服务器上游问题，提示稍后重试。" },
    { code: 503, name: "Service Unavailable", description: "服务不可用", suggestion: "服务器维护中，显示维护页面。" },
    { code: 504, name: "Gateway Timeout", description: "网关超时", suggestion: "上游响应超时，提示稍后重试。" },
  ];
  const ALL_CATEGORIES: Category[] = ["1xx", "2xx", "3xx", "4xx", "5xx"];
  const getCategory = (code: number): Category => (code < 200 ? "1xx" : code < 300 ? "2xx" : code < 400 ? "3xx" : code < 500 ? "4xx" : "5xx");

  let search = $state("");
  let activeCategories = $state<Set<Category>>(new Set(ALL_CATEGORIES));
  let expandedCode = $state<number | null>(null);

  const filtered = $derived.by(() => {
    const q = search.trim().toLowerCase();
    return STATUS_CODES.filter((s) => {
      if (!activeCategories.has(getCategory(s.code))) return false;
      if (!q) return true;
      return String(s.code).includes(q) || s.name.toLowerCase().includes(q) || s.description.includes(q) || s.suggestion.includes(q);
    });
  });
  const toggleCategory = (cat: Category) => {
    const next = new Set(activeCategories);
    if (next.has(cat)) next.delete(cat);
    else next.add(cat);
    activeCategories = next;
  };
</script>

<div class="flex h-full flex-col overflow-y-auto p-5">
  <h1 class="mb-4 text-lg font-semibold">HTTP 状态码速查</h1>
  <input type="text" class="input mb-4 h-9 text-sm" placeholder="搜索状态码、名称或描述…" bind:value={search} spellcheck="false" />
  <div class="mb-4 flex flex-wrap gap-2">
    {#each ALL_CATEGORIES as cat}
      {@const meta = CATEGORY_META[cat]}
      {@const active = activeCategories.has(cat)}
      <button class={`rounded-lg border px-3 py-1 text-xs font-medium transition-colors ${active ? `${meta.bg} border-transparent` : "border-border bg-muted/40 text-muted-foreground"}`} onclick={() => toggleCategory(cat)}>{meta.label}</button>
    {/each}
  </div>
  <div class="min-h-0 flex-1 space-y-2 overflow-y-auto">
    {#if filtered.length === 0}
      <p class="py-8 text-center text-sm text-muted-foreground">没有匹配的状态码</p>
    {:else}
      {#each filtered as s}
        {@const cat = getCategory(s.code)}
        {@const meta = CATEGORY_META[cat]}
        {@const expanded = expandedCode === s.code}
        <button class={`flex w-full cursor-pointer items-start gap-4 rounded-lg border border-border border-l-4 ${meta.border} bg-card p-4 text-left transition-colors hover:bg-muted/50`} onclick={() => (expandedCode = expanded ? null : s.code)}>
          <span class={`font-mono text-2xl font-bold ${meta.text}`}>{s.code}</span>
          <span class="min-w-0 flex-1">
            <span class="flex items-center gap-2"><span class="font-medium">{s.name}</span><span class="rounded bg-muted px-2 py-0.5 text-xs">{s.description}</span></span>
            {#if expanded}<p class="mt-2 text-sm text-muted-foreground"><span class="font-medium text-foreground">前端处理：</span>{s.suggestion}</p>{/if}
          </span>
          <span class="mt-1.5 shrink-0 text-muted-foreground">{expanded ? "▴" : "▾"}</span>
        </button>
      {/each}
    {/if}
  </div>
</div>

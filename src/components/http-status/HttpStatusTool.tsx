import { useState, useCallback, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Search, ChevronDown, ChevronUp } from "lucide-react";

interface StatusCode {
  code: number;
  name: string;
  description: string;
  suggestion: string;
}

type Category = "1xx" | "2xx" | "3xx" | "4xx" | "5xx";

const CATEGORY_META: Record<
  Category,
  { label: string; border: string; text: string; bg: string }
> = {
  "1xx": {
    label: "1xx 信息",
    border: "border-l-blue-500",
    text: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  },
  "2xx": {
    label: "2xx 成功",
    border: "border-l-green-500",
    text: "text-green-600 dark:text-green-400",
    bg: "bg-green-500/10 text-green-700 dark:text-green-300",
  },
  "3xx": {
    label: "3xx 重定向",
    border: "border-l-yellow-500",
    text: "text-yellow-600 dark:text-yellow-400",
    bg: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-300",
  },
  "4xx": {
    label: "4xx 客户端错误",
    border: "border-l-orange-500",
    text: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-500/10 text-orange-700 dark:text-orange-300",
  },
  "5xx": {
    label: "5xx 服务器错误",
    border: "border-l-red-500",
    text: "text-red-600 dark:text-red-400",
    bg: "bg-red-500/10 text-red-700 dark:text-red-300",
  },
};

const STATUS_CODES: StatusCode[] = [
  { code: 100, name: "Continue", description: "继续", suggestion: "客户端应继续发送请求体。" },
  { code: 101, name: "Switching Protocols", description: "切换协议", suggestion: "服务器同意切换协议（如 WebSocket）。" },

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
  { code: 408, name: "Request Timeout", description: "请求超时", suggestion: "提示用户重试。" },
  { code: 409, name: "Conflict", description: "冲突", suggestion: "数据冲突，提示用户刷新后重试。" },
  { code: 413, name: "Payload Too Large", description: "请求体过大", suggestion: "检查上传文件大小限制。" },
  { code: 415, name: "Unsupported Media Type", description: "不支持的媒体类型", suggestion: "检查 Content-Type。" },
  { code: 422, name: "Unprocessable Entity", description: "无法处理", suggestion: "表单验证失败，显示字段错误。" },
  { code: 429, name: "Too Many Requests", description: "请求过多", suggestion: "触发限流，提示稍后重试。" },

  { code: 500, name: "Internal Server Error", description: "服务器内部错误", suggestion: "显示通用错误提示，建议稍后重试。" },
  { code: 502, name: "Bad Gateway", description: "网关错误", suggestion: "服务器上游问题，提示稍后重试。" },
  { code: 503, name: "Service Unavailable", description: "服务不可用", suggestion: "服务器维护中，显示维护页面。" },
  { code: 504, name: "Gateway Timeout", description: "网关超时", suggestion: "上游响应超时，提示稍后重试。" },
];

function getCategory(code: number): Category {
  if (code < 200) return "1xx";
  if (code < 300) return "2xx";
  if (code < 400) return "3xx";
  if (code < 500) return "4xx";
  return "5xx";
}

const ALL_CATEGORIES: Category[] = ["1xx", "2xx", "3xx", "4xx", "5xx"];

export function HttpStatusTool() {
  const [search, setSearch] = useState("");
  const [activeCategories, setActiveCategories] = useState<Set<Category>>(
    () => new Set(ALL_CATEGORIES)
  );
  const [expandedCode, setExpandedCode] = useState<number | null>(null);

  const toggleCategory = useCallback((cat: Category) => {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  }, []);

  const toggleExpand = useCallback((code: number) => {
    setExpandedCode((prev) => (prev === code ? null : code));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return STATUS_CODES.filter((s) => {
      if (!activeCategories.has(getCategory(s.code))) return false;
      if (!q) return true;
      return (
        String(s.code).includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.description.includes(q) ||
        s.suggestion.includes(q)
      );
    });
  }, [search, activeCategories]);

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      <h1 className="mb-4 text-lg font-semibold">HTTP 状态码速查</h1>

      <div className="relative mb-4">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="搜索状态码、名称或描述…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          spellCheck={false}
          className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/50"
        />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {ALL_CATEGORIES.map((cat) => {
          const meta = CATEGORY_META[cat];
          const active = activeCategories.has(cat);
          return (
            <button
              key={cat}
              onClick={() => toggleCategory(cat)}
              className={`rounded-lg border px-3 py-1 text-xs font-medium transition-colors ${
                active
                  ? `${meta.bg} border-transparent`
                  : "border-border bg-muted/40 text-muted-foreground"
              }`}
            >
              {meta.label}
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            没有匹配的状态码
          </p>
        ) : (
          filtered.map((s) => {
            const cat = getCategory(s.code);
            const meta = CATEGORY_META[cat];
            const expanded = expandedCode === s.code;

            return (
              <button
                key={s.code}
                onClick={() => toggleExpand(s.code)}
                className={`flex w-full cursor-pointer items-start gap-4 rounded-lg border border-border border-l-4 ${meta.border} bg-card p-4 text-left transition-colors hover:bg-muted/50`}
              >
                <span className={`font-mono text-2xl font-bold ${meta.text}`}>
                  {s.code}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{s.name}</span>
                    <Badge variant="secondary" className="shrink-0">
                      {s.description}
                    </Badge>
                  </div>

                  {expanded && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">
                        前端处理：
                      </span>
                      {s.suggestion}
                    </p>
                  )}
                </div>

                {expanded ? (
                  <ChevronUp className="mt-1.5 size-4 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronDown className="mt-1.5 size-4 shrink-0 text-muted-foreground" />
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

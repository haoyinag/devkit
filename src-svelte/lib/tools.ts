import type { Page } from "@/types";

export interface ToolInfo {
  id: Page;
  label: string;
  description: string;
  keywords: string[];
}

export interface ToolCategory {
  id: string;
  label: string;
  tools: ToolInfo[];
}

export const TOOL_CATEGORIES: ToolCategory[] = [
  {
    id: "cursor",
    label: "Cursor",
    tools: [
      { id: "cursor-rules", label: "Cursor Rules", description: "查看 Cursor 规则配置文件", keywords: ["cursor", "rules", "规则", "mdc", "配置", "工作区"] },
    ],
  },
  {
    id: "workflow",
    label: "工作流",
    tools: [
      {
        id: "git-push",
        label: "Git 推送助手",
        description: "专注提交与推送：pull、暂存、commit、push",
        keywords: ["git", "push", "提交", "推送", "rebase", "autostash", "暂存", "工作流", "桌面", "gui"],
      },
      {
        id: "git-branch",
        label: "Git 分支助手",
        description: "专注分支管理：查看、新建、切换、远程跟踪",
        keywords: ["git", "branch", "分支", "切换", "新建", "远程", "origin", "工作流", "桌面", "gui"],
      },
      {
        id: "git-cheatsheet",
        label: "Git 速查",
        description: "常用 Git 命令与组合说明（含示例）",
        keywords: ["git", "速查", "命令", "cheatsheet", "commit", "push", "pull", "rebase", "merge", "stash", "工作流"],
      },
    ],
  },
  {
    id: "docs",
    label: "文档",
    tools: [
      {
        id: "markdown-doc",
        label: "Markdown 文档",
        description: "编辑与预览，适合 README、接口说明、笔记",
        keywords: ["markdown", "md", "文档", "笔记", "readme", "编辑", "预览", "gfm"],
      },
    ],
  },
  {
    id: "converters",
    label: "转换器",
    tools: [
      { id: "base64", label: "Base64", description: "Base64 编码与解码", keywords: ["base64", "编码", "解码", "encode", "decode"] },
      { id: "url", label: "URL 编解码", description: "URL 百分号编码与解码", keywords: ["url", "编码", "解码", "percent", "encode", "query"] },
      { id: "jwt", label: "JWT 解码", description: "解析 JWT Token", keywords: ["jwt", "token", "解码", "json web token", "bearer"] },
      { id: "css-unit", label: "CSS 单位", description: "px / rem / vw 互转", keywords: ["css", "px", "rem", "em", "vw", "单位", "转换", "responsive"] },
      { id: "number-base", label: "进制转换", description: "二/八/十/十六进制互转", keywords: ["进制", "二进制", "十六进制", "hex", "binary", "octal", "chmod"] },
    ],
  },
  {
    id: "formatters",
    label: "格式化 & 对比",
    tools: [
      { id: "json", label: "JSON 工具", description: "格式化 / 压缩 / 路径取值", keywords: ["json", "格式化", "format", "压缩", "minify", "路径", "tree"] },
      { id: "diff", label: "Diff 对比", description: "文本 / JSON 差异对比", keywords: ["diff", "对比", "compare", "差异", "merge"] },
    ],
  },
  {
    id: "generators",
    label: "生成器",
    tools: [
      { id: "uuid", label: "UUID 生成", description: "批量生成 UUID v4", keywords: ["uuid", "生成", "generate", "唯一", "id"] },
      { id: "hash", label: "Hash 计算", description: "MD5 / SHA 哈希计算", keywords: ["hash", "md5", "sha", "哈希", "摘要", "digest"] },
      { id: "mock", label: "Mock 生成", description: "JSON → Schema → Mock 数据", keywords: ["mock", "模拟", "数据", "schema", "faker", "生成"] },
      {
        id: "ts-type-generator",
        label: "TS 类型生成",
        description: "粘贴文档片段生成 TypeScript 类型定义",
        keywords: ["typescript", "type", "interface", "schema", "swagger", "openapi", "类型", "生成"],
      },
    ],
  },
  {
    id: "text",
    label: "文本工具",
    tools: [
      { id: "regex", label: "正则测试", description: "正则表达式匹配高亮", keywords: ["regex", "正则", "regular expression", "匹配", "pattern"] },
      { id: "text", label: "文本处理", description: "大小写 / 去重 / 转义 / 统计", keywords: ["文本", "text", "大小写", "去重", "排序", "转义", "unicode", "html"] },
    ],
  },
  {
    id: "visual",
    label: "视觉工具",
    tools: [
      { id: "color", label: "颜色工具", description: "取色 / HEX·RGB·HSL 互转 / 对比度", keywords: ["颜色", "color", "hex", "rgb", "hsl", "取色", "picker", "contrast"] },
      { id: "image", label: "图片工具", description: "Base64 / 尺寸 / 格式转换", keywords: ["图片", "image", "base64", "压缩", "webp", "尺寸"] },
    ],
  },
  {
    id: "time",
    label: "时间工具",
    tools: [
      { id: "time", label: "时间工具", description: "时间戳转换 / 时间差 / 范围", keywords: ["时间", "time", "时间戳", "timestamp", "转换", "范围"] },
      { id: "cron", label: "Cron 解析", description: "Cron 表达式解读与预览", keywords: ["cron", "定时", "计划", "schedule", "表达式"] },
    ],
  },
  {
    id: "reference",
    label: "速查手册",
    tools: [
      { id: "http-status", label: "HTTP 状态码", description: "HTTP 状态码含义速查", keywords: ["http", "状态码", "status", "code", "404", "500", "200"] },
    ],
  },
];

export const ALL_TOOLS: ToolInfo[] = TOOL_CATEGORIES.flatMap((c) => c.tools);

export function searchTools(query: string): ToolInfo[] {
  if (!query.trim()) return ALL_TOOLS;
  const q = query.toLowerCase();
  return ALL_TOOLS.filter(
    (t) =>
      t.label.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.keywords.some((k) => k.includes(q)),
  );
}

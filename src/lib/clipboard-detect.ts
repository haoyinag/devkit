import type { Page } from "@/types";

export type DetectedType =
  | "json"
  | "jwt"
  | "uuid"
  | "timestamp"
  | "url-encoded"
  | "base64"
  | "color"
  | "cron"
  | "unknown";

export interface Detection {
  type: DetectedType;
  confidence: "high" | "medium";
  tool: Page;
  label: string;
}

const TOOL_MAP: Record<Exclude<DetectedType, "unknown">, { tool: Page; label: string }> = {
  json: { tool: "json", label: "JSON 工具" },
  jwt: { tool: "jwt", label: "JWT 解码" },
  uuid: { tool: "uuid", label: "UUID 工具" },
  timestamp: { tool: "time", label: "时间工具" },
  "url-encoded": { tool: "url", label: "URL 解码" },
  base64: { tool: "base64", label: "Base64 解码" },
  color: { tool: "color", label: "颜色工具" },
  cron: { tool: "cron", label: "Cron 解析" },
};

function looksLikeJson(t: string): boolean {
  return (
    ((t.startsWith("{") && t.endsWith("}")) ||
     (t.startsWith("[") && t.endsWith("]"))) &&
    t.length >= 2
  );
}

export function detectContent(text: string): Detection | null {
  const t = text.trim();
  if (!t || t.length > 1_000_000) return null;

  if (looksLikeJson(t)) {
    try {
      JSON.parse(t);
      return { type: "json", confidence: "high", ...TOOL_MAP.json };
    } catch {
      if (t.includes(":") || t.includes(",")) {
        return { type: "json", confidence: "medium", ...TOOL_MAP.json };
      }
    }
  }

  const jwtParts = t.split(".");
  if (
    jwtParts.length === 3 &&
    jwtParts.every((p) => /^[A-Za-z0-9_-]+$/.test(p)) &&
    jwtParts[0].length > 10
  ) {
    try {
      const header = JSON.parse(atob(jwtParts[0].replace(/-/g, "+").replace(/_/g, "/")));
      if (header && typeof header === "object" && ("alg" in header || "typ" in header)) {
        return { type: "jwt", confidence: "high", ...TOOL_MAP.jwt };
      }
    } catch {
      /* not jwt */
    }
  }

  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t)) {
    return { type: "uuid", confidence: "high", ...TOOL_MAP.uuid };
  }

  if (/^\d{10}$/.test(t) || /^\d{13}$/.test(t)) {
    return { type: "timestamp", confidence: "high", ...TOOL_MAP.timestamp };
  }

  if (/^#([0-9a-fA-F]{3}){1,2}$/.test(t) || /^rgb\(\s*\d/.test(t) || /^hsl\(\s*\d/.test(t)) {
    return { type: "color", confidence: "high", ...TOOL_MAP.color };
  }

  const cronFields = t.split(/\s+/);
  if (
    (cronFields.length === 5 || cronFields.length === 6) &&
    cronFields.every((f) => /^[\d,\-\*\/]+$/.test(f))
  ) {
    return { type: "cron", confidence: "medium", ...TOOL_MAP.cron };
  }

  if (/%[0-9A-Fa-f]{2}/.test(t) && /[=&?]/.test(t)) {
    return { type: "url-encoded", confidence: "medium", ...TOOL_MAP["url-encoded"] };
  }

  if (/^[A-Za-z0-9+/]{4,}={0,2}$/.test(t) && t.length >= 8) {
    try {
      const decoded = atob(t);
      if (decoded.length > 0) {
        return { type: "base64", confidence: "medium", ...TOOL_MAP.base64 };
      }
    } catch {
      /* not base64 */
    }
  }

  return null;
}

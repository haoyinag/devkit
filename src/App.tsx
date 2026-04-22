import { useState, useCallback, lazy, Suspense } from "react";
import { ErrorBoundary } from "@/components/layout/ErrorBoundary";
import { Sidebar } from "@/components/layout/Sidebar";
import { Dashboard } from "@/components/home/Dashboard";
import { useTheme } from "@/hooks/useTheme";
import { useRecentTools } from "@/hooks/useRecentTools";
import { PERF_LOG_STORAGE_KEY, usePerfDiagnostics } from "@/hooks/usePerfDiagnostics";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Loader2 } from "lucide-react";
import type { Page } from "@/types";

const JsonFormatter = lazy(() => import("@/components/json/JsonFormatter").then((m) => ({ default: m.JsonFormatter })));
const Base64Tool = lazy(() => import("@/components/base64/Base64Tool").then((m) => ({ default: m.Base64Tool })));
const UrlTool = lazy(() => import("@/components/url/UrlTool").then((m) => ({ default: m.UrlTool })));
const JwtDecoder = lazy(() => import("@/components/jwt/JwtDecoder").then((m) => ({ default: m.JwtDecoder })));
const UuidGenerator = lazy(() => import("@/components/uuid/UuidGenerator").then((m) => ({ default: m.UuidGenerator })));
const HashGenerator = lazy(() => import("@/components/hash/HashGenerator").then((m) => ({ default: m.HashGenerator })));
const RegexTester = lazy(() => import("@/components/regex/RegexTester").then((m) => ({ default: m.RegexTester })));
const TimeTools = lazy(() => import("@/components/time/TimeTools").then((m) => ({ default: m.TimeTools })));
const ColorTool = lazy(() => import("@/components/color/ColorTool").then((m) => ({ default: m.ColorTool })));
const DiffTool = lazy(() => import("@/components/diff/DiffTool").then((m) => ({ default: m.DiffTool })));
const TextTool = lazy(() => import("@/components/text/TextTool").then((m) => ({ default: m.TextTool })));
const CssUnitConverter = lazy(() => import("@/components/css-unit/CssUnitConverter").then((m) => ({ default: m.CssUnitConverter })));
const CronTool = lazy(() => import("@/components/cron/CronTool").then((m) => ({ default: m.CronTool })));
const NumberBaseTool = lazy(() => import("@/components/number-base/NumberBaseTool").then((m) => ({ default: m.NumberBaseTool })));
const HttpStatusTool = lazy(() => import("@/components/http-status/HttpStatusTool").then((m) => ({ default: m.HttpStatusTool })));
const ImageTool = lazy(() => import("@/components/image/ImageTool").then((m) => ({ default: m.ImageTool })));
const MockTool = lazy(() => import("@/components/mock/MockTool").then((m) => ({ default: m.MockTool })));
const CursorRulesTool = lazy(() => import("@/components/cursor-rules/CursorRulesTool").then((m) => ({ default: m.CursorRulesTool })));
const MarkdownDocTool = lazy(() => import("@/components/markdown-doc/MarkdownDocTool").then((m) => ({ default: m.MarkdownDocTool })));
const GitPushTool = lazy(() => import("@/components/git-push/GitPushTool").then((m) => ({ default: m.GitPushTool })));
const GitBranchTool = lazy(() => import("@/components/git-push/GitBranchTool").then((m) => ({ default: m.GitBranchTool })));
const GitCheatsheetTool = lazy(() => import("@/components/git-cheatsheet/GitCheatsheetTool").then((m) => ({ default: m.GitCheatsheetTool })));

function LazyFallback() {
  return (
    <div className="flex h-full items-center justify-center">
      <Loader2 size={24} className="animate-spin text-muted-foreground" />
    </div>
  );
}

function App() {
  const [activePage, setActivePage] = useState<Page>("home");
  const [initialContent, setInitialContent] = useState("");
  const { theme, toggleTheme } = useTheme();
  const { recent, recordUsage } = useRecentTools();
  const [perfLogEnabled, setPerfLogEnabled] = useState(() => {
    return localStorage.getItem(PERF_LOG_STORAGE_KEY) === "true";
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem("devkit-sidebar-collapsed") === "true";
  });

  usePerfDiagnostics(activePage, perfLogEnabled);

  const handleNavigate = useCallback(
    (page: Page, content?: string) => {
      setActivePage(page);
      setInitialContent(content ?? "");
      recordUsage(page);
    },
    [recordUsage],
  );

  const handleToggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("devkit-sidebar-collapsed", String(next));
      return next;
    });
  }, []);

  const handlePerfLogChange = useCallback((enabled: boolean) => {
    setPerfLogEnabled(enabled);
    localStorage.setItem(PERF_LOG_STORAGE_KEY, String(enabled));
  }, []);

  return (
    <TooltipProvider>
      <div className="flex h-screen min-w-[640px] overflow-hidden bg-background text-foreground">
        <Sidebar
          activePage={activePage}
          onNavigate={handleNavigate}
          recent={recent}
          theme={theme}
          onToggleTheme={toggleTheme}
          collapsed={sidebarCollapsed}
          onToggleCollapse={handleToggleSidebar}
          perfLogEnabled={perfLogEnabled}
          onPerfLogChange={handlePerfLogChange}
        />
        <main className="min-h-0 min-w-0 flex-1 overflow-auto">
          <ErrorBoundary resetKey={activePage}>
            {activePage === "home" && <Dashboard recent={recent} onNavigate={handleNavigate} />}
            {activePage !== "home" && (
              <Suspense fallback={<LazyFallback />}>
                {activePage === "json" && <JsonFormatter initialContent={initialContent} />}
                {activePage === "base64" && <Base64Tool initialContent={initialContent} />}
                {activePage === "url" && <UrlTool initialContent={initialContent} />}
                {activePage === "jwt" && <JwtDecoder initialContent={initialContent} />}
                {activePage === "uuid" && <UuidGenerator />}
                {activePage === "hash" && <HashGenerator />}
                {activePage === "regex" && <RegexTester />}
                {activePage === "time" && <TimeTools />}
                {activePage === "color" && <ColorTool />}
                {activePage === "diff" && <DiffTool />}
                {activePage === "text" && <TextTool />}
                {activePage === "css-unit" && <CssUnitConverter />}
                {activePage === "cron" && <CronTool />}
                {activePage === "number-base" && <NumberBaseTool />}
                {activePage === "http-status" && <HttpStatusTool />}
                {activePage === "image" && <ImageTool />}
                {activePage === "mock" && <MockTool />}
                {activePage === "cursor-rules" && <CursorRulesTool />}
                {activePage === "markdown-doc" && <MarkdownDocTool initialContent={initialContent} />}
                {activePage === "git-push" && <GitPushTool />}
                {activePage === "git-branch" && <GitBranchTool />}
                {activePage === "git-cheatsheet" && <GitCheatsheetTool />}
              </Suspense>
            )}
          </ErrorBoundary>
        </main>
      </div>
    </TooltipProvider>
  );
}

export default App;

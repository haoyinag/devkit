import { useState, useCallback } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Dashboard } from "@/components/home/Dashboard";
import { JsonFormatter } from "@/components/json/JsonFormatter";
import { Base64Tool } from "@/components/base64/Base64Tool";
import { UrlTool } from "@/components/url/UrlTool";
import { JwtDecoder } from "@/components/jwt/JwtDecoder";
import { UuidGenerator } from "@/components/uuid/UuidGenerator";
import { HashGenerator } from "@/components/hash/HashGenerator";
import { RegexTester } from "@/components/regex/RegexTester";
import { TimeTools } from "@/components/time/TimeTools";
import { ColorTool } from "@/components/color/ColorTool";
import { DiffTool } from "@/components/diff/DiffTool";
import { TextTool } from "@/components/text/TextTool";
import { CssUnitConverter } from "@/components/css-unit/CssUnitConverter";
import { CronTool } from "@/components/cron/CronTool";
import { NumberBaseTool } from "@/components/number-base/NumberBaseTool";
import { HttpStatusTool } from "@/components/http-status/HttpStatusTool";
import { ImageTool } from "@/components/image/ImageTool";
import { MockTool } from "@/components/mock/MockTool";
import { CursorRulesTool } from "@/components/cursor-rules/CursorRulesTool";
import { useTheme } from "@/hooks/useTheme";
import { useRecentTools } from "@/hooks/useRecentTools";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { Page } from "@/types";

function App() {
  const [activePage, setActivePage] = useState<Page>("home");
  const [initialContent, setInitialContent] = useState("");
  const { theme, toggleTheme } = useTheme();
  const { recent, recordUsage } = useRecentTools();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem("devkit-sidebar-collapsed") === "true";
  });

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
        />
        <main className="min-h-0 min-w-0 flex-1 overflow-auto">
          {activePage === "home" && <Dashboard recent={recent} onNavigate={handleNavigate} />}
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
        </main>
      </div>
    </TooltipProvider>
  );
}

export default App;

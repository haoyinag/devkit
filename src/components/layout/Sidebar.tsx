import { useState, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./ThemeToggle";
import { TOOL_CATEGORIES, ALL_TOOLS, searchTools, type ToolInfo } from "@/lib/tools";
import type { Page } from "@/types";
import {
  LayoutDashboard, Braces, Binary, Link2, KeyRound,
  Fingerprint, Hash, Regex, Clock, Search, ChevronDown,
  PanelLeftClose, PanelLeftOpen, Sun, Moon, Activity,
  Palette, GitCompareArrows, Type, Ruler, Timer,
  Calculator, Globe, Image, Database, X, ScrollText, NotebookPen, GitBranch, Upload, BookOpen,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const ICON_MAP: Record<string, React.ElementType> = {
  home: LayoutDashboard, json: Braces, base64: Binary, url: Link2,
  jwt: KeyRound, uuid: Fingerprint, hash: Hash, regex: Regex, time: Clock,
  color: Palette, diff: GitCompareArrows, text: Type,
  "css-unit": Ruler, cron: Timer, "number-base": Calculator,
  "http-status": Globe, image: Image, mock: Database,
  "cursor-rules": ScrollText,
  "markdown-doc": NotebookPen,
  "git-push": Upload,
  "git-branch": GitBranch,
  "git-cheatsheet": BookOpen,
};

function NavBtn({
  id, label, activePage, collapsed, onNavigate,
}: {
  id: Page; label: string; activePage: Page; collapsed: boolean; onNavigate: (page: Page) => void;
}) {
  const Icon = ICON_MAP[id] || LayoutDashboard;
  return (
    <button
      onClick={() => onNavigate(id)}
      title={collapsed ? label : undefined}
      className={cn(
        "group/nav relative flex w-full items-center overflow-hidden rounded-lg text-sm font-medium transition-all",
        collapsed ? "justify-center px-2 py-2" : "gap-2.5 px-3 py-2",
        activePage === id
          ? "bg-brand-gradient text-nav-active-foreground shadow-elev-1"
          : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
      )}
    >
      {activePage === id && (
        <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-nav-active-foreground/90" />
      )}
      <Icon size={16} className="shrink-0" />
      {!collapsed && label}
    </button>
  );
}

interface SidebarProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
  recent: string[];
  theme: "light" | "dark";
  onToggleTheme: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  perfLogEnabled: boolean;
  onPerfLogChange: (enabled: boolean) => void;
}

export function Sidebar({
  activePage, onNavigate, recent, theme, onToggleTheme,
  collapsed, onToggleCollapse, perfLogEnabled, onPerfLogChange,
}: SidebarProps) {
  const [query, setQuery] = useState("");
  const [catCollapsed, setCatCollapsed] = useState<Record<string, boolean>>({});

  const filteredTools = useMemo(() => searchTools(query), [query]);
  const isSearching = query.trim().length > 0;

  const recentTools = recent
    .map((id) => ALL_TOOLS.find((t) => t.id === id))
    .filter(Boolean) as ToolInfo[];

  const toggleCategory = useCallback((catId: string) => {
    setCatCollapsed((prev) => ({ ...prev, [catId]: !prev[catId] }));
  }, []);

  if (collapsed) {
    return (
      <aside className="bg-sidebar-gradient flex h-screen w-14 flex-col items-center border-r border-border/80 py-3 shadow-elev-1">
        <button
          onClick={onToggleCollapse}
          className="mb-3 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
          title="展开侧边栏"
        >
          <PanelLeftOpen size={16} />
        </button>

        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-1">
          <NavBtn id="home" label="首页" activePage={activePage} collapsed={collapsed} onNavigate={onNavigate} />
          {TOOL_CATEGORIES.flatMap((cat) => cat.tools).map((t) => (
            <NavBtn key={t.id} id={t.id} label={t.label} activePage={activePage} collapsed={collapsed} onNavigate={onNavigate} />
          ))}
        </nav>

        <button
          type="button"
          onClick={() => onPerfLogChange(!perfLogEnabled)}
          className={cn(
            "mt-2 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground",
            perfLogEnabled && "text-primary",
          )}
          title={perfLogEnabled ? "关闭性能日志（控制台）" : "开启性能日志（控制台）"}
        >
          <Activity size={16} />
        </button>
        <button
          type="button"
          onClick={onToggleTheme}
          className="mt-2 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
          title={theme === "dark" ? "亮色模式" : "暗色模式"}
        >
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </aside>
    );
  }

  return (
    <aside className="bg-sidebar-gradient flex h-screen w-64 flex-col border-r border-border/80 shadow-elev-1">
      <div className="space-y-4 px-4 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="bg-brand-gradient flex h-8 w-8 items-center justify-center rounded-xl text-primary-foreground shadow-elev-1">
              <Braces size={14} />
            </div>
            <div className="leading-tight">
              <h1 className="text-base font-semibold tracking-tight">DevKit</h1>
              <p className="text-[11px] text-muted-foreground">开发者工具箱</p>
            </div>
          </div>
          <button
            onClick={onToggleCollapse}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
            title="折叠侧边栏"
          >
            <PanelLeftClose size={14} />
          </button>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索工具..."
            className="w-full rounded-lg border border-border/80 bg-surface-2 py-2 pl-8 pr-7 text-sm placeholder:text-muted-foreground"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <nav className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 py-2">
        {isSearching ? (
          filteredTools.length > 0 ? (
            filteredTools.map((t) => <NavBtn key={t.id} id={t.id} label={t.label} activePage={activePage} collapsed={collapsed} onNavigate={onNavigate} />)
          ) : (
            <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted-foreground">无匹配工具</p>
          )
        ) : (
          <>
            <NavBtn id="home" label="首页" activePage={activePage} collapsed={collapsed} onNavigate={onNavigate} />

            {recentTools.length > 0 && (
              <div className="pt-2">
                <p className="px-2 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground">最近使用</p>
                {recentTools.map((t) => (
                  <NavBtn key={t.id} id={t.id} label={t.label} activePage={activePage} collapsed={collapsed} onNavigate={onNavigate} />
                ))}
              </div>
            )}

            {TOOL_CATEGORIES.map((cat) => (
              <div key={cat.id} className="pt-2">
                <button
                  onClick={() => toggleCategory(cat.id)}
                  className="flex w-full items-center justify-between rounded-md px-2 py-1 text-[11px] font-semibold tracking-wide text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
                >
                  {cat.label}
                  <ChevronDown
                    size={12}
                    className={cn("transition-transform", catCollapsed[cat.id] && "-rotate-90")}
                  />
                </button>
                {!catCollapsed[cat.id] &&
                  cat.tools.map((t) => <NavBtn key={t.id} id={t.id} label={t.label} activePage={activePage} collapsed={collapsed} onNavigate={onNavigate} />)}
              </div>
            ))}
          </>
        )}
      </nav>

      <div className="space-y-3 border-t border-border/80 bg-surface-2/60 p-3">
        <div className="flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-background/70 px-2 py-1.5">
          <Label htmlFor="devkit-perf-log" className="text-xs font-normal text-muted-foreground">
            性能日志
          </Label>
          <Switch
            id="devkit-perf-log"
            size="sm"
            checked={perfLogEnabled}
            onCheckedChange={onPerfLogChange}
          />
        </div>
        <p className="px-1 text-[10px] leading-snug text-muted-foreground">
          打开后每 3s 在开发者工具控制台输出内存与帧间隔；用于排查越用越卡（默认关闭）。
        </p>
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>
    </aside>
  );
}

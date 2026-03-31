import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./ThemeToggle";
import { TOOL_CATEGORIES, ALL_TOOLS, searchTools, type ToolInfo } from "@/lib/tools";
import type { Page } from "@/types";
import {
  LayoutDashboard, Braces, Binary, Link2, KeyRound,
  Fingerprint, Hash, Regex, Clock, Search, ChevronDown,
  PanelLeftClose, PanelLeftOpen, Sun, Moon,
  Palette, GitCompareArrows, Type, Ruler, Timer,
  Calculator, Globe, Image, Database, X, ScrollText,
} from "lucide-react";

const ICON_MAP: Record<string, React.ElementType> = {
  home: LayoutDashboard, json: Braces, base64: Binary, url: Link2,
  jwt: KeyRound, uuid: Fingerprint, hash: Hash, regex: Regex, time: Clock,
  color: Palette, diff: GitCompareArrows, text: Type,
  "css-unit": Ruler, cron: Timer, "number-base": Calculator,
  "http-status": Globe, image: Image, mock: Database,
  "cursor-rules": ScrollText,
};

interface SidebarProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
  recent: string[];
  theme: "light" | "dark";
  onToggleTheme: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function Sidebar({
  activePage, onNavigate, recent, theme, onToggleTheme,
  collapsed, onToggleCollapse,
}: SidebarProps) {
  const [query, setQuery] = useState("");
  const [catCollapsed, setCatCollapsed] = useState<Record<string, boolean>>({});

  const filteredTools = useMemo(() => searchTools(query), [query]);
  const isSearching = query.trim().length > 0;

  const recentTools = recent
    .map((id) => ALL_TOOLS.find((t) => t.id === id))
    .filter(Boolean) as ToolInfo[];

  const toggleCategory = (catId: string) => {
    setCatCollapsed((prev) => ({ ...prev, [catId]: !prev[catId] }));
  };

  const NavBtn = ({ id, label }: { id: Page; label: string }) => {
    const Icon = ICON_MAP[id] || LayoutDashboard;
    return (
      <button
        onClick={() => onNavigate(id)}
        title={collapsed ? label : undefined}
        className={cn(
          "flex w-full items-center rounded-md text-sm font-medium transition-colors",
          collapsed ? "justify-center px-2 py-2" : "gap-2.5 px-3 py-2",
          activePage === id
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        )}
      >
        <Icon size={16} className="shrink-0" />
        {!collapsed && label}
      </button>
    );
  };

  if (collapsed) {
    return (
      <aside className="flex h-screen w-14 flex-col items-center border-r border-border bg-card py-3">
        <button
          onClick={onToggleCollapse}
          className="mb-3 rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          title="展开侧边栏"
        >
          <PanelLeftOpen size={16} />
        </button>

        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-1">
          <NavBtn id="home" label="首页" />
          {TOOL_CATEGORIES.flatMap((cat) => cat.tools).map((t) => (
            <NavBtn key={t.id} id={t.id} label={t.label} />
          ))}
        </nav>

        <button
          onClick={onToggleTheme}
          className="mt-2 rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          title={theme === "dark" ? "亮色模式" : "暗色模式"}
        >
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </aside>
    );
  }

  return (
    <aside className="flex h-screen w-56 flex-col border-r border-border bg-card">
      <div className="space-y-3 px-4 pt-4 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Braces size={14} />
            </div>
            <h1 className="text-base font-bold tracking-tight">DevKit</h1>
          </div>
          <button
            onClick={onToggleCollapse}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            title="折叠侧边栏"
          >
            <PanelLeftClose size={14} />
          </button>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索工具..."
            className="w-full rounded-md border border-input bg-transparent py-1.5 pl-8 pr-7 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {isSearching ? (
          filteredTools.length > 0 ? (
            filteredTools.map((t) => <NavBtn key={t.id} id={t.id} label={t.label} />)
          ) : (
            <p className="px-3 py-2 text-xs text-muted-foreground">无匹配工具</p>
          )
        ) : (
          <>
            <NavBtn id="home" label="首页" />

            {recentTools.length > 0 && (
              <div className="pt-2">
                <p className="px-3 pb-1 text-xs font-medium text-muted-foreground">最近使用</p>
                {recentTools.map((t) => (
                  <NavBtn key={t.id} id={t.id} label={t.label} />
                ))}
              </div>
            )}

            {TOOL_CATEGORIES.map((cat) => (
              <div key={cat.id} className="pt-2">
                <button
                  onClick={() => toggleCategory(cat.id)}
                  className="flex w-full items-center justify-between px-3 pb-1 text-xs font-bold text-muted-foreground hover:text-foreground"
                >
                  {cat.label}
                  <ChevronDown
                    size={12}
                    className={cn("transition-transform", catCollapsed[cat.id] && "-rotate-90")}
                  />
                </button>
                {!catCollapsed[cat.id] &&
                  cat.tools.map((t) => <NavBtn key={t.id} id={t.id} label={t.label} />)}
              </div>
            ))}
          </>
        )}
      </nav>

      <div className="border-t border-border p-3">
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>
    </aside>
  );
}

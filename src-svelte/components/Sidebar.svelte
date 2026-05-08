<script lang="ts">
  import { ALL_TOOLS, TOOL_CATEGORIES, searchTools, type ToolInfo } from "@/lib/tools";
  import type { Page } from "@/types";
  import {
    Activity,
    Binary,
    BookOpen,
    Braces,
    Calculator,
    ChevronDown,
    Clock,
    Database,
    Fingerprint,
    GitBranch,
    GitCompareArrows,
    Globe,
    Hash,
    Image,
    KeyRound,
    LayoutDashboard,
    Link2,
    Moon,
    NotebookPen,
    Palette,
    PanelLeftClose,
    PanelLeftOpen,
    Regex,
    Ruler,
    ScrollText,
    Search,
    Sun,
    Timer,
    Type,
    Upload,
    X,
  } from "@lucide/svelte";

  interface Props {
    activePage: Page;
    collapsed: boolean;
    recent: string[];
    theme: "light" | "dark";
    perfLogEnabled: boolean;
    onNavigate: (page: Page) => void;
    onToggleCollapse: () => void;
    onToggleTheme: () => void;
    onPerfLogChange: (enabled: boolean) => void;
  }

  let {
    activePage,
    collapsed,
    recent,
    theme,
    perfLogEnabled,
    onNavigate,
    onToggleCollapse,
    onToggleTheme,
    onPerfLogChange,
  }: Props = $props();

  let query = $state("");
  let catCollapsed = $state<Record<string, boolean>>({});

  const iconMap: Record<string, typeof LayoutDashboard> = {
    home: LayoutDashboard,
    json: Braces,
    base64: Binary,
    url: Link2,
    jwt: KeyRound,
    uuid: Fingerprint,
    hash: Hash,
    regex: Regex,
    time: Clock,
    color: Palette,
    diff: GitCompareArrows,
    text: Type,
    "css-unit": Ruler,
    cron: Timer,
    "number-base": Calculator,
    "http-status": Globe,
    image: Image,
    mock: Database,
    "cursor-rules": ScrollText,
    "markdown-doc": NotebookPen,
    "git-push": Upload,
    "git-branch": GitBranch,
    "git-cheatsheet": BookOpen,
  };

  const isSearching = $derived(query.trim().length > 0);
  const filteredTools = $derived(searchTools(query));
  const recentTools = $derived(
    recent.map((id) => ALL_TOOLS.find((t) => t.id === id)).filter(Boolean) as ToolInfo[],
  );

  const toggleCategory = (catId: string) => {
    catCollapsed = { ...catCollapsed, [catId]: !catCollapsed[catId] };
  };

  const navClass = (id: Page) => {
    const base = "group/nav relative mb-1 flex w-full items-center overflow-hidden rounded-lg text-sm font-medium transition-all py-2";
    const layout = collapsed ? " justify-center px-2" : " gap-2.5 px-3";
    const active = activePage === id ? " bg-brand-gradient text-[var(--nav-active-foreground)]" : " text-muted-foreground hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]";
    return `${base}${layout}${active}`;
  };
</script>

{#snippet navBtn(id: Page, label: string)}
  {@const Icon = iconMap[id] || LayoutDashboard}
  <button
    onclick={() => onNavigate(id)}
    title={collapsed ? label : undefined}
    class={navClass(id)}
  >
    {#if activePage === id}
      <span class="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-[color:var(--nav-active-foreground)]/90"></span>
    {/if}
    <Icon size={16} />
    {#if !collapsed}{label}{/if}
  </button>
{/snippet}

{#if collapsed}
  <aside class="bg-sidebar-gradient flex h-screen w-14 flex-col items-center border-r py-3">
    <button
      onclick={onToggleCollapse}
      class="mb-3 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
      title="展开侧边栏"
    >
      <PanelLeftOpen size={16} />
    </button>

    <nav class="min-h-0 flex-1 space-y-1 overflow-y-auto px-1">
      {@render navBtn("home", "首页")}
      {#each TOOL_CATEGORIES.flatMap((cat) => cat.tools) as t}
        {@render navBtn(t.id, t.label)}
      {/each}
    </nav>

    <button
      type="button"
      onclick={() => onPerfLogChange(!perfLogEnabled)}
      class="mt-2 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
      class:text-[var(--primary)]={perfLogEnabled}
      title={perfLogEnabled ? "关闭性能日志（控制台）" : "开启性能日志（控制台）"}
    >
      <Activity size={16} />
    </button>
    <button
      type="button"
      onclick={onToggleTheme}
      class="mt-2 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
      title={theme === "dark" ? "亮色模式" : "暗色模式"}
    >
      {#if theme === "dark"}
        <Sun size={16} />
      {:else}
        <Moon size={16} />
      {/if}
    </button>
  </aside>
{:else}
  <aside class="bg-sidebar-gradient flex h-screen w-64 flex-col border-r">
    <div class="space-y-4 px-4 pb-3 pt-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="bg-brand-gradient flex h-8 w-8 items-center justify-center rounded-xl text-[var(--primary-foreground)]">
            <Braces size={14} />
          </div>
          <div class="leading-tight">
            <h1 class="text-base font-semibold tracking-tight">DevKit</h1>
            <p class="text-[11px] text-muted-foreground">开发者工具箱</p>
          </div>
        </div>
        <button
          onclick={onToggleCollapse}
          class="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
          title="折叠侧边栏"
        >
          <PanelLeftClose size={14} />
        </button>
      </div>
      <div class="relative">
        <Search size={14} class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          bind:value={query}
          placeholder="搜索工具..."
          class="w-full rounded-lg border py-2 pl-8 pr-7 text-sm placeholder:text-muted-foreground"
          style:background={"var(--surface-2)"}
        />
        {#if query}
          <button
            onclick={() => (query = "")}
            class="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-muted-foreground hover:bg-[var(--background)] hover:text-[var(--foreground)]"
          >
            <X size={14} />
          </button>
        {/if}
      </div>
    </div>

    <nav class="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 py-2">
      {#if isSearching}
        {#if filteredTools.length > 0}
          {#each filteredTools as t}
            {@render navBtn(t.id, t.label)}
          {/each}
        {:else}
          <p class="rounded-lg px-3 py-2 text-xs text-muted-foreground" style:background={"var(--surface-2)"}>无匹配工具</p>
        {/if}
      {:else}
        {@render navBtn("home", "首页")}

        {#if recentTools.length > 0}
          <div class="pt-2">
            <p class="px-2 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground">最近使用</p>
            {#each recentTools as t}
              {@render navBtn(t.id, t.label)}
            {/each}
          </div>
        {/if}

        {#each TOOL_CATEGORIES as cat}
          <div class="pt-2">
            <button
              onclick={() => toggleCategory(cat.id)}
              class="flex w-full items-center justify-between rounded-md px-2 py-1 text-[11px] font-semibold tracking-wide text-muted-foreground transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
            >
              {cat.label}
              <ChevronDown size={12} class={`transition-transform ${catCollapsed[cat.id] ? "-rotate-90" : ""}`} />
            </button>
            {#if !catCollapsed[cat.id]}
              {#each cat.tools as t}
                {@render navBtn(t.id, t.label)}
              {/each}
            {/if}
          </div>
        {/each}
      {/if}
    </nav>

    <div class="space-y-3 border-t p-3" style:background={"color-mix(in oklab, var(--surface-2) 60%, transparent)"}>
      <div class="flex items-center justify-between gap-2 rounded-lg border px-2 py-1.5" style:background={"color-mix(in oklab, var(--background) 70%, transparent)"}>
        <span class="text-xs font-normal text-muted-foreground">性能日志</span>
        <button
          class="btn px-2 py-1 text-xs"
          onclick={() => onPerfLogChange(!perfLogEnabled)}
          style:background={perfLogEnabled ? "color-mix(in oklab, var(--primary) 28%, var(--card))" : undefined}
        >
          {perfLogEnabled ? "开" : "关"}
        </button>
      </div>
      <p class="px-1 text-[10px] leading-snug text-muted-foreground">
        打开后每 3s 在控制台输出内存与帧间隔；用于排查越用越卡（默认关闭）。
      </p>
      <button
        onclick={onToggleTheme}
        class="flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
      >
        {#if theme === "dark"}
          <Sun size={16} />
          亮色模式
        {:else}
          <Moon size={16} />
          暗色模式
        {/if}
      </button>
    </div>
  </aside>
{/if}

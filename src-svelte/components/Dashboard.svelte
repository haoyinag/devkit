<script lang="ts">
  import { ALL_TOOLS, TOOL_CATEGORIES } from "@/lib/tools";
  import { detectContent } from "@/lib/clipboard-detect";
  import type { Page } from "@/types";
  import { Blocks, Clock3, ClipboardPaste, ExternalLink, FolderKanban, History, MousePointer2, Repeat2, Scale, Sparkles, Type, Workflow, X, Zap, ArrowUp } from "@lucide/svelte";

  interface Props {
    recent: string[];
    onNavigate: (page: Page, content?: string) => void;
  }

  let { recent, onNavigate }: Props = $props();
  let text = $state("");
  let detectMsg = $state("");
  let detection = $state<ReturnType<typeof detectContent> | null>(null);
  let textareaRef = $state<HTMLTextAreaElement | null>(null);

  const recentTools = $derived(recent.map((id) => ALL_TOOLS.find((t) => t.id === id)).filter(Boolean));
  const categoryIcons: Record<string, typeof FolderKanban> = {
    converters: Repeat2,
    formatters: Scale,
    generators: Zap,
    text: Type,
    time: Clock3,
    cursor: MousePointer2,
    workflow: Workflow,
  };

  const runDetect = (value: string) => {
    detection = detectContent(value);
    detectMsg = !value.trim() ? "" : detection ? "" : "未能识别类型，可手动选择工具";
  };

  const handlePaste = async () => {
    try {
      text = await navigator.clipboard.readText();
      if (!text.trim()) {
        detectMsg = "剪贴板为空";
        return;
      }
      runDetect(text);
    } catch {
      detectMsg = "无法读取剪贴板";
    }
  };

  const handleClear = () => {
    text = "";
    detectMsg = "";
    detection = null;
    textareaRef?.focus();
  };

  const handleSubmit = () => runDetect(text);

  $effect(() => {
    const el = textareaRef;
    if (!el) return;
    el.style.height = "auto";
    const MIN_H = 60;
    const MAX_H = 200;
    el.style.height = `${Math.max(MIN_H, Math.min(el.scrollHeight, MAX_H))}px`;
    el.style.overflowY = el.scrollHeight > MAX_H ? "auto" : "hidden";
  });
</script>

<div class="flex h-full flex-col gap-4 overflow-auto p-5">
  <section class="bg-brand-gradient-soft rounded-2xl border p-5 md:p-6">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 class="text-2xl font-semibold tracking-tight md:text-[28px]">
          <span class="text-brand-gradient">DevKit 工具箱</span>
        </h2>
        <p class="mt-1 text-sm text-muted-foreground">粘贴内容自动识别类型，或从下方选择工具</p>
      </div>
      <div class="bg-brand-gradient inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs text-[var(--primary-foreground)]">
        <Sparkles size={12} />
        Phase 1 UI
      </div>
    </div>
  </section>

  <section class="card bg-brand-gradient-soft p-4">
    <div class="mb-2 flex items-center gap-2 text-sm font-semibold">
      <Blocks size={16} class="text-muted-foreground" />
      智能识别
    </div>
    <div class="overflow-hidden rounded-xl border bg-[var(--background)] transition-colors">
      <textarea
        bind:this={textareaRef}
        bind:value={text}
        placeholder="输入或粘贴内容，自动识别类型（JSON / JWT / Base64 / URL / 时间戳 / UUID）"
        rows="2"
        class="block w-full resize-none bg-transparent px-4 py-3 font-mono text-sm leading-relaxed placeholder:text-muted-foreground"
        spellcheck="false"
        oninput={(e) => runDetect((e.target as HTMLTextAreaElement).value)}
        onkeydown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && text.trim()) {
            e.preventDefault();
            handleSubmit();
          }
        }}
      ></textarea>
      <div class="space-y-2 border-t bg-[color:var(--surface-2)]/70 px-3 py-2.5">
        <div class="flex items-center gap-2">
          <button class="btn h-8 shrink-0 px-2.5 text-xs" onclick={handlePaste}>
            <ClipboardPaste size={14} />
            粘贴
          </button>
          {#if text.trim()}
            <button class="btn h-8 shrink-0 px-2.5 text-xs" onclick={handleClear}>
              <X size={14} />
              清空
            </button>
          {/if}
          <div class="min-w-0 flex-1"></div>
          {#if detectMsg && !detection}
            <span class="shrink truncate text-xs text-muted-foreground">{detectMsg}</span>
          {/if}
          <button
            onclick={handleSubmit}
            disabled={!text.trim()}
            class="bg-brand-gradient flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--primary-foreground)] transition-opacity disabled:opacity-30"
            title="识别 (Ctrl+Enter)"
          >
            <ArrowUp size={16} />
          </button>
        </div>
        {#if detection}
          <div class="flex flex-col gap-2 rounded-lg border bg-[var(--background)] px-3 py-2 sm:flex-row sm:items-center">
            <div class="flex min-w-0 items-center gap-2">
              <span class="rounded-full bg-[var(--muted)] px-2 py-0.5 text-xs">{detection.type.toUpperCase()}</span>
              <span class="min-w-0 truncate text-sm">
                识别为 <strong>{detection.label}</strong>{detection.confidence === "medium" ? "（可能）" : ""}
              </span>
            </div>
            <div class="flex justify-end sm:ml-auto">
              <button class="btn h-8 gap-1 text-sm" onclick={() => onNavigate(detection!.tool, text)}>
                <ExternalLink size={12} />
                打开
              </button>
            </div>
          </div>
        {/if}
      </div>
    </div>
  </section>

  {#if recentTools.length > 0}
    <section class="card p-4">
      <div class="mb-2 flex items-center gap-2 text-sm font-semibold">
        <History size={16} class="text-muted-foreground" />
        最近使用
      </div>
      <div class="flex flex-wrap gap-2">
        {#each recentTools as tool}
          <button class="btn" onclick={() => onNavigate(tool.id)}>{tool.label}</button>
        {/each}
      </div>
    </section>
  {/if}

  <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
    {#each TOOL_CATEGORIES as cat}
      {@const Icon = categoryIcons[cat.id] || FolderKanban}
      <article class="card p-3">
        <div class="mb-2 flex items-center gap-2 text-sm font-semibold">
          <Icon size={14} class="text-muted-foreground" />
          {cat.label}
        </div>
        <div class="space-y-1">
          {#each cat.tools as tool}
            <button class="group flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--surface-2)]" onclick={() => onNavigate(tool.id)}>
              <span class="min-w-0 truncate font-medium">{tool.label}</span>
              <span class="shrink-0 text-xs text-muted-foreground/90">{tool.description}</span>
            </button>
          {/each}
        </div>
      </article>
    {/each}
  </section>
</div>

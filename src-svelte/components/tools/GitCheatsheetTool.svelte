<script lang="ts">
  type GitSnippet = { title: string; desc: string; cmd: string; note?: string };
  type GitSection = { id: string; label: string; items: GitSnippet[] };
  const SECTIONS: GitSection[] = [
    { id: "status", label: "状态与查看", items: [
      { title: "短状态", desc: "一行摘要，含分支与 ahead/behind", cmd: "git status -sb" },
      { title: "完整状态", desc: "未跟踪、已修改等详细说明", cmd: "git status" },
      { title: "最近提交", desc: "图形化分支拓扑", cmd: "git log --oneline --graph --decorate -n 20" },
      { title: "查看差异", desc: "工作区与暂存区", cmd: "git diff\ngit diff --cached" },
    ]},
    { id: "branch", label: "分支", items: [
      { title: "切换分支", desc: "Git 2.23+ 推荐", cmd: "git switch main" },
      { title: "新建并切换", desc: "从当前 HEAD 创建", cmd: "git switch -c feature/login" },
      { title: "跟踪远程分支", desc: "从 origin 检出", cmd: "git switch --track origin/feature/foo" },
      { title: "删除本地分支", desc: "已合并用 -d，强制用 -D", cmd: "git branch -d old-branch" },
    ]},
    { id: "commit", label: "暂存与提交", items: [
      { title: "暂存全部", desc: "含删除与未跟踪", cmd: "git add -A" },
      { title: "取消暂存", desc: "保留工作区修改", cmd: "git restore --staged path/to/file" },
      { title: "提交", desc: "附说明", cmd: "git commit -m \"feat(auth): add login\"" },
      { title: "修改最近提交", desc: "未推送时", cmd: "git commit --amend --no-edit" },
    ]},
    { id: "remote", label: "远程、拉取与推送", items: [
      { title: "拉取并 rebase", desc: "线性历史", cmd: "git pull --rebase origin main" },
      { title: "拉取 + 自动暂存", desc: "有未提交修改时", cmd: "git pull --rebase --autostash" },
      { title: "首次推送并设置上游", desc: "", cmd: "git push -u origin feature/foo" },
      { title: "推送当前分支", desc: "", cmd: "git push" },
    ]},
  ];

  let q = $state("");
  let copied = $state<string | null>(null);
  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text.trim());
      copied = key;
      setTimeout(() => (copied = null), 1200);
    } catch {
      copied = null;
    }
  };
  const filtered = $derived.by(() => {
    const query = q.trim().toLowerCase();
    if (!query) return SECTIONS;
    return SECTIONS.map((sec) => ({
      ...sec,
      items: sec.items.filter((it) =>
        it.title.toLowerCase().includes(query) ||
        it.desc.toLowerCase().includes(query) ||
        it.cmd.toLowerCase().includes(query) ||
        (it.note?.toLowerCase().includes(query) ?? false),
      ),
    })).filter((sec) => sec.items.length > 0);
  });
  const totalVisible = $derived(filtered.reduce((n, s) => n + s.items.length, 0));
</script>

<div class="flex h-full min-h-0 flex-col overflow-hidden">
  <div class="shrink-0 border-b border-border/80 px-4 py-3">
    <div class="flex flex-wrap items-center gap-2">
      <h2 class="text-lg font-semibold">Git 速查</h2>
      <span class="rounded bg-muted px-2 py-0.5 text-xs">{totalVisible} 条</span>
    </div>
    <p class="mt-1 text-sm text-muted-foreground">日常命令与常用组合说明；示例中的分支名、远程名、提交 hash 请按你的仓库替换。</p>
    <input class="input mt-3 max-w-xl" placeholder="按标题、说明或命令搜索…" bind:value={q} spellcheck="false" />
  </div>
  <div class="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-4">
    {#if filtered.length === 0}
      <p class="text-sm text-muted-foreground">没有匹配项，请换个关键词。</p>
    {:else}
      {#each filtered as sec}
        <section>
          <h3 class="mb-3 text-sm font-semibold text-foreground">{sec.label}</h3>
          <div class="grid gap-3 sm:grid-cols-1 lg:grid-cols-2">
            {#each sec.items as it}
              {@const key = `${sec.id}:${it.title}`}
              <article class="card overflow-hidden p-3">
                <div class="flex flex-wrap items-start justify-between gap-2">
                  <h4 class="text-base leading-snug">{it.title}</h4>
                  <button class="btn h-8 text-xs" onclick={() => copy(it.cmd, key)}>{copied === key ? "已复制" : "复制命令"}</button>
                </div>
                {#if it.desc}<p class="mt-1 text-sm text-muted-foreground">{it.desc}</p>{/if}
                <pre class="mt-2 max-h-48 overflow-auto rounded-md bg-muted/70 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap ring-1 ring-border/60">{it.cmd}</pre>
                {#if it.note}<p class="mt-1 text-xs text-muted-foreground">{it.note}</p>{/if}
              </article>
            {/each}
          </div>
        </section>
      {/each}
    {/if}
  </div>
</div>

<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  let repoRoot = $state("");
  let branch = $state("");
  let startPoint = $state("");
  let output = $state("");
  let busy = $state<string | null>(null);

  const run = async (label: string, command: string, args: Record<string, unknown> = {}) => {
    busy = label;
    try {
      const result = await invoke(command, { repoRoot, ...args });
      output = typeof result === "string" ? result : JSON.stringify(result, null, 2);
    } catch (e) {
      output = String(e);
    } finally {
      busy = null;
    }
  };
</script>

<div class="flex h-full min-h-0 flex-col overflow-hidden p-5">
  <div class="mb-3">
    <h2 class="text-lg font-semibold">Git 分支助手</h2>
    <p class="text-sm text-muted-foreground">查看分支、创建分支、切换分支、设置上游与刷新列表</p>
  </div>
  <input class="input mb-3 min-w-[280px] font-mono text-sm" bind:value={repoRoot} placeholder="仓库路径" spellcheck="false" />
  <div class="mb-3 flex flex-wrap gap-2">
    <button class="btn h-9 text-xs" onclick={() => run("列表", "git_workflow_list_branches")} disabled={!repoRoot || !!busy}>列出分支</button>
    <button class="btn h-9 text-xs" onclick={() => run("刷新", "git_workflow_refresh_lists")} disabled={!repoRoot || !!busy}>刷新列表</button>
    <button class="btn h-9 text-xs" onclick={() => run("状态", "git_workflow_refresh")} disabled={!repoRoot || !!busy}>刷新状态</button>
  </div>
  <div class="mb-3 grid gap-2 md:grid-cols-3">
    <input class="input text-sm" bind:value={branch} placeholder="分支名（feature/x）" spellcheck="false" />
    <input class="input text-sm" bind:value={startPoint} placeholder="起点（可空，默认当前）" spellcheck="false" />
    <div class="flex gap-2">
      <button class="btn h-9 text-xs" onclick={() => run("创建", "git_workflow_create_branch", { branch, checkout: true, startPoint: startPoint || null })} disabled={!repoRoot || !branch.trim() || !!busy}>创建并切换</button>
      <button class="btn h-9 text-xs" onclick={() => run("切换", "git_workflow_switch_branch", { branch, allowCreateFromRemote: true })} disabled={!repoRoot || !branch.trim() || !!busy}>切换</button>
    </div>
  </div>
  <textarea class="input min-h-0 flex-1 font-mono text-xs" bind:value={output} readonly placeholder="命令输出"></textarea>
</div>

<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";

  let repoRoot = $state("");
  let commitMessage = $state("");
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
    <h2 class="text-lg font-semibold">Git 推送助手</h2>
    <p class="text-sm text-muted-foreground">专注提交与推送：刷新、暂存、提交、拉取、推送</p>
  </div>
  <div class="mb-3 flex flex-wrap gap-2">
    <input class="input min-w-[280px] flex-1 font-mono text-sm" bind:value={repoRoot} placeholder="仓库路径" spellcheck="false" />
    <button class="btn h-9 text-xs" onclick={() => run("刷新", "git_workflow_refresh")} disabled={!repoRoot || !!busy}>{busy === "刷新" ? "刷新中…" : "刷新状态"}</button>
    <button class="btn h-9 text-xs" onclick={() => run("暂存", "git_workflow_add_all")} disabled={!repoRoot || !!busy}>{busy === "暂存" ? "处理中…" : "暂存全部"}</button>
    <button class="btn h-9 text-xs" onclick={() => run("拉取", "git_workflow_pull")} disabled={!repoRoot || !!busy}>{busy === "拉取" ? "处理中…" : "Pull"}</button>
    <button class="btn h-9 text-xs" onclick={() => run("推送", "git_workflow_push")} disabled={!repoRoot || !!busy}>{busy === "推送" ? "处理中…" : "Push"}</button>
  </div>
  <div class="mb-3 flex gap-2">
    <input class="input flex-1 text-sm" bind:value={commitMessage} placeholder="提交说明（如 feat: xxx）" spellcheck="false" />
    <button class="btn h-9 text-xs" onclick={() => run("提交", "git_workflow_commit", { message: commitMessage })} disabled={!repoRoot || !commitMessage.trim() || !!busy}>{busy === "提交" ? "提交中…" : "提交"}</button>
  </div>
  <textarea class="input min-h-0 flex-1 font-mono text-xs" bind:value={output} readonly placeholder="命令输出"></textarea>
</div>

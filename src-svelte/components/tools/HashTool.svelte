<script lang="ts">
  import { md5, sha } from "@/lib/hash-utils";

  const ALGORITHMS = [
    { id: "md5", label: "MD5" },
    { id: "SHA-1", label: "SHA-1" },
    { id: "SHA-256", label: "SHA-256" },
    { id: "SHA-384", label: "SHA-384" },
    { id: "SHA-512", label: "SHA-512" },
  ];

  let input = $state("");
  let results = $state<Record<string, string>>({});
  let uppercase = $state(false);
  let error = $state<string | null>(null);
  let computing = $state(false);

  const handleCompute = async () => {
    if (!input) {
      error = "请输入要哈希的内容";
      return;
    }
    computing = true;
    error = null;
    try {
      const hash: Record<string, string> = {};
      hash.md5 = md5(input);
      for (const algo of ["SHA-1", "SHA-256", "SHA-384", "SHA-512"]) hash[algo] = await sha(algo, input);
      results = hash;
    } catch (e) {
      error = e instanceof Error ? e.message : "计算失败";
    } finally {
      computing = false;
    }
  };
</script>

<div class="flex h-full flex-col gap-4 overflow-y-auto p-5">
  <h2 class="text-2xl font-bold tracking-tight">Hash 计算</h2>
  <div class="flex flex-wrap items-center gap-3">
    <button class="btn btn-primary" onclick={handleCompute} disabled={computing}>{computing ? "计算中..." : "计算全部"}</button>
    <label class="flex items-center gap-2 text-sm"><input type="checkbox" bind:checked={uppercase} /> 大写</label>
    <button class="btn" onclick={() => { input = ""; results = {}; error = null; }}>清空</button>
  </div>
  {#if error}
    <div class="w-fit rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</div>
  {/if}
  <div class="rounded-xl bg-card ring-1 ring-foreground/10 p-4">
    <div class="mb-1 text-sm text-muted-foreground">输入文本</div>
    <textarea bind:value={input} placeholder="输入要计算哈希的文本" rows="4" class="input h-28 font-mono text-sm" spellcheck="false"></textarea>
  </div>
  {#if Object.keys(results).length > 0}
    <div class="card min-h-0 overflow-y-auto p-3">
      <div class="mb-2 text-sm text-muted-foreground">结果</div>
      <div class="space-y-3">
        {#each ALGORITHMS as alg}
          {#if results[alg.id]}
            <div>
              <div class="mb-1 text-xs font-medium text-muted-foreground">{alg.label}</div>
              <div class="group flex items-center gap-2 rounded bg-muted px-3 py-2">
                <code class="flex-1 break-all font-mono text-sm">{uppercase ? results[alg.id].toUpperCase() : results[alg.id]}</code>
                <button class="rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground" onclick={() => navigator.clipboard.writeText(uppercase ? results[alg.id].toUpperCase() : results[alg.id])}>复制</button>
              </div>
            </div>
          {/if}
        {/each}
      </div>
    </div>
  {/if}
</div>

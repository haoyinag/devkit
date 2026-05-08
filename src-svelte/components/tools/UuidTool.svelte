<script lang="ts">
  let count = $state(1);
  let uppercase = $state(false);
  let noDashes = $state(false);
  let uuids = $state<string[]>([]);
  let copyLabel = $state("复制全部");

  const generate = () => {
    const list: string[] = [];
    for (let i = 0; i < Math.min(count, 100); i += 1) {
      let id = crypto.randomUUID();
      if (noDashes) id = id.replace(/-/g, "");
      if (uppercase) id = id.toUpperCase();
      list.push(id);
    }
    uuids = list;
  };
  const copyAll = async () => {
    await navigator.clipboard.writeText(uuids.join("\n"));
    copyLabel = "已复制";
    setTimeout(() => (copyLabel = "复制全部"), 1500);
  };
</script>

<div class="flex h-full flex-col gap-4 overflow-y-auto p-5">
  <h2 class="text-2xl font-bold tracking-tight">UUID 生成器</h2>
  <div class="flex flex-wrap items-center gap-4">
    <div class="flex items-center gap-2">
      <span class="text-sm">数量</span>
      <input type="number" min="1" max="100" bind:value={count} onchange={() => (count = Math.max(1, Math.min(100, Number(count) || 1)))} class="input h-8 w-20 font-mono text-sm" />
    </div>
    <label class="flex items-center gap-2 text-sm"><input type="checkbox" bind:checked={uppercase} /> 大写</label>
    <label class="flex items-center gap-2 text-sm"><input type="checkbox" bind:checked={noDashes} /> 无横线</label>
    <button class="btn btn-primary" onclick={generate}>生成</button>
    <button class="btn" onclick={copyAll} disabled={uuids.length === 0}>{copyLabel}</button>
  </div>
  {#if uuids.length > 0}
    <div class="card min-h-0 flex-1 overflow-hidden p-3">
      <div class="mb-2 text-sm text-muted-foreground">已生成 {uuids.length} 个 UUID</div>
      <div class="min-h-0 flex-1 overflow-y-auto">
        <div class="space-y-1">
          {#each uuids as id}
            <div class="group flex items-center justify-between rounded px-2 py-1 hover:bg-muted">
              <code class="font-mono text-sm">{id}</code>
              <button class="invisible rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground group-hover:visible" onclick={() => navigator.clipboard.writeText(id)}>复制</button>
            </div>
          {/each}
        </div>
      </div>
    </div>
  {/if}
</div>

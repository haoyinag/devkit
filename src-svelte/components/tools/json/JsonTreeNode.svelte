<script lang="ts">
  interface Props {
    name?: string;
    value: unknown;
    depth: number;
  }

  let { name, value, depth }: Props = $props();
  let expanded = $state(false);
  $effect(() => {
    expanded = depth < 2;
  });

  const isArray = $derived(Array.isArray(value));
  const isObject = $derived(value !== null && typeof value === "object");
  const entries = $derived.by(() => {
    if (!isObject) return [];
    if (isArray) return (value as unknown[]).map((v, i) => [String(i), v] as const);
    return Object.entries(value as Record<string, unknown>);
  });
</script>

{#if value === null}
  <div class="flex items-center gap-1 py-px font-mono text-sm">
    <span class="w-4"></span>
    {#if name !== undefined}<span class="jh-key">"{name}"</span><span>: </span>{/if}
    <span class="jh-null">null</span>
  </div>
{:else if typeof value === "boolean"}
  <div class="flex items-center gap-1 py-px font-mono text-sm">
    <span class="w-4"></span>
    {#if name !== undefined}<span class="jh-key">"{name}"</span><span>: </span>{/if}
    <span class="jh-bool">{String(value)}</span>
  </div>
{:else if typeof value === "number"}
  <div class="flex items-center gap-1 py-px font-mono text-sm">
    <span class="w-4"></span>
    {#if name !== undefined}<span class="jh-key">"{name}"</span><span>: </span>{/if}
    <span class="jh-num">{value}</span>
  </div>
{:else if typeof value === "string"}
  <div class="flex items-center gap-1 py-px font-mono text-sm">
    <span class="w-4"></span>
    {#if name !== undefined}<span class="jh-key">"{name}"</span><span>: </span>{/if}
    <span class="jh-str">"{value}"</span>
  </div>
{:else if isObject}
  {@const bracket = isArray ? ["[", "]"] : ["{", "}"]}
  <div class="font-mono text-sm">
    <button
      type="button"
      class="flex w-full cursor-pointer items-center gap-1 text-left hover:bg-muted/50"
      onclick={() => (expanded = !expanded)}
    >
      <span class="w-4 text-center text-xs text-muted-foreground">{expanded ? "▼" : "▶"}</span>
      {#if name !== undefined}<span class="jh-key">"{name}"</span><span>: </span>{/if}
      <span>{bracket[0]}</span>
      {#if !expanded}
        <span class="text-muted-foreground"> {entries.length} 项 {bracket[1]}</span>
      {/if}
    </button>
    {#if expanded}
      <div class="ml-4 border-l border-border pl-2">
        {#each entries as [k, v] (k)}
          <JsonTreeNode name={isArray ? undefined : k} value={v} depth={depth + 1} />
        {/each}
      </div>
      <div class="ml-4">{bracket[1]}</div>
    {/if}
  </div>
{:else}
  <div class="flex items-center gap-1 py-px font-mono text-sm">
    <span class="w-4"></span>
    {#if name !== undefined}<span class="jh-key">"{name}"</span><span>: </span>{/if}
    <span class="text-muted-foreground">unknown</span>
  </div>
{/if}

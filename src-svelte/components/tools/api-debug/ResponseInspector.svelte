<script lang="ts">
  import { localDateStr } from "@/lib/time-utils";

  type ViewKind = "body" | "headers";

  interface Props {
    kind: ViewKind;
    text: string;
    headers?: Record<string, string>;
  }

  let { kind, text, headers = {} }: Props = $props();

  const STRING_PREVIEW_LIMIT = 600;
  const MIN_SECONDS = 946684800;
  const MAX_SECONDS = 4102444800;
  const MIN_MILLISECONDS = MIN_SECONDS * 1000;
  const MAX_MILLISECONDS = MAX_SECONDS * 1000;

  const isRecord = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === "object" && !Array.isArray(value);

  const parseTimestampNumber = (value: unknown): { date: Date; unit: "s" | "ms" } | null => {
    if (typeof value !== "number" && typeof value !== "string") return null;
    const raw = typeof value === "string" ? value.trim() : String(value);
    if (!/^\d{10,13}$/.test(raw)) return null;

    const num = Number(raw);
    if (!Number.isSafeInteger(num)) return null;
    if (num >= MIN_MILLISECONDS && num <= MAX_MILLISECONDS) return { date: new Date(num), unit: "ms" };
    if (num >= MIN_SECONDS && num <= MAX_SECONDS) return { date: new Date(num * 1000), unit: "s" };
    return null;
  };

  const valueTags = (value: unknown): string[] => {
    const tags: string[] = [];
    const ts = parseTimestampNumber(value);
    if (ts) tags.push(`${localDateStr(ts.date)} | ${ts.unit}`);
    if (Array.isArray(value)) tags.push(`length: ${value.length}`);
    return tags;
  };

  const displayString = (value: string) =>
    value.length > STRING_PREVIEW_LIMIT ? `${value.slice(0, STRING_PREVIEW_LIMIT)}...` : value;

  const parsedBody = $derived.by(() => {
    if (kind !== "body" || !text.trim()) return { ok: false as const, value: null };
    try {
      return { ok: true as const, value: JSON.parse(text) as unknown };
    } catch {
      return { ok: false as const, value: null };
    }
  });

  const headerEntries = $derived(Object.entries(headers));
</script>

{#snippet TagList(tags: string[])}
  {#each tags as tag}
    <span class="rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">{tag}</span>
  {/each}
{/snippet}

{#snippet JsonNode(name: string | undefined, value: unknown, depth: number)}
  {@const isArray = Array.isArray(value)}
  {@const isObject = isRecord(value) || isArray}
  {@const tags = valueTags(value)}
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
    <div class="flex flex-wrap items-center gap-1 py-px font-mono text-sm">
      <span class="w-4"></span>
      {#if name !== undefined}<span class="jh-key">"{name}"</span><span>: </span>{/if}
      <span class="jh-num">{value}</span>
      {@render TagList(tags)}
    </div>
  {:else if typeof value === "string"}
    <div class="flex flex-wrap items-center gap-1 py-px font-mono text-sm">
      <span class="w-4"></span>
      {#if name !== undefined}<span class="jh-key">"{name}"</span><span>: </span>{/if}
      <span class="jh-str break-all">"{displayString(value)}"</span>
      {#if value.length > STRING_PREVIEW_LIMIT}
        <span class="text-xs text-muted-foreground">({value.length} chars)</span>
      {/if}
      {@render TagList(tags)}
    </div>
  {:else if isObject}
    {@const entries = isArray ? (value as unknown[]).map((v, i) => [String(i), v] as const) : Object.entries(value as Record<string, unknown>)}
    {@const bracket = isArray ? ["[", "]"] : ["{", "}"]}
    <div class="font-mono text-sm">
      <div class="flex flex-wrap items-center gap-1 py-px">
        <span class="w-4"></span>
        {#if name !== undefined}<span class="jh-key">"{name}"</span><span>: </span>{/if}
        <span>{bracket[0]}</span>
        {@render TagList(tags)}
      </div>
      <div class="ml-4 border-l border-border pl-2">
        {#each entries as [k, v] (k)}
          {@render JsonNode(isArray ? undefined : k, v, depth + 1)}
        {/each}
      </div>
      <div class="ml-4">{bracket[1]}</div>
    </div>
  {:else}
    <div class="flex items-center gap-1 py-px font-mono text-sm">
      <span class="w-4"></span>
      {#if name !== undefined}<span class="jh-key">"{name}"</span><span>: </span>{/if}
      <span class="text-muted-foreground">unknown</span>
    </div>
  {/if}
{/snippet}

<div class="min-h-72 max-h-[520px] overflow-auto bg-transparent p-4">
  {#if kind === "headers"}
    {#if headerEntries.length === 0}
      <div class="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">No response headers</div>
    {:else}
      <div class="space-y-1">
        {#each headerEntries as [key, value]}
          {@const tags = valueTags(value)}
          <div class="flex flex-wrap items-center gap-1 font-mono text-sm">
            <span class="jh-key break-all">{key}</span><span>:</span>
            <span class="break-all">{value}</span>
            {@render TagList(tags)}
          </div>
        {/each}
      </div>
    {/if}
  {:else if parsedBody.ok}
    {@render JsonNode(undefined, parsedBody.value, 0)}
  {:else}
    <pre class="whitespace-pre-wrap break-all font-mono text-sm">{text}</pre>
  {/if}
</div>

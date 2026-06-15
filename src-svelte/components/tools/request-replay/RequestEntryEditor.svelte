<script lang="ts">
  import { createEditableEntry, type EditableEntry } from "@/lib/request-replay";
  import { Plus, Trash2 } from "@lucide/svelte";

  interface Props {
    entries: EditableEntry[];
    keyPlaceholder?: string;
    valuePlaceholder?: string;
    emptyText?: string;
    showTypes?: boolean;
    onChange: (entries: EditableEntry[]) => void;
  }

  let {
    entries,
    keyPlaceholder = "参数名",
    valuePlaceholder = "值",
    emptyText = "暂无参数",
    showTypes = false,
    onChange,
  }: Props = $props();

  const updateEntry = (id: string, patch: Partial<EditableEntry>) => {
    onChange(entries.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
  };

  const removeEntry = (id: string) => {
    onChange(entries.filter((entry) => entry.id !== id));
  };

  const addEntry = () => {
    onChange([...entries, createEditableEntry()]);
  };
</script>

<div class="space-y-2">
  {#if entries.length === 0}
    <div class="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">{emptyText}</div>
  {/if}

  {#each entries as entry (entry.id)}
    <div class={showTypes
      ? "grid grid-cols-[auto_minmax(120px,0.8fr)_110px_minmax(160px,1.2fr)_auto] items-center gap-2"
      : "grid grid-cols-[auto_minmax(120px,0.8fr)_minmax(160px,1.2fr)_auto] items-center gap-2"}>
      <input
        type="checkbox"
        checked={entry.enabled}
        onchange={(event) => updateEntry(entry.id, { enabled: (event.target as HTMLInputElement).checked })}
        title="是否发送此项"
      />
      <input
        class="input h-9 font-mono text-sm"
        value={entry.key}
        placeholder={keyPlaceholder}
        oninput={(event) => updateEntry(entry.id, { key: (event.target as HTMLInputElement).value })}
      />
      {#if showTypes}
        <select
          class="input h-9 text-xs"
          value={entry.valueType}
          onchange={(event) => updateEntry(entry.id, { valueType: (event.target as HTMLSelectElement).value as EditableEntry["valueType"] })}
        >
          <option value="string">string</option>
          <option value="number">number</option>
          <option value="boolean">boolean</option>
          <option value="null">null</option>
          <option value="json">object/array</option>
        </select>
      {/if}
      <input
        class="input h-9 font-mono text-sm"
        value={entry.value}
        placeholder={valuePlaceholder}
        oninput={(event) => updateEntry(entry.id, { value: (event.target as HTMLInputElement).value })}
      />
      <button class="btn h-9 px-2 text-muted-foreground" onclick={() => removeEntry(entry.id)} title="删除">
        <Trash2 size={14} />
      </button>
    </div>
  {/each}

  <button class="btn inline-flex items-center gap-1.5" onclick={addEntry}>
    <Plus size={14} />
    添加一项
  </button>
</div>

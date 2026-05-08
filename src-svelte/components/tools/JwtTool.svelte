<script lang="ts">
  interface Props {
    initialContent?: string;
  }
  let { initialContent = "" }: Props = $props();

  let input = $state("");
  let header = $state<string | null>(null);
  let payload = $state<string | null>(null);
  let expInfo = $state<string | null>(null);
  let isExpired = $state(false);
  let error = $state<string | null>(null);
  $effect(() => {
    if (initialContent && !input) input = initialContent;
  });

  const decodeBase64Url = (str: string) => {
    const padded = str.replace(/-/g, "+").replace(/_/g, "/");
    return decodeURIComponent(
      Array.from(atob(padded), (c) => `%${c.charCodeAt(0).toString(16).padStart(2, "0")}`).join(""),
    );
  };
  const formatExpiry = (exp: number) => {
    const now = Date.now() / 1000;
    const date = new Date(exp * 1000);
    const diff = exp - now;
    const dateStr = date.toLocaleString("sv-SE", { timeZone: "Asia/Shanghai" });
    if (diff < 0) {
      const ago = Math.abs(diff);
      if (ago < 3600) return `${dateStr} (${Math.floor(ago / 60)} 分钟前已过期)`;
      if (ago < 86400) return `${dateStr} (${Math.floor(ago / 3600)} 小时前已过期)`;
      return `${dateStr} (${Math.floor(ago / 86400)} 天前已过期)`;
    }
    if (diff < 3600) return `${dateStr} (${Math.floor(diff / 60)} 分钟后过期)`;
    if (diff < 86400) return `${dateStr} (${Math.floor(diff / 3600)} 小时后过期)`;
    return `${dateStr} (${Math.floor(diff / 86400)} 天后过期)`;
  };
  const decode = () => {
    try {
      const token = input.trim().replace(/^Bearer\s+/i, "");
      const parts = token.split(".");
      if (parts.length !== 3) throw new Error("JWT 格式无效：需要三段由 . 分隔");
      const h = JSON.parse(decodeBase64Url(parts[0]));
      const p = JSON.parse(decodeBase64Url(parts[1]));
      header = JSON.stringify(h, null, 2);
      payload = JSON.stringify(p, null, 2);
      if (p.exp) {
        expInfo = formatExpiry(p.exp);
        isExpired = p.exp < Date.now() / 1000;
      } else {
        expInfo = null;
        isExpired = false;
      }
      error = null;
    } catch (e) {
      error = e instanceof Error ? e.message : "解码失败";
      header = null;
      payload = null;
      expInfo = null;
      isExpired = false;
    }
  };
  const clearAll = () => {
    input = "";
    header = null;
    payload = null;
    expInfo = null;
    isExpired = false;
    error = null;
  };
  const copySection = async (text: string) => navigator.clipboard.writeText(text);
</script>

<div class="flex h-full flex-col gap-4 overflow-y-auto p-5">
  <h2 class="text-2xl font-bold tracking-tight">JWT 解码</h2>
  <div class="flex flex-wrap items-center gap-3">
    <button class="btn btn-primary" onclick={decode}>解码</button>
    <button class="btn" onclick={clearAll}>清空</button>
  </div>
  {#if error}
    <div class="w-fit rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</div>
  {/if}
  <div class="rounded-xl bg-card ring-1 ring-foreground/10">
    <div class="px-4 pt-3 pb-1"><div class="text-sm text-muted-foreground">JWT Token（支持带 Bearer 前缀）</div></div>
    <div class="px-4 pb-4">
      <textarea bind:value={input} placeholder="粘贴 JWT Token" rows="3" class="input h-24 font-mono text-sm" spellcheck="false"></textarea>
    </div>
  </div>
  {#if expInfo}
    <div class={`w-fit rounded-md px-3 py-1.5 text-sm ${isExpired ? "bg-red-500/10 text-red-700 dark:text-red-300" : "bg-muted text-foreground"}`}>
      {isExpired ? "已过期" : "未过期"}: {expInfo}
    </div>
  {/if}
  {#if header || payload}
    <div class="grid min-h-0 flex-1 grid-cols-2 gap-4">
      {#if header}
        <section class="card p-3">
          <div class="mb-2 flex items-center justify-between"><div class="text-sm text-muted-foreground">Header</div><button class="btn h-7 text-xs" onclick={() => copySection(header)}>复制</button></div>
          <pre class="overflow-auto rounded bg-muted p-3 font-mono text-sm">{header}</pre>
        </section>
      {/if}
      {#if payload}
        <section class="card p-3">
          <div class="mb-2 flex items-center justify-between"><div class="text-sm text-muted-foreground">Payload</div><button class="btn h-7 text-xs" onclick={() => copySection(payload)}>复制</button></div>
          <pre class="overflow-auto rounded bg-muted p-3 font-mono text-sm">{payload}</pre>
        </section>
      {/if}
    </div>
  {/if}
</div>

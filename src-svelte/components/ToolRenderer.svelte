<script lang="ts">
  import type { Page } from "@/types";
  import Base64Tool from "@app/components/tools/Base64Tool.svelte";
  import ColorTool from "@app/components/tools/ColorTool.svelte";
  import CursorRulesTool from "@app/components/tools/CursorRulesTool.svelte";
  import CronTool from "@app/components/tools/CronTool.svelte";
  import CssUnitTool from "@app/components/tools/CssUnitTool.svelte";
  import DiffTool from "@app/components/tools/DiffTool.svelte";
  import GitBranchTool from "@app/components/tools/GitBranchTool.svelte";
  import GitCheatsheetTool from "@app/components/tools/GitCheatsheetTool.svelte";
  import GitPushTool from "@app/components/tools/GitPushTool.svelte";
  import HashTool from "@app/components/tools/HashTool.svelte";
  import HttpStatusTool from "@app/components/tools/HttpStatusTool.svelte";
  import ImageTool from "@app/components/tools/ImageTool.svelte";
  import JsonTool from "@app/components/tools/JsonTool.svelte";
  import JwtTool from "@app/components/tools/JwtTool.svelte";
  import LocalConfigTool from "@app/components/tools/LocalConfigTool.svelte";
  import MarkdownDocTool from "@app/components/tools/MarkdownDocTool.svelte";
  import MockTool from "@app/components/tools/MockTool.svelte";
  import NumberBaseTool from "@app/components/tools/NumberBaseTool.svelte";
  import RegexTool from "@app/components/tools/RegexTool.svelte";
  import TextTool from "@app/components/tools/TextTool.svelte";
  import TimeTool from "@app/components/tools/TimeTool.svelte";
  import TsTypeGeneratorTool from "@app/components/tools/TsTypeGeneratorTool.svelte";
  import UrlTool from "@app/components/tools/UrlTool.svelte";
  import UuidTool from "@app/components/tools/UuidTool.svelte";

  interface Props {
    page: Page;
    initialContent?: string;
  }
  let { page, initialContent = "" }: Props = $props();
</script>

<div class="flex h-full flex-col gap-3 overflow-auto p-5">
  {#if page === "json"}
    <JsonTool initialContent={initialContent} />
  {:else if page === "base64"}
    <Base64Tool initialContent={initialContent} />
  {:else if page === "url"}
    <UrlTool initialContent={initialContent} />
  {:else if page === "jwt"}
    <JwtTool initialContent={initialContent} />
  {:else if page === "uuid"}
    <UuidTool />
  {:else if page === "hash"}
    <HashTool />
  {:else if page === "regex"}
    <RegexTool />
  {:else if page === "time"}
    <TimeTool />
  {:else if page === "color"}
    <ColorTool />
  {:else if page === "diff"}
    <DiffTool />
  {:else if page === "text"}
    <TextTool />
  {:else if page === "css-unit"}
    <CssUnitTool />
  {:else if page === "cron"}
    <CronTool />
  {:else if page === "number-base"}
    <NumberBaseTool />
  {:else if page === "http-status"}
    <HttpStatusTool />
  {:else if page === "image"}
    <ImageTool />
  {:else if page === "mock"}
    <MockTool />
  {:else if page === "ts-type-generator"}
    <TsTypeGeneratorTool initialContent={initialContent} />
  {:else if page === "cursor-rules"}
    <CursorRulesTool />
  {:else if page === "markdown-doc"}
    <MarkdownDocTool initialContent={initialContent} />
  {:else if page === "git-push"}
    <GitPushTool />
  {:else if page === "git-branch"}
    <GitBranchTool />
  {:else if page === "git-cheatsheet"}
    <GitCheatsheetTool />
  {:else if page === "local-configs"}
    <LocalConfigTool />
  {:else}
    <article class="card p-4">该工具正在迁移中。</article>
  {/if}
</div>

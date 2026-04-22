import { MarkdownArticle } from "@/components/markdown/markdown-components";

export function RuleMarkdownBody({ markdown }: { markdown: string }) {
  return <MarkdownArticle markdown={markdown} />;
}

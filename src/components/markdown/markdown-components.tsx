import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

export const markdownComponents: Components = {
  h1: ({ className, ...props }) => (
    <h1
      className={cn(
        "mt-8 scroll-mt-4 text-2xl font-bold tracking-tight first:mt-0",
        className,
      )}
      {...props}
    />
  ),
  h2: ({ className, ...props }) => (
    <h2
      className={cn(
        "mt-6 scroll-mt-4 border-b border-border pb-1 text-xl font-semibold tracking-tight first:mt-0",
        className,
      )}
      {...props}
    />
  ),
  h3: ({ className, ...props }) => (
    <h3
      className={cn("mt-5 text-lg font-semibold tracking-tight first:mt-0", className)}
      {...props}
    />
  ),
  h4: ({ className, ...props }) => (
    <h4 className={cn("mt-4 text-base font-semibold first:mt-0", className)} {...props} />
  ),
  p: ({ className, ...props }) => (
    <p className={cn("my-3 leading-relaxed text-foreground/90 last:mb-0", className)} {...props} />
  ),
  ul: ({ className, ...props }) => (
    <ul className={cn("my-3 list-disc space-y-1 pl-5", className)} {...props} />
  ),
  ol: ({ className, ...props }) => (
    <ol className={cn("my-3 list-decimal space-y-1 pl-5", className)} {...props} />
  ),
  li: ({ className, ...props }) => <li className={cn("text-foreground/90", className)} {...props} />,
  blockquote: ({ className, ...props }) => (
    <blockquote
      className={cn(
        "my-3 border-l-2 border-primary/40 bg-muted/40 py-1 pl-4 pr-2 text-sm text-muted-foreground italic",
        className,
      )}
      {...props}
    />
  ),
  a: ({ className, href, ...props }) => (
    <a
      href={href}
      className={cn("font-medium text-primary underline-offset-4 hover:underline", className)}
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    />
  ),
  hr: ({ className, ...props }) => (
    <hr className={cn("my-6 border-border", className)} {...props} />
  ),
  table: ({ className, ...props }) => (
    <div className="my-4 overflow-x-auto rounded-md border border-border">
      <table className={cn("w-full border-collapse text-sm", className)} {...props} />
    </div>
  ),
  thead: ({ className, ...props }) => (
    <thead className={cn("bg-muted/50", className)} {...props} />
  ),
  th: ({ className, ...props }) => (
    <th
      className={cn("border-b border-border px-3 py-2 text-left font-semibold", className)}
      {...props}
    />
  ),
  td: ({ className, ...props }) => (
    <td className={cn("border-b border-border px-3 py-2", className)} {...props} />
  ),
  tr: ({ className, ...props }) => (
    <tr className={cn("transition-colors hover:bg-muted/30", className)} {...props} />
  ),
  code: ({ className, children, ...props }) => {
    const isBlock = typeof className === "string" && className.includes("language-");
    if (isBlock) {
      return (
        <code
          className={cn("block bg-transparent font-mono text-[0.9em] text-foreground", className)}
          {...props}
        >
          {children}
        </code>
      );
    }
    return (
      <code
        className={cn(
          "rounded bg-muted px-1.5 py-0.5 font-mono text-[0.9em] text-foreground",
          className,
        )}
        {...props}
      >
        {children}
      </code>
    );
  },
  pre: ({ className, children, ...props }) => (
    <pre
      className={cn(
        "my-4 overflow-x-auto rounded-lg border border-border bg-muted/80 p-4 font-mono text-sm leading-relaxed text-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </pre>
  ),
};

interface MarkdownArticleProps {
  markdown: string;
  className?: string;
}

export function MarkdownArticle({ markdown, className }: MarkdownArticleProps) {
  return (
    <article className={cn("max-w-3xl text-sm", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {markdown}
      </ReactMarkdown>
    </article>
  );
}

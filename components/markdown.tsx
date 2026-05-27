"use client";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const components: Components = {
  h1: ({ children }) => <h3 className="mt-3 text-sm font-semibold first:mt-0">{children}</h3>,
  h2: ({ children }) => <h3 className="mt-3 text-sm font-semibold first:mt-0">{children}</h3>,
  h3: ({ children }) => <h4 className="mt-3 text-sm font-semibold first:mt-0">{children}</h4>,
  h4: ({ children }) => <h5 className="mt-2 text-sm font-semibold first:mt-0">{children}</h5>,
  p: ({ children }) => <p className="text-sm leading-relaxed [&:not(:first-child)]:mt-2">{children}</p>,
  ul: ({ children }) => <ul className="ml-4 list-disc space-y-1 text-sm [&:not(:first-child)]:mt-2">{children}</ul>,
  ol: ({ children }) => <ol className="ml-4 list-decimal space-y-1 text-sm [&:not(:first-child)]:mt-2">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  code: ({ className, children }) => {
    const isBlock = (className ?? "").includes("language-");
    if (isBlock) {
      return <pre className="mt-2 overflow-x-auto rounded border border-border bg-muted/40 p-2 text-[11px]"><code>{children}</code></pre>;
    }
    return <code className="rounded bg-muted px-1 py-0.5 text-[12px]">{children}</code>;
  },
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:no-underline">
      {children}
    </a>
  ),
  hr: () => <hr className="my-2 border-border" />,
};

export function Markdown({ source }: { source: string }) {
  return (
    <div className="space-y-0">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {source}
      </ReactMarkdown>
    </div>
  );
}

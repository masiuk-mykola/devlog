"use client";
import { Fragment, type ReactNode } from "react";

function renderInline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*\n]+?\*\*|__[^_\n]+?__|\*[^*\n]+?\*|_[^_\n]+?_|`[^`\n]+`)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**") && p.length > 4) {
      return <strong key={i}>{p.slice(2, -2)}</strong>;
    }
    if (p.startsWith("__") && p.endsWith("__") && p.length > 4) {
      return <strong key={i}>{p.slice(2, -2)}</strong>;
    }
    if (p.startsWith("*") && p.endsWith("*") && p.length > 2) {
      return <strong key={i}>{p.slice(1, -1)}</strong>;
    }
    if (p.startsWith("_") && p.endsWith("_") && p.length > 2) {
      return <em key={i}>{p.slice(1, -1)}</em>;
    }
    if (p.startsWith("`") && p.endsWith("`") && p.length > 2) {
      return <code key={i} className="rounded bg-muted px-1 py-0.5 text-[12px]">{p.slice(1, -1)}</code>;
    }
    return <Fragment key={i}>{p}</Fragment>;
  });
}

export function SlackMarkdown({ source }: { source: string }) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let listBuffer: string[] = [];

  const flushList = () => {
    if (listBuffer.length === 0) return;
    const buf = listBuffer;
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="ml-4 list-disc space-y-1 text-sm">
        {buf.map((item, i) => <li key={i}>{renderInline(item)}</li>)}
      </ul>,
    );
    listBuffer = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^[-•]\s+/.test(line)) {
      listBuffer.push(line.replace(/^[-•]\s+/, ""));
      continue;
    }
    flushList();
    if (line.trim() === "") continue;
    if (/^(?:---+|\*\*\*+|___+)$/.test(line.trim())) {
      blocks.push(<hr key={`hr-${blocks.length}`} className="my-2 border-border" />);
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const level = Math.min(heading[1].length + 2, 6);
      const Tag = `h${level}` as "h3" | "h4" | "h5" | "h6";
      blocks.push(
        <Tag key={`h-${blocks.length}`} className="text-sm font-semibold leading-relaxed">
          {renderInline(heading[2])}
        </Tag>,
      );
      continue;
    }
    blocks.push(
      <p key={`p-${blocks.length}`} className="text-sm leading-relaxed">
        {renderInline(line)}
      </p>,
    );
  }
  flushList();

  return <div className="space-y-2">{blocks}</div>;
}

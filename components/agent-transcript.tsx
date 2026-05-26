"use client";
import { Badge } from "@/components/ui/badge";
import type { SseEvent } from "@/src/lib/sse";

export function AgentTranscript({ events }: { events: SseEvent[] }) {
  return (
    <div className="space-y-2">
      {events.map((e, i) => {
        if (e.event === "text_delta") {
          return <p key={i} className="whitespace-pre-wrap text-sm leading-relaxed">{(e.data as { text: string }).text}</p>;
        }
        if (e.event === "tool_use") {
          const d = e.data as { name: string; input: unknown };
          return (
            <details key={i} className="rounded border border-border bg-muted/40 px-2 py-1 text-xs">
              <summary className="cursor-pointer">tool: {d.name}</summary>
              <pre className="mt-1 overflow-x-auto text-[11px]">{JSON.stringify(d.input, null, 2)}</pre>
            </details>
          );
        }
        if (e.event === "tool_result") {
          const d = e.data as { name: string; output: unknown };
          return (
            <details key={i} className="rounded border border-border bg-muted/20 px-2 py-1 text-xs">
              <summary className="cursor-pointer">← {d.name} result</summary>
              <pre className="mt-1 overflow-x-auto text-[11px]">{JSON.stringify(d.output, null, 2)}</pre>
            </details>
          );
        }
        if (e.event === "error") {
          const d = e.data as { code: string; message: string };
          return <Badge key={i} variant="destructive">{d.code}: {d.message}</Badge>;
        }
        return null;
      })}
    </div>
  );
}

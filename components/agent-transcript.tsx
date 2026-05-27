"use client";
import { Badge } from "@/components/ui/badge";
import type { SseEvent } from "@/src/lib/sse";
import { Markdown } from "./markdown";

const TOOL_LABELS: Record<string, string> = {
  list_tasks: "Reading your tasks…",
  get_task_age: "Checking task age…",
  get_task: "Reading task details…",
  get_completed_since: "Looking at what shipped recently…",
  list_notes: "Reading recent notes…",
  list_subtasks: "Reading subtasks…",
  ask_clarification: "Preparing clarifying questions…",
  propose_subtasks: "Drafting subtasks…",
  propose_triage_actions: "Compiling triage actions…",
};

export function AgentTranscript({ events, hideText = false }: { events: SseEvent[]; hideText?: boolean }) {
  return (
    <div className="space-y-2">
      {events.map((e, i) => {
        if (e.event === "text_delta") {
          if (hideText) return null;
          const cleaned = (e.data as { text: string }).text.replace(/```json[\s\S]*?(?:```|$)/g, "").trim();
          if (!cleaned) return null;
          return <Markdown key={i} source={cleaned} />;
        }
        if (e.event === "tool_use") {
          const d = e.data as { name: string; input: unknown };
          const label = TOOL_LABELS[d.name] ?? d.name;
          return (
            <details key={i} className="text-xs text-muted-foreground">
              <summary className="cursor-pointer list-none before:mr-1 before:content-['•']">{label}</summary>
              <pre className="mt-1 overflow-x-auto rounded border border-border bg-muted/40 p-2 text-[11px]">{JSON.stringify(d.input, null, 2)}</pre>
            </details>
          );
        }
        if (e.event === "error") {
          const d = e.data as { code: string; message: string };
          return <Badge key={i} variant="destructive">{d.code}: {d.message}</Badge>;
        }
        // tool_result intentionally hidden — covered by the matching tool_use bullet.
        return null;
      })}
    </div>
  );
}

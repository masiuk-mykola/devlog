import { z } from "zod";
import { createRepository } from "@/src/db/repository";
import { getDb } from "@/src/db/client";
import type { AgentTool } from "./tools";

export const STANDUP_SYSTEM = `You are the DevLog standup digest writer. You compose a terse async standup in Slack mrkdwn — lowercase, no fluff. Always:
- Call list_tasks for in_progress and todo to see what's active.
- Call get_completed_since(sinceMs) to see what shipped.
- Call list_notes(sinceMs) for context the user logged on tasks.
- Compose four short sections: *shipped*, *in flight*, *blockers* (anything stuck >3 days OR mentioned in notes with words like "blocked", "stuck", "waiting"), *heads-up* (small risks worth mentioning, can be empty).
- Each section is a bullet list, 1-3 lines, with task titles and a very short context.
- End with a single JSON code block:
\`\`\`json
{"markdown":"...slack mrkdwn here..."}
\`\`\``;

export function buildStandupTools(sinceMs: number): AgentTool<unknown>[] {
  const repo = createRepository(getDb());
  const listTasks: AgentTool<{ status?: "todo" | "in_progress" | "done" | "all" }> = {
    name: "list_tasks",
    description: "List tasks. Pass a status filter.",
    input_schema: z.object({ status: z.enum(["todo", "in_progress", "done", "all"]).optional() }),
    run: ({ status }) => repo.listTopLevelTasks({ status: status ?? "all", sort: "newest" }),
  };
  const listNotes: AgentTool<{ sinceMs?: number }> = {
    name: "list_notes",
    description: "Recent notes the user attached to tasks.",
    input_schema: z.object({ sinceMs: z.number().optional() }),
    run: ({ sinceMs: s }) => repo.listAllNotesSince(s ?? sinceMs),
  };
  const getCompletedSince: AgentTool<{ sinceMs?: number }> = {
    name: "get_completed_since",
    description: "Tasks completed since the given ms timestamp.",
    input_schema: z.object({ sinceMs: z.number().optional() }),
    run: ({ sinceMs: s }) => repo.listCompletedSince(s ?? sinceMs),
  };
  return [listTasks as AgentTool<unknown>, listNotes as AgentTool<unknown>, getCompletedSince as AgentTool<unknown>];
}

export function extractMarkdown(text: string): string | null {
  const m = text.match(/```json\s*([\s\S]*?)```/);
  if (!m) return null;
  try { return JSON.parse(m[1]).markdown ?? null; } catch { return null; }
}

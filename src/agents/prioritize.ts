import { z } from "zod";
import { createRepository } from "@/src/db/repository";
import { getDb } from "@/src/db/client";
import type { AgentTool } from "./tools";

export const PRIORITIZE_SYSTEM = `You are the DevLog prioritizer. Given a list of open engineering tasks, decide what the user should start with TODAY. Always:
- Call list_tasks to get the open tasks.
- For any task that looks stuck (in_progress with no recent change), call get_task_age.
- Weigh priority, age, and status. Don't just pick the first high-priority task — explain why this one comes first.
- Return a concise final paragraph with reasoning, then ONLY output a single JSON code block in this exact shape:
\`\`\`json
{"startHere":{"taskId":"...","title":"...","reason":"..."},"ranked":[{"taskId":"...","title":"...","rank":1,"reason":"..."}]}
\`\`\`
Pick up to 5 ranked items. Never include closed/done tasks.`;

export function buildPrioritizeTools(): AgentTool<unknown>[] {
  const repo = createRepository(getDb());
  const listTasks: AgentTool<{ status?: "todo" | "in_progress" | "done" | "all"; limit?: number }> = {
    name: "list_tasks",
    description: "List open tasks. Defaults to non-done tasks.",
    input_schema: z.object({
      status: z.enum(["todo", "in_progress", "done", "all"]).optional(),
      limit: z.number().int().positive().max(100).optional(),
    }),
    run: ({ status, limit }) => {
      const all = repo.listTopLevelTasks({ status: status ?? "all", sort: "newest" });
      const filtered = status ? all : all.filter((t) => t.status !== "done");
      return limit ? filtered.slice(0, limit) : filtered;
    },
  };
  const getTaskAge: AgentTool<{ id: string }> = {
    name: "get_task_age",
    description: "Returns hoursSinceCreated and hoursSinceStatusChange for a single task.",
    input_schema: z.object({ id: z.string() }),
    run: ({ id }) => repo.getTaskAge(id) ?? { error: "not_found" },
  };
  return [listTasks as AgentTool<unknown>, getTaskAge as AgentTool<unknown>];
}

export function extractFinalJson(text: string): unknown | null {
  const m = text.match(/```json\s*([\s\S]*?)```/);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}

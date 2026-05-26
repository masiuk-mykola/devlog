import { z } from "zod";
import { createRepository } from "@/src/db/repository";
import { getDb } from "@/src/db/client";
import type { AgentTool } from "./tools";

export const DECOMPOSE_SYSTEM = `You are the DevLog task decomposer. You receive a task. Your job:
1. Fetch the task with get_task.
2. If the task is vague — short description (<30 chars), or title contains words like "refactor", "improve", "investigate", "look into" without specifics — call ask_clarification with 2-4 specific questions, then STOP.
3. Otherwise call propose_subtasks with 3-6 concrete subtasks. Each subtask has a title (imperative, specific), short description, and priority. STOP after this call.
Never propose subtasks AND ask clarification in the same turn. Pick one branch.`;

export function buildDecomposeTools(_taskId: string): AgentTool<unknown>[] {
  const repo = createRepository(getDb());

  const getTask: AgentTool<{ id: string }> = {
    name: "get_task",
    description: "Fetch a task by id.",
    input_schema: z.object({ id: z.string() }),
    run: ({ id }) => repo.getTask(id) ?? { error: "not_found" },
  };

  const askClarification: AgentTool<{ questions: string[] }> = {
    name: "ask_clarification",
    description: "Ask the user 2-4 clarifying questions before generating subtasks.",
    input_schema: z.object({ questions: z.array(z.string()).min(1).max(4) }),
    run: (input) => input,
    isProposal: true,
  };

  const proposeSubtasks: AgentTool<{
    items: Array<{ title: string; description?: string; priority: "low" | "medium" | "high" }>;
  }> = {
    name: "propose_subtasks",
    description: "Propose 3-6 concrete subtasks.",
    input_schema: z.object({
      items: z
        .array(
          z.object({
            title: z.string().min(1),
            description: z.string().optional(),
            priority: z.enum(["low", "medium", "high"]),
          }),
        )
        .min(1)
        .max(8),
    }),
    run: (input) => input,
    isProposal: true,
  };

  return [
    getTask as AgentTool<unknown>,
    askClarification as AgentTool<unknown>,
    proposeSubtasks as AgentTool<unknown>,
  ];
}

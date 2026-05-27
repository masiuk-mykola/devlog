import { z } from "zod";
import { createRepository } from "@/src/db/repository";
import { getDb } from "@/src/db/client";
import type { AgentTool } from "./tools";

export const TRIAGE_CATEGORIES = [
  "stuck",
  "ghost",
  "exploded",
  "almost_done",
  "orphan_progress",
] as const;
export type TriageCategory = (typeof TRIAGE_CATEGORIES)[number];

export const TRIAGE_ACTION_KINDS = [
  "open",
  "set_status",
  "set_priority",
  "add_note_prompt",
  "delete",
  "decompose",
] as const;
export type TriageActionKind = (typeof TRIAGE_ACTION_KINDS)[number];

export const STUCK_HOURS = 72;
export const GHOST_DAYS = 14;

const ActionPayloadSchema = z
  .object({
    status: z.enum(["todo", "in_progress", "done"]).optional(),
    priority: z.enum(["low", "medium", "high"]).optional(),
    notePrompt: z.string().optional(),
  })
  .optional();

const TriageItemSchema = z.object({
  taskId: z.string(),
  category: z.enum(TRIAGE_CATEGORIES),
  reasoning: z.string().min(1).max(400),
  suggestedAction: z.object({
    kind: z.enum(TRIAGE_ACTION_KINDS),
    payload: ActionPayloadSchema,
  }),
});

export const TriageProposalSchema = z.object({
  items: z.array(TriageItemSchema).max(8),
});

export type TriageItem = z.infer<typeof TriageItemSchema>;
export type TriageProposal = z.infer<typeof TriageProposalSchema>;

export const TRIAGE_SYSTEM = `You are the DevLog workspace doctor. Scan the user's backlog and surface up to 8 tasks that need attention. Be selective — flag only what's actually problematic, not every task. If nothing is wrong, call propose_triage_actions with an empty items array.

Categories (pick exactly one per item):
- stuck: status is in_progress and hoursSinceStatusChange > ${STUCK_HOURS}, with no recent notes and no subtask movement.
- ghost: status is todo, hoursSinceCreated > ${GHOST_DAYS * 24}, priority is low, nothing changed recently.
- exploded: priority is high, description is empty or under 20 chars, has zero subtasks. Too vague for the priority.
- almost_done: parent task is in_progress but every subtask is already done.
- orphan_progress: parent task is done but at least one subtask is still todo or in_progress.

Process:
1. Always start with list_tasks (status: "all") to get the full backlog.
2. For tasks that look suspicious by status/title/age, call get_task_age, list_notes, and list_subtasks to confirm. You can call these in parallel for multiple tasks in the same turn.
3. Classify each problematic task into exactly one category. Rank by severity (stuck and orphan_progress are usually higher priority than ghost).
4. For each item, propose a single concrete suggestedAction:
   - stuck → kind: "add_note_prompt" with a short notePrompt asking what's blocking, OR kind: "set_status" with payload.status: "todo".
   - ghost → kind: "delete", OR kind: "set_priority" with payload.priority: "high"/"medium".
   - exploded → kind: "decompose" (no payload).
   - almost_done → kind: "set_status" with payload.status: "done".
   - orphan_progress → kind: "open" (let the user decide).
5. Call propose_triage_actions ONCE with the full list. Do not narrate after the tool call.
6. Reasoning must be 1-2 sentences, concrete and specific. Mention the actual signal (e.g. "in_progress for 96h, last note 5 days ago").`;

export function buildTriageTools(): AgentTool<unknown>[] {
  const repo = createRepository(getDb());

  const listTasks: AgentTool<{ status?: "todo" | "in_progress" | "done" | "all" }> = {
    name: "list_tasks",
    description: "List all tasks. Pass status filter or omit for all.",
    input_schema: z.object({
      status: z.enum(["todo", "in_progress", "done", "all"]).optional(),
    }),
    run: ({ status }) => repo.listTopLevelTasks({ status: status ?? "all", sort: "newest" }),
  };

  const getTaskAge: AgentTool<{ id: string }> = {
    name: "get_task_age",
    description: "Returns hoursSinceCreated and hoursSinceStatusChange for a task.",
    input_schema: z.object({ id: z.string() }),
    run: ({ id }) => repo.getTaskAge(id) ?? { error: "not_found" },
  };

  const listSubtasks: AgentTool<{ parentId: string }> = {
    name: "list_subtasks",
    description: "List direct subtasks of a parent task.",
    input_schema: z.object({ parentId: z.string() }),
    run: ({ parentId }) => repo.listSubtasks(parentId),
  };

  const listNotes: AgentTool<{ taskId: string }> = {
    name: "list_notes",
    description: "List notes attached to a single task (oldest first).",
    input_schema: z.object({ taskId: z.string() }),
    run: ({ taskId }) => repo.listNotes(taskId),
  };

  const proposeTriageActions: AgentTool<TriageProposal> = {
    name: "propose_triage_actions",
    description:
      "Propose up to 8 triage actions. Each item must have a category, 1-2 sentence reasoning, and a concrete suggestedAction.",
    input_schema: TriageProposalSchema,
    run: (input) => input,
    isProposal: true,
  };

  return [
    listTasks as AgentTool<unknown>,
    getTaskAge as AgentTool<unknown>,
    listSubtasks as AgentTool<unknown>,
    listNotes as AgentTool<unknown>,
    proposeTriageActions as AgentTool<unknown>,
  ];
}

export function extractTriageProposal(input: unknown): TriageProposal | null {
  const parsed = TriageProposalSchema.safeParse(input);
  return parsed.success ? parsed.data : null;
}

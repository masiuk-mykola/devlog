import { z } from "zod";

export const StatusEnum = z.enum(["todo", "in_progress", "done"]);
export type Status = z.infer<typeof StatusEnum>;

export const PriorityEnum = z.enum(["low", "medium", "high"]);
export type Priority = z.infer<typeof PriorityEnum>;

export const TaskSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(200),
  description: z.string().default(""),
  status: StatusEnum,
  priority: PriorityEnum,
  parentId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  completedAt: z.string().nullable(),
});
export type Task = z.infer<typeof TaskSchema>;

export const CreateTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().default(""),
  status: StatusEnum.default("todo"),
  priority: PriorityEnum.default("medium"),
  parentId: z.string().nullable().default(null),
});
export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;

export const UpdateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  status: StatusEnum.optional(),
  priority: PriorityEnum.optional(),
});
export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;

export const NoteSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  body: z.string(),
  createdAt: z.string(),
});
export type Note = z.infer<typeof NoteSchema>;

export const CreateNoteSchema = z.object({
  body: z.string().min(1).max(2000),
});
export type CreateNoteInput = z.infer<typeof CreateNoteSchema>;

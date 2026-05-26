import { NextRequest } from "next/server";
import { getDb } from "@/src/db/client";
import { createRepository } from "@/src/db/repository";
import { UpdateTaskSchema } from "@/src/schemas/task";
import { ApiHttpError, withErrorHandler } from "@/src/lib/api-error";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  return withErrorHandler(async () => {
    const { id } = await params;
    const repo = createRepository(getDb());
    const task = repo.getTask(id);
    if (!task) throw new ApiHttpError(404, "not_found", "Task not found");
    return {
      ...task,
      subtasks: repo.listSubtasks(id),
      notes: repo.listNotes(id),
    };
  });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  return withErrorHandler(async () => {
    const { id } = await params;
    const body = UpdateTaskSchema.parse(await req.json());
    const repo = createRepository(getDb());
    const updated = repo.updateTask(id, body);
    if (!updated) throw new ApiHttpError(404, "not_found", "Task not found");
    return updated;
  });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  return withErrorHandler(async () => {
    const { id } = await params;
    const repo = createRepository(getDb());
    repo.deleteTask(id);
    return { ok: true };
  });
}

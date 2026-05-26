import { NextRequest } from "next/server";
import { getDb } from "@/src/db/client";
import { createRepository } from "@/src/db/repository";
import { CreateNoteSchema } from "@/src/schemas/task";
import { ApiHttpError, withErrorHandler } from "@/src/lib/api-error";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  return withErrorHandler(async () => {
    const { id } = await params;
    const repo = createRepository(getDb());
    if (!repo.getTask(id)) throw new ApiHttpError(404, "not_found", "Task not found");
    const body = CreateNoteSchema.parse(await req.json());
    return repo.addNote(id, body.body);
  });
}

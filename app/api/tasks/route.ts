import { NextRequest } from "next/server";
import { getDb } from "@/src/db/client";
import { createRepository, type ListFilter } from "@/src/db/repository";
import { CreateTaskSchema } from "@/src/schemas/task";
import { withErrorHandler } from "@/src/lib/api-error";

export async function GET(req: NextRequest) {
  return withErrorHandler(async () => {
    const url = new URL(req.url);
    const filter: ListFilter = {
      status: (url.searchParams.get("status") as ListFilter["status"]) ?? "all",
      sort: (url.searchParams.get("sort") as ListFilter["sort"]) ?? undefined,
    };
    const repo = createRepository(getDb());
    return repo.listTopLevelTasks(filter);
  });
}

export async function POST(req: NextRequest) {
  return withErrorHandler(async () => {
    const body = CreateTaskSchema.parse(await req.json());
    const repo = createRepository(getDb());
    return repo.createTask(body);
  });
}

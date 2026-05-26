"use client";
import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useTasks } from "@/src/hooks/use-tasks";
import { TaskRow } from "./task-row";
import { TaskCreateDialog } from "./task-create-dialog";
import { TaskDrawer } from "./task-drawer";

type StatusFilter = "all" | "todo" | "in_progress" | "done";
type SortKey = "priority" | "newest" | "oldest";

export function TaskList({
  externalOpenTaskId,
  onExternalClose,
}: { externalOpenTaskId?: string | null; onExternalClose?: () => void } = {}) {
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const { data: tasks, isLoading } = useTasks({ status, sort });

  const effectiveOpenId = externalOpenTaskId ?? openTaskId;
  const handleClose = () => { setOpenTaskId(null); onExternalClose?.(); };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="todo">Todo</TabsTrigger>
            <TabsTrigger value="in_progress">In progress</TabsTrigger>
            <TabsTrigger value="done">Done</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="priority">Priority</SelectItem>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="oldest">Oldest</SelectItem>
            </SelectContent>
          </Select>
          <TaskCreateDialog />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : tasks && tasks.length > 0 ? (
        <div className="space-y-2">
          {tasks.map((t) => <TaskRow key={t.id} task={t} onOpen={() => setOpenTaskId(t.id)} />)}
        </div>
      ) : (
        <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          No tasks yet. Run <code className="rounded bg-muted px-1">npm run seed</code> for sample data, or create one.
        </div>
      )}

      <TaskDrawer taskId={effectiveOpenId} onClose={handleClose} />
    </>
  );
}

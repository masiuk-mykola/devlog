"use client";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUpdateTask } from "@/src/hooks/use-tasks";
import { isStale, relativeTime } from "@/src/lib/time";
import type { Task } from "@/src/schemas/task";

const priorityColor: Record<Task["priority"], string> = {
  high: "bg-red-500/15 text-red-600 dark:text-red-300",
  medium: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  low: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
};

const statusLabel: Record<Task["status"], string> = {
  todo: "Todo",
  in_progress: "In progress",
  done: "Done",
};

const statusRowColor: Record<Task["status"], string> = {
  todo: "bg-slate-50 border-slate-200 hover:bg-slate-100 dark:bg-slate-900/30 dark:border-slate-800",
  in_progress: "bg-sky-50 border-sky-200 hover:bg-sky-100 dark:bg-sky-950/30 dark:border-sky-900",
  done: "border-border bg-transparent opacity-60 hover:opacity-80",
};

export function TaskRow({ task, onOpen }: { task: Task; onOpen: () => void }) {
  const update = useUpdateTask();
  const stale = task.status === "in_progress" && isStale(task.updatedAt);
  return (
    <div
      className={`group flex items-center gap-3 rounded-md border px-3 py-2 transition-colors ${statusRowColor[task.status]}`}
    >
      <div className="w-20 shrink-0 flex justify-start">
        <Badge variant="outline" className={`${priorityColor[task.priority]} w-full justify-center`}>{task.priority}</Badge>
      </div>
      <button
        onClick={onOpen}
        className={`flex-1 truncate text-left text-sm font-medium ${task.status === "done" ? "line-through" : ""}`}
      >
        {task.title}
      </button>
      {stale && (
        <span
          aria-label="Stuck for more than 3 days"
          title="Stuck for more than 3 days"
          className="inline-block size-2 rounded-full bg-amber-500"
        />
      )}
      <span className="text-xs text-muted-foreground">{relativeTime(task.createdAt)}</span>
      <Select
        value={task.status}
        onValueChange={(v) => update.mutate({ id: task.id, body: { status: v as Task["status"] } })}
      >
        <SelectTrigger className="h-8 w-[130px] text-xs">
          <SelectValue>{(value: string) => statusLabel[value as Task["status"]] ?? value}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todo">Todo</SelectItem>
          <SelectItem value="in_progress">In progress</SelectItem>
          <SelectItem value="done">Done</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

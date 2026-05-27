"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useCreateTask, useDeleteTask, useTask, useUpdateTask } from "@/src/hooks/use-tasks";
import type { Priority, Status } from "@/src/schemas/task";
import type { TaskDetail } from "@/src/lib/api-client";
import { relativeTime } from "@/src/lib/time";
import { AddNoteForm } from "./add-note-form";
import { DecomposeDialog } from "./decompose-dialog";

const EditSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200, "Max 200 characters"),
  description: z.string().max(2000),
});
type EditValues = z.infer<typeof EditSchema>;

const SubtaskSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200, "Max 200 characters"),
});
type SubtaskValues = z.infer<typeof SubtaskSchema>;

function TaskDrawerBody({ task, onClose }: { task: TaskDetail; onClose: () => void }) {
  const update = useUpdateTask();
  const del = useDeleteTask();
  const createTask = useCreateTask();
  const [decomposeOpen, setDecomposeOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const form = useForm<EditValues>({
    resolver: zodResolver(EditSchema),
    defaultValues: { title: task.title, description: task.description },
    mode: "onSubmit",
  });
  const titleError = form.formState.errors.title?.message;

  const subtaskForm = useForm<SubtaskValues>({
    resolver: zodResolver(SubtaskSchema),
    defaultValues: { title: "" },
  });
  const subtaskError = subtaskForm.formState.errors.title?.message;

  const onSave = async (values: EditValues) => {
    await update.mutateAsync({ id: task.id, body: values });
    form.reset(values);
  };

  const commit = (patch: Parameters<typeof update.mutate>[0]["body"]) =>
    update.mutate({ id: task.id, body: patch });

  const addSubtask = async ({ title }: SubtaskValues) => {
    await createTask.mutateAsync({
      title,
      description: "",
      status: "todo",
      priority: "medium",
      parentId: task.id,
    });
    subtaskForm.reset({ title: "" });
  };

  return (
    <>
      <ScrollArea className="flex-1 px-4">
        <form onSubmit={form.handleSubmit(onSave)} className="space-y-4 py-4" noValidate>
          <div>
            <Label htmlFor="t-title">Title</Label>
            <Input id="t-title" aria-invalid={!!titleError} {...form.register("title")} />
            {titleError && <p role="alert" className="text-xs text-destructive">{titleError}</p>}
          </div>
          <div>
            <Label htmlFor="t-desc">Description</Label>
            <Textarea id="t-desc" rows={5} {...form.register("description")} />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {form.formState.isDirty ? "Unsaved changes" : "All changes saved"}
            </p>
            <Button
              type="submit"
              size="sm"
              disabled={!form.formState.isDirty || form.formState.isSubmitting || update.isPending}
            >
              Save
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Status</Label>
              <Select value={task.status} onValueChange={(v) => commit({ status: v as Status })}>
                <SelectTrigger>
                  <SelectValue>{(v: string) => ({ todo: "Todo", in_progress: "In progress", done: "Done" } as Record<string, string>)[v] ?? v}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">Todo</SelectItem>
                  <SelectItem value="in_progress">In progress</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Priority</Label>
              <Select value={task.priority} onValueChange={(v) => commit({ priority: v as Priority })}>
                <SelectTrigger>
                  <SelectValue>{(v: string) => ({ low: "Low", medium: "Medium", high: "High" } as Record<string, string>)[v] ?? v}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </form>

        <Separator />

        <div className="py-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-medium">Subtasks</h3>
            <Button size="sm" variant="outline" onClick={() => setDecomposeOpen(true)}>
              Decompose with AI
            </Button>
          </div>
          {task.subtasks.length === 0 ? (
            <p className="text-xs text-muted-foreground">No subtasks yet.</p>
          ) : (
            <ul className="space-y-1">
              {task.subtasks.map((s) => (
                <li key={s.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    aria-label={`Mark "${s.title}" as ${s.status === "done" ? "todo" : "done"}`}
                    checked={s.status === "done"}
                    onChange={(e) =>
                      update.mutate({ id: s.id, body: { status: e.target.checked ? "done" : "todo" } })
                    }
                  />
                  <span className={s.status === "done" ? "line-through text-muted-foreground" : ""}>
                    {s.title}
                  </span>
                  <Badge variant="outline" className="ml-auto text-[10px]">{s.priority}</Badge>
                </li>
              ))}
            </ul>
          )}
          <form
            onSubmit={subtaskForm.handleSubmit(addSubtask)}
            className="mt-3 flex gap-2"
            noValidate
          >
            <Input
              placeholder="Add a subtask…"
              aria-label="New subtask title"
              aria-invalid={!!subtaskError}
              {...subtaskForm.register("title")}
            />
            <Button type="submit" size="sm" variant="outline" disabled={createTask.isPending}>
              Add
            </Button>
          </form>
          {subtaskError && <p role="alert" className="mt-1 text-xs text-destructive">{subtaskError}</p>}
        </div>

        <Separator />

        <div className="py-4">
          <h3 className="mb-2 text-sm font-medium">Notes</h3>
          <ul className="space-y-2">
            {task.notes.map((n) => (
              <li key={n.id} className="rounded border border-border bg-muted/30 p-2 text-xs">
                <div className="text-muted-foreground">{relativeTime(n.createdAt)}</div>
                <div className="whitespace-pre-wrap">{n.body}</div>
              </li>
            ))}
          </ul>
          <AddNoteForm taskId={task.id} />
        </div>

        <Separator />

        <div className="py-4">
          <Button variant="destructive" onClick={() => setConfirmDeleteOpen(true)}>
            Delete task
          </Button>
        </div>
      </ScrollArea>

      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this task?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This permanently removes “{task.title}” and all its subtasks and notes.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDeleteOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                del.mutate(task.id);
                setConfirmDeleteOpen(false);
                onClose();
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DecomposeDialog open={decomposeOpen} onOpenChange={setDecomposeOpen} taskId={task.id} />
    </>
  );
}

export function TaskDrawer({ taskId, onClose }: { taskId: string | null; onClose: () => void }) {
  const { data: task } = useTask(taskId);

  return (
    <Sheet open={!!taskId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-lg">
        <SheetHeader><SheetTitle>{task ? "Edit task" : "Loading…"}</SheetTitle></SheetHeader>
        {task && <TaskDrawerBody key={task.id} task={task} onClose={onClose} />}
      </SheetContent>
    </Sheet>
  );
}

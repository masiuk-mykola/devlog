"use client";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useDeleteTask, useTask, useUpdateTask } from "@/src/hooks/use-tasks";
import type { Priority, Status } from "@/src/schemas/task";
import { AddNoteForm } from "./add-note-form";
import { DecomposeDialog } from "./decompose-dialog";

export function TaskDrawer({ taskId, onClose }: { taskId: string | null; onClose: () => void }) {
  const { data: task } = useTask(taskId);
  const update = useUpdateTask();
  const del = useDeleteTask();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [decomposeOpen, setDecomposeOpen] = useState(false);

  useEffect(() => {
    if (task) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTitle(task.title);
      setDescription(task.description);
    }
  }, [task]);

  const commit = (patch: Parameters<typeof update.mutate>[0]["body"]) => {
    if (!taskId) return;
    update.mutate({ id: taskId, body: patch });
  };

  return (
    <Sheet open={!!taskId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-lg">
        <SheetHeader><SheetTitle>{task ? "Edit task" : "Loading…"}</SheetTitle></SheetHeader>
        {task && (
          <ScrollArea className="flex-1 px-4">
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="t-title">Title</Label>
                <Input id="t-title" value={title} onChange={(e) => setTitle(e.target.value)}
                       onBlur={() => title !== task.title && commit({ title })} />
              </div>
              <div>
                <Label htmlFor="t-desc">Description</Label>
                <Textarea id="t-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={5}
                          onBlur={() => description !== task.description && commit({ description })} />
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

              <Separator />

              <div>
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
              </div>

              <Separator />

              <div>
                <h3 className="mb-2 text-sm font-medium">Notes</h3>
                <ul className="space-y-2">
                  {task.notes.map((n) => (
                    <li key={n.id} className="rounded border border-border bg-muted/30 p-2 text-xs">
                      <div className="text-muted-foreground">{new Date(n.createdAt).toLocaleString()}</div>
                      <div className="whitespace-pre-wrap">{n.body}</div>
                    </li>
                  ))}
                </ul>
                {taskId && <AddNoteForm taskId={taskId} />}
              </div>

              <Separator />

              <Button variant="destructive" onClick={() => {
                if (!taskId) return;
                if (confirm("Delete this task?")) { del.mutate(taskId); onClose(); }
              }}>
                Delete task
              </Button>
            </div>
          </ScrollArea>
        )}
        <DecomposeDialog open={decomposeOpen} onOpenChange={setDecomposeOpen} taskId={taskId} />
      </SheetContent>
    </Sheet>
  );
}

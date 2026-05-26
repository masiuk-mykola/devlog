"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAgentStream } from "@/src/hooks/use-agent-stream";
import { useCreateTask } from "@/src/hooks/use-tasks";
import type { Priority } from "@/src/schemas/task";
import { AgentTranscript } from "./agent-transcript";

type Subtask = { title: string; description?: string; priority: Priority };

export function DecomposeDialog({
  open,
  onOpenChange,
  taskId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  taskId: string | null;
}) {
  const { events, status, start, cancel } = useAgentStream();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [items, setItems] = useState<Subtask[] | null>(null);
  const createTask = useCreateTask();

  const clarifyEvent = events.find((e) => e.event === "needs_clarification");
  const finalEvent = events.find((e) => e.event === "final");

  useEffect(() => {
    if (open && taskId && events.length === 0) {
      start("/api/agents/decompose", { taskId });
    }
    if (!open) {
      setAnswers({});
      setItems(null);
    }
  }, [open, taskId, events.length, start]);

  useEffect(() => {
    if (finalEvent) {
      const d = finalEvent.data as { items?: Subtask[]; raw?: string };
      if (d.items) setItems(d.items);
    }
  }, [finalEvent]);

  const submitClarification = () => {
    if (!taskId) return;
    start("/api/agents/decompose", { taskId, clarificationAnswers: answers });
  };

  const createAll = async () => {
    if (!taskId || !items) return;
    for (const it of items) {
      await createTask.mutateAsync({
        title: it.title,
        description: it.description ?? "",
        priority: it.priority,
        status: "todo",
        parentId: taskId,
      });
    }
    onOpenChange(false);
  };

  const questions = (clarifyEvent?.data as { questions: string[] } | undefined)?.questions;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) cancel();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Decompose with AI</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          <AgentTranscript events={events} />

          {questions && !items && (
            <div className="mt-4 space-y-3 rounded border border-amber-500/40 bg-amber-500/5 p-3">
              <p className="text-sm font-medium">A few clarifying questions:</p>
              {questions.map((q, i) => (
                <div key={i}>
                  <Label className="text-xs">{q}</Label>
                  <Input
                    value={answers[q] ?? ""}
                    onChange={(e) =>
                      setAnswers((a) => ({ ...a, [q]: e.target.value }))
                    }
                  />
                </div>
              ))}
              <Button
                size="sm"
                onClick={submitClarification}
                disabled={Object.values(answers).every((v) => !v.trim())}
              >
                Send answers
              </Button>
            </div>
          )}

          {items && (
            <div className="mt-4 space-y-2">
              <p className="text-sm font-medium">Proposed subtasks:</p>
              {items.map((it, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_120px_auto] items-center gap-2 rounded border p-2"
                >
                  <Input
                    value={it.title}
                    onChange={(e) =>
                      setItems((arr) =>
                        arr!.map((x, j) =>
                          j === i ? { ...x, title: e.target.value } : x,
                        ),
                      )
                    }
                  />
                  <Select
                    value={it.priority}
                    onValueChange={(v) =>
                      setItems((arr) =>
                        arr!.map((x, j) =>
                          j === i ? { ...x, priority: v as Priority } : x,
                        ),
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setItems((arr) => arr!.filter((_, j) => j !== i))
                    }
                  >
                    x
                  </Button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {items && (
            <Button onClick={createAll} disabled={items.length === 0}>
              Create all
            </Button>
          )}
          {status === "running" && (
            <p className="text-xs text-muted-foreground">Thinking…</p>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDeleteTask, useUpdateTask } from "@/src/hooks/use-tasks";
import type { TriageCategory, TriageItem } from "@/src/agents/triage";

type Props = {
  item: TriageItem;
  taskTitle: string | undefined;
  onOpenTask: (id: string) => void;
  onDismiss: () => void;
  onApplied: () => void;
};

const CATEGORY_META: Record<TriageCategory, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  stuck: { label: "stuck", variant: "destructive" },
  ghost: { label: "ghost", variant: "secondary" },
  exploded: { label: "exploded", variant: "destructive" },
  almost_done: { label: "almost done", variant: "outline" },
  orphan_progress: { label: "orphan progress", variant: "outline" },
};

const STATUS_LABEL: Record<string, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
};
const PRIORITY_LABEL: Record<string, string> = { low: "low", medium: "medium", high: "high" };

function applyLabel(item: TriageItem): string {
  const { kind, payload } = item.suggestedAction;
  switch (kind) {
    case "open":
      return "Open task";
    case "set_status":
      return payload?.status ? `Move to ${STATUS_LABEL[payload.status]}` : "Update status";
    case "set_priority":
      return payload?.priority ? `Set priority ${PRIORITY_LABEL[payload.priority]}` : "Update priority";
    case "add_note_prompt":
      return "Add a note";
    case "delete":
      return "Delete";
    case "decompose":
      return "Decompose";
  }
}

function isDestructive(item: TriageItem): boolean {
  const { kind, payload } = item.suggestedAction;
  if (kind === "delete") return true;
  if (kind === "set_status" && payload?.status === "done") return true;
  return false;
}

export function TriageActionCard({ item, taskTitle, onOpenTask, onDismiss, onApplied }: Props) {
  const update = useUpdateTask();
  const del = useDeleteTask();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const meta = CATEGORY_META[item.category];

  const performAction = async () => {
    const { kind, payload } = item.suggestedAction;
    setBusy(true);
    try {
      if (kind === "delete") {
        await del.mutateAsync(item.taskId);
      } else if (kind === "set_status" && payload?.status) {
        await update.mutateAsync({ id: item.taskId, body: { status: payload.status } });
      } else if (kind === "set_priority" && payload?.priority) {
        await update.mutateAsync({ id: item.taskId, body: { priority: payload.priority } });
      } else {
        onOpenTask(item.taskId);
        return;
      }
      onApplied();
    } finally {
      setBusy(false);
    }
  };

  const handleApply = () => {
    if (isDestructive(item)) setConfirmOpen(true);
    else performAction();
  };

  return (
    <>
      <div className="rounded-md border border-border p-3">
        <div className="flex items-center gap-2">
          <Badge variant={meta.variant} className="uppercase tracking-wide">{meta.label}</Badge>
          <button
            onClick={() => onOpenTask(item.taskId)}
            className="text-left text-sm font-semibold underline-offset-2 hover:underline"
          >
            {taskTitle ?? item.taskId}
          </button>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{item.reasoning}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={isDestructive(item) ? "destructive" : "default"}
            onClick={handleApply}
            disabled={busy}
          >
            {applyLabel(item)}
          </Button>
          <Button size="sm" variant="ghost" onClick={onDismiss} disabled={busy}>
            Dismiss
          </Button>
          {item.suggestedAction.kind !== "open" && (
            <Button size="sm" variant="ghost" onClick={() => onOpenTask(item.taskId)} disabled={busy}>
              Open task
            </Button>
          )}
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{applyLabel(item)}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {item.suggestedAction.kind === "delete"
              ? `This permanently removes “${taskTitle ?? item.taskId}” and all its subtasks and notes.`
              : `Mark “${taskTitle ?? item.taskId}” as done.`}
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirmOpen(false);
                performAction();
              }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

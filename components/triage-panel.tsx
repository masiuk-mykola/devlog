"use client";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAgentStream } from "@/src/hooks/use-agent-stream";
import { useTasks } from "@/src/hooks/use-tasks";
import type { TriageItem } from "@/src/agents/triage";
import { AgentTranscript } from "./agent-transcript";
import { TriageActionCard } from "./triage-action-card";

type FinalShape = { items: TriageItem[] };

export function TriagePanel() {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const router = useRouter();
  const params = useSearchParams();
  const { events, status, start, cancel } = useAgentStream();
  const { data: tasks } = useTasks();

  const final = events.find((e) => e.event === "final")?.data as FinalShape | undefined;
  const items = final?.items ?? [];

  const titleById = useMemo(
    () => new Map(tasks?.map((t) => [t.id, t.title] as const) ?? []),
    [tasks],
  );

  const visibleItems = items.filter((it) => !dismissed.has(it.taskId) && !applied.has(it.taskId));

  const run = () => {
    setDismissed(new Set());
    setApplied(new Set());
    start("/api/agents/triage", {});
  };
  const launch = () => {
    setOpen(true);
    run();
  };

  const openTask = (id: string) => {
    const next = new URLSearchParams(params.toString());
    next.set("open", id);
    router.replace(`?${next}`, { scroll: false });
    setOpen(false);
    cancel();
  };

  const dismiss = (id: string) => setDismissed((prev) => new Set(prev).add(id));
  const markApplied = (id: string) => setApplied((prev) => new Set(prev).add(id));

  const allHealthy = status === "done" && items.length === 0;
  const allHandled = items.length > 0 && visibleItems.length === 0;

  return (
    <>
      <Button size="sm" variant="outline" onClick={launch}>
        Triage backlog
      </Button>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v) cancel();
          setOpen(v);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Backlog triage</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh]">
            <AgentTranscript events={events} hideText />

            {allHealthy && (
              <div className="mt-4 rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                Backlog looks healthy. Nothing to triage.
              </div>
            )}

            {allHandled && (
              <div className="mt-4 rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                All proposed actions handled. Rerun to re-scan.
              </div>
            )}

            {visibleItems.length > 0 && (
              <div className="mt-4 space-y-2">
                {visibleItems.map((it) => (
                  <TriageActionCard
                    key={it.taskId}
                    item={it}
                    taskTitle={titleById.get(it.taskId)}
                    onOpenTask={openTask}
                    onDismiss={() => dismiss(it.taskId)}
                    onApplied={() => markApplied(it.taskId)}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
          <DialogFooter>
            {status === "running" && (
              <p
                className="me-auto flex items-center gap-2 text-xs text-muted-foreground"
                aria-live="polite"
              >
                <span className="inline-block size-1.5 animate-pulse rounded-full bg-current" />
                Thinking…
              </p>
            )}
            {status !== "running" && final && (
              <Button variant="ghost" onClick={run}>
                Rerun
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

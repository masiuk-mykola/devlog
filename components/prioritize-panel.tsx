"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAgentStream } from "@/src/hooks/use-agent-stream";
import { AgentTranscript } from "./agent-transcript";

type FinalShape = {
  startHere?: { taskId: string; title: string; reason: string };
  ranked?: Array<{ taskId: string; title: string; rank: number; reason: string }>;
  raw?: string;
};

export function PrioritizePanel() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const params = useSearchParams();
  const { events, status, start, cancel } = useAgentStream();
  const final = events.find((e) => e.event === "final")?.data as FinalShape | undefined;

  const run = () => start("/api/agents/prioritize", {});
  const launch = () => { setOpen(true); run(); };

  const openTask = (id: string) => {
    const next = new URLSearchParams(params.toString());
    next.set("open", id);
    router.replace(`?${next}`, { scroll: false });
    setOpen(false);
    cancel();
  };

  return (
    <>
      <Button size="sm" onClick={launch}>Prioritize my day</Button>
      <Dialog open={open} onOpenChange={(v) => { if (!v) cancel(); setOpen(v); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>What to start with today</DialogTitle></DialogHeader>
          <ScrollArea className="max-h-[70vh]">
            <AgentTranscript events={events} hideText />
            {final?.startHere && (
              <div className="mt-4 rounded-md border border-primary/40 bg-primary/5 p-3">
                <div className="text-xs uppercase text-primary">Start here</div>
                <button
                  onClick={() => final.startHere && openTask(final.startHere.taskId)}
                  className="mt-1 text-left text-base font-semibold underline-offset-2 hover:underline"
                >
                  {final.startHere.title}
                </button>
                <p className="mt-1 text-sm text-muted-foreground">{final.startHere.reason}</p>
              </div>
            )}
            {final?.ranked && final.ranked.length > 0 && (
              <ol className="mt-4 space-y-2">
                {final.ranked.map((r) => (
                  <li key={r.taskId} className="rounded border border-border p-2 text-sm">
                    <button onClick={() => openTask(r.taskId)} className="text-left font-medium underline-offset-2 hover:underline">
                      {r.rank}. {r.title}
                    </button>
                    <p className="text-xs text-muted-foreground">{r.reason}</p>
                  </li>
                ))}
              </ol>
            )}
            {final?.raw && <pre className="mt-4 text-xs">{final.raw}</pre>}
          </ScrollArea>
          <DialogFooter>
            {status !== "running" && final && (
              <Button variant="ghost" onClick={run}>Rerun</Button>
            )}
            {status === "running" && <p className="text-xs text-muted-foreground">Thinking…</p>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAgentStream } from "@/src/hooks/use-agent-stream";
import { AgentTranscript } from "./agent-transcript";

type FinalShape = {
  startHere?: { taskId: string; title: string; reason: string };
  ranked?: Array<{ taskId: string; title: string; rank: number; reason: string }>;
  raw?: string;
};

export function PrioritizePanel({ onPickTask }: { onPickTask?: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const { events, status, start } = useAgentStream();
  const final = events.find((e) => e.event === "final")?.data as FinalShape | undefined;

  const launch = () => { setOpen(true); start("/api/agents/prioritize", {}); };

  return (
    <>
      <Button size="sm" variant="outline" onClick={launch}>Prioritize my day</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>What to start with today</DialogTitle></DialogHeader>
          <ScrollArea className="max-h-[70vh]">
            <AgentTranscript events={events} />
            {final?.startHere && (
              <div className="mt-4 rounded-md border border-primary/40 bg-primary/5 p-3">
                <div className="text-xs uppercase text-primary">Start here</div>
                <button
                  onClick={() => final.startHere && onPickTask?.(final.startHere.taskId)}
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
                    <button onClick={() => onPickTask?.(r.taskId)} className="font-medium underline-offset-2 hover:underline">
                      {r.rank}. {r.title}
                    </button>
                    <p className="text-xs text-muted-foreground">{r.reason}</p>
                  </li>
                ))}
              </ol>
            )}
            {final?.raw && <pre className="mt-4 text-xs">{final.raw}</pre>}
          </ScrollArea>
          {status === "running" && <p className="text-xs text-muted-foreground">Thinking…</p>}
        </DialogContent>
      </Dialog>
    </>
  );
}

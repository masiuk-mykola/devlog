"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useAgentStream } from "@/src/hooks/use-agent-stream";
import { AgentTranscript } from "./agent-transcript";

export function StandupPanel() {
  const [open, setOpen] = useState(false);
  const [sinceHours, setSinceHours] = useState(24);
  const { events, status, start, cancel } = useAgentStream();
  const final = events.find((e) => e.event === "final")?.data as { markdown?: string } | undefined;

  const launch = (h: number) => { setSinceHours(h); setOpen(true); start("/api/agents/standup", { sinceHours: h }); };

  const copy = () => {
    if (!final?.markdown) return;
    navigator.clipboard.writeText(final.markdown)
      .then(() => toast.success("Copied to clipboard"))
      .catch(() => toast.error("Copy failed"));
  };

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => launch(24)}>Draft standup</Button>
      <Dialog open={open} onOpenChange={(v) => { if (!v) cancel(); setOpen(v); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Standup digest</DialogTitle>
            <div className="flex items-center gap-2 pt-2">
              <span className="text-xs text-muted-foreground">Since:</span>
              <Select value={String(sinceHours)} onValueChange={(v) => launch(Number(v))}>
                <SelectTrigger className="h-8 w-[120px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="24">24h</SelectItem>
                  <SelectItem value="72">3 days</SelectItem>
                  <SelectItem value="168">7 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <AgentTranscript events={events} />
            {final?.markdown && (
              <pre className="mt-4 whitespace-pre-wrap rounded border border-border bg-muted/30 p-3 text-sm">
                {final.markdown}
              </pre>
            )}
          </ScrollArea>
          <DialogFooter>
            {final?.markdown && <Button onClick={copy}>Copy</Button>}
            {status === "running" && <p className="text-xs text-muted-foreground">Thinking…</p>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

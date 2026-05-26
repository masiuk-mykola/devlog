"use client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function DecomposeDialog({
  open,
  onOpenChange,
  taskId: _taskId,
}: { open: boolean; onOpenChange: (o: boolean) => void; taskId: string | null }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Decomposer (placeholder)</DialogTitle></DialogHeader>
      </DialogContent>
    </Dialog>
  );
}

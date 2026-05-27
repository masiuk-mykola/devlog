'use client';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAgentStream } from '@/src/hooks/use-agent-stream';
import { useCreateTask } from '@/src/hooks/use-tasks';
import { AgentTranscript } from './agent-transcript';
import { ClarificationForm } from './clarification-form';
import { SubtaskEditForm, type SubtaskInput } from './subtask-edit-form';

export function DecomposeDialog({
  open,
  onOpenChange,
  taskId
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  taskId: string | null;
}) {
  const { events, status, start, cancel } = useAgentStream();
  const [items, setItems] = useState<SubtaskInput[] | null>(null);
  const hasStartedRef = useRef(false);
  const createTask = useCreateTask();

  const clarifyEvent = events.find((e) => e.event === 'needs_clarification');
  const finalEvent = events.find((e) => e.event === 'final');

  useEffect(() => {
    if (open && taskId && !hasStartedRef.current) {
      hasStartedRef.current = true;
      start('/api/agents/decompose', { taskId });
    }
    if (!open) {
      hasStartedRef.current = false;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setItems(null);
    }
  }, [open, taskId, start]);

  useEffect(() => {
    if (finalEvent) {
      const d = finalEvent.data as { items?: SubtaskInput[]; raw?: string };
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (d.items) setItems(d.items);
    }
  }, [finalEvent]);

  const submitClarification = (answers: Record<string, string>) => {
    if (!taskId) return;
    start('/api/agents/decompose', { taskId, clarificationAnswers: answers });
  };

  const createAll = async (validated: SubtaskInput[]) => {
    if (!taskId) return;
    for (const it of validated) {
      await createTask.mutateAsync({
        title: it.title,
        description: it.description ?? '',
        priority: it.priority,
        status: 'todo',
        parentId: taskId
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
            <ClarificationForm
              questions={questions}
              onSubmit={submitClarification}
              isPending={status === 'running'}
            />
          )}

          {items && (
            <SubtaskEditForm
              initialItems={items}
              onCreate={createAll}
              isPending={createTask.isPending}
            />
          )}
        </ScrollArea>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => {
              cancel();
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          {status === 'running' && (
            <p className="text-xs text-muted-foreground">Thinking…</p>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

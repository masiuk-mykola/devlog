"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAddNote } from "@/src/hooks/use-tasks";
import { CreateNoteSchema, type CreateNoteInput } from "@/src/schemas/task";

export function AddNoteForm({ taskId }: { taskId: string }) {
  const addNote = useAddNote();
  const form = useForm<CreateNoteInput>({
    resolver: zodResolver(CreateNoteSchema),
    defaultValues: { body: "" },
    mode: "onSubmit",
  });

  const onSubmit = async ({ body }: CreateNoteInput) => {
    await addNote.mutateAsync({ id: taskId, body: body.trim() });
    form.reset({ body: "" });
  };

  const bodyError = form.formState.errors.body?.message;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="mt-2 grid gap-1" noValidate>
      <div className="flex gap-2">
        <Textarea
          rows={2}
          placeholder="Add a note…"
          aria-invalid={!!bodyError}
          {...form.register("body")}
        />
        <Button type="submit" size="sm" disabled={form.formState.isSubmitting || addNote.isPending}>
          Add
        </Button>
      </div>
      {bodyError && <p role="alert" className="text-xs text-destructive">{bodyError}</p>}
    </form>
  );
}

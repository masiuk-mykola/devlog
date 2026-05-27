"use client";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCreateTask } from "@/src/hooks/use-tasks";
import { PriorityEnum } from "@/src/schemas/task";

const FormSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200, "Max 200 characters"),
  description: z.string().max(2000),
  priority: PriorityEnum,
});
type FormValues = z.infer<typeof FormSchema>;

const DEFAULTS: FormValues = { title: "", description: "", priority: "medium" };

export function TaskCreateDialog() {
  const [open, setOpen] = useState(false);
  const create = useCreateTask();
  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: DEFAULTS,
    mode: "onSubmit",
  });

  const onSubmit = async (values: FormValues) => {
    await create.mutateAsync({ ...values, status: "todo", parentId: null });
    form.reset(DEFAULTS);
    setOpen(false);
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) form.reset(DEFAULTS);
  };

  const titleError = form.formState.errors.title?.message;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button size="sm" />}>
        + New task
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New task</DialogTitle></DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 py-2" noValidate>
          <div className="grid gap-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" autoFocus aria-invalid={!!titleError} {...form.register("title")} />
            {titleError && <p className="text-xs text-destructive">{titleError}</p>}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="desc">Description</Label>
            <Textarea id="desc" rows={4} {...form.register("description")} />
          </div>
          <div className="grid gap-2">
            <Label>Priority</Label>
            <Controller
              control={form.control}
              name="priority"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue>{(v: string) => ({ low: "Low", medium: "Medium", high: "High" } as Record<string, string>)[v] ?? v}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={form.formState.isSubmitting || create.isPending}>Create</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

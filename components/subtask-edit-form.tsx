"use client";
import { useEffect } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PriorityEnum, type Priority } from "@/src/schemas/task";

const ItemSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200, "Max 200 characters"),
  description: z.string().max(2000).optional(),
  priority: PriorityEnum,
});
const FormSchema = z.object({ items: z.array(ItemSchema).min(1, "Need at least one subtask") });
type FormValues = z.infer<typeof FormSchema>;

export type SubtaskInput = z.infer<typeof ItemSchema>;

export function SubtaskEditForm({
  initialItems,
  onCreate,
  isPending,
}: {
  initialItems: SubtaskInput[];
  onCreate: (items: SubtaskInput[]) => Promise<void> | void;
  isPending: boolean;
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: { items: initialItems },
  });
  const { fields, remove } = useFieldArray({ control: form.control, name: "items" });

  useEffect(() => {
    form.reset({ items: initialItems });
  }, [initialItems, form]);

  const submit = async ({ items }: FormValues) => {
    await onCreate(items);
  };

  return (
    <form onSubmit={form.handleSubmit(submit)} className="mt-4 space-y-2" noValidate>
      <p className="text-sm font-medium">Proposed subtasks:</p>
      {fields.map((field, i) => {
        const titleError = form.formState.errors.items?.[i]?.title?.message;
        return (
          <div
            key={field.id}
            className="grid grid-cols-[1fr_120px_auto] items-start gap-2 rounded border p-2"
          >
            <div className="grid gap-1">
              <Input aria-invalid={!!titleError} {...form.register(`items.${i}.title` as const)} />
              {titleError && <p className="text-xs text-destructive">{titleError}</p>}
            </div>
            <Controller
              control={form.control}
              name={`items.${i}.priority` as const}
              render={({ field: f }) => (
                <Select value={f.value} onValueChange={(v) => f.onChange(v as Priority)}>
                  <SelectTrigger>
                    <SelectValue>
                      {(v: string) =>
                        ({ low: "Low", medium: "Medium", high: "High" } as Record<string, string>)[v] ?? v
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            <Button type="button" size="sm" variant="ghost" onClick={() => remove(i)}>
              x
            </Button>
          </div>
        );
      })}
      <div className="flex justify-end pt-1">
        <Button type="submit" disabled={isPending || form.formState.isSubmitting || fields.length === 0}>
          Create all
        </Button>
      </div>
    </form>
  );
}

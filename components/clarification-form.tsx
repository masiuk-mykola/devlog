"use client";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const FormSchema = z.object({
  answers: z.array(
    z.object({
      question: z.string(),
      answer: z.string().trim().min(1, "Answer is required").max(500, "Max 500 characters"),
    }),
  ),
});
type FormValues = z.infer<typeof FormSchema>;

export function ClarificationForm({
  questions,
  onSubmit,
  isPending,
}: {
  questions: string[];
  onSubmit: (answers: Record<string, string>) => void;
  isPending: boolean;
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: { answers: questions.map((q) => ({ question: q, answer: "" })) },
  });

  useEffect(() => {
    form.reset({ answers: questions.map((q) => ({ question: q, answer: "" })) });
  }, [questions, form]);

  const submit = ({ answers }: FormValues) => {
    const record = Object.fromEntries(answers.map((a) => [a.question, a.answer.trim()]));
    onSubmit(record);
  };

  return (
    <form
      onSubmit={form.handleSubmit(submit)}
      className="mt-4 space-y-3 rounded border border-amber-500/40 bg-amber-500/5 p-3"
      noValidate
    >
      <p className="text-sm font-medium">A few clarifying questions:</p>
      {questions.map((q, i) => {
        const error = form.formState.errors.answers?.[i]?.answer?.message;
        return (
          <div key={q} className="grid gap-1">
            <Label className="text-xs">{q}</Label>
            <Input aria-invalid={!!error} {...form.register(`answers.${i}.answer` as const)} />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        );
      })}
      <Button type="submit" size="sm" disabled={isPending || form.formState.isSubmitting}>
        Send answers
      </Button>
    </form>
  );
}

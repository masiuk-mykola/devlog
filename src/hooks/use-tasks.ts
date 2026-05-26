"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, type TaskDetail } from "@/src/lib/api-client";
import type { CreateTaskInput, Task, UpdateTaskInput } from "@/src/schemas/task";

const KEYS = {
  list: (params: object) => ["tasks", "list", params] as const,
  detail: (id: string) => ["tasks", "detail", id] as const,
};

export function useTasks(params: { status?: string; sort?: string } = {}) {
  return useQuery<Task[]>({ queryKey: KEYS.list(params), queryFn: () => api.listTasks(params) });
}

export function useTask(id: string | null) {
  return useQuery<TaskDetail>({
    queryKey: id ? KEYS.detail(id) : ["tasks", "detail", "none"],
    queryFn: () => api.getTask(id!),
    enabled: !!id,
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTaskInput) => api.createTask(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Task created");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateTaskInput }) => api.updateTask(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteTask(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Task deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAddNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) => api.addNote(id, body),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: KEYS.detail(vars.id) }),
    onError: (e: Error) => toast.error(e.message),
  });
}

"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, type TaskDetail } from "@/src/lib/api-client";
import type { CreateTaskInput, Task, UpdateTaskInput } from "@/src/schemas/task";

const LIST_KEY = ["tasks", "list", "all"] as const;
const detailKey = (id: string) => ["tasks", "detail", id] as const;

export function useTasks() {
  return useQuery<Task[]>({ queryKey: LIST_KEY, queryFn: () => api.listTasks() });
}

export function useTask(id: string | null) {
  return useQuery<TaskDetail>({
    queryKey: id ? detailKey(id) : ["tasks", "detail", "none"],
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

type UpdateVars = { id: string; body: UpdateTaskInput };
type UpdateContext = { prevList?: Task[]; prevDetail?: TaskDetail };

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation<Task, Error, UpdateVars, UpdateContext>({
    mutationFn: ({ id, body }) => api.updateTask(id, body),
    onMutate: async ({ id, body }) => {
      await qc.cancelQueries({ queryKey: ["tasks"] });
      const prevList = qc.getQueryData<Task[]>(LIST_KEY);
      const prevDetail = qc.getQueryData<TaskDetail>(detailKey(id));
      const nowIso = new Date().toISOString();
      const patch = (t: Task): Task => ({ ...t, ...body, updatedAt: nowIso });
      qc.setQueryData<Task[]>(LIST_KEY, (old) => old?.map((t) => (t.id === id ? patch(t) : t)));
      if (prevDetail) {
        qc.setQueryData<TaskDetail>(detailKey(id), { ...prevDetail, ...body, updatedAt: nowIso });
      }
      return { prevList, prevDetail };
    },
    onError: (e, { id }, ctx) => {
      if (ctx?.prevList) qc.setQueryData<Task[]>(LIST_KEY, ctx.prevList);
      if (ctx?.prevDetail) qc.setQueryData<TaskDetail>(detailKey(id), ctx.prevDetail);
      toast.error(e.message);
    },
    onSettled: (_d, _e, { id }) => {
      qc.invalidateQueries({ queryKey: LIST_KEY });
      qc.invalidateQueries({ queryKey: detailKey(id) });
    },
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation<{ ok: true }, Error, string, { prevList?: Task[] }>({
    mutationFn: (id) => api.deleteTask(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: LIST_KEY });
      const prevList = qc.getQueryData<Task[]>(LIST_KEY);
      qc.setQueryData<Task[]>(LIST_KEY, (old) => old?.filter((t) => t.id !== id));
      return { prevList };
    },
    onError: (e, _id, ctx) => {
      if (ctx?.prevList) qc.setQueryData<Task[]>(LIST_KEY, ctx.prevList);
      toast.error(e.message);
    },
    onSuccess: () => toast.success("Task deleted"),
    onSettled: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

export function useAddNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) => api.addNote(id, body),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: detailKey(vars.id) }),
    onError: (e: Error) => toast.error(e.message),
  });
}

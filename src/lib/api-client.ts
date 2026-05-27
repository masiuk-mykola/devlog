import type { CreateTaskInput, Note, Task, UpdateTaskInput } from "@/src/schemas/task";

type TaskDetail = Task & { subtasks: Task[]; notes: Note[] };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  listTasks: () => request<Task[]>(`/api/tasks`),
  getTask: (id: string) => request<TaskDetail>(`/api/tasks/${id}`),
  createTask: (body: CreateTaskInput) => request<Task>("/api/tasks", { method: "POST", body: JSON.stringify(body) }),
  updateTask: (id: string, body: UpdateTaskInput) =>
    request<Task>(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteTask: (id: string) => request<{ ok: true }>(`/api/tasks/${id}`, { method: "DELETE" }),
  addNote: (id: string, body: string) =>
    request<Note>(`/api/tasks/${id}/notes`, { method: "POST", body: JSON.stringify({ body }) }),
};

export type { TaskDetail };

import type { Database } from "better-sqlite3";
import { nanoid } from "nanoid";
import type {
  CreateTaskInput,
  Note,
  Priority,
  Status,
  Task,
  UpdateTaskInput,
} from "@/src/schemas/task";
import { now, toIso } from "@/src/lib/time";

type TaskRow = {
  id: string;
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  parent_id: string | null;
  created_at: number;
  updated_at: number;
  completed_at: number | null;
};

type NoteRow = {
  id: string;
  task_id: string;
  body: string;
  created_at: number;
};

const rowToTask = (r: TaskRow): Task => ({
  id: r.id,
  title: r.title,
  description: r.description,
  status: r.status,
  priority: r.priority,
  parentId: r.parent_id,
  createdAt: toIso(r.created_at),
  updatedAt: toIso(r.updated_at),
  completedAt: r.completed_at ? toIso(r.completed_at) : null,
});

const rowToNote = (r: NoteRow): Note => ({
  id: r.id,
  taskId: r.task_id,
  body: r.body,
  createdAt: toIso(r.created_at),
});

const PRIORITY_RANK: Record<Priority, number> = { high: 3, medium: 2, low: 1 };

export type ListFilter = {
  status?: Status | "all";
  sort?: "priority" | "newest" | "oldest";
};

export type Repository = {
  createTask: (input: Partial<CreateTaskInput> & { title: string }) => Task;
  getTask: (id: string) => Task | null;
  listTopLevelTasks: (filter: ListFilter) => Task[];
  listSubtasks: (parentId: string) => Task[];
  updateTask: (id: string, input: UpdateTaskInput) => Task | null;
  deleteTask: (id: string) => void;
  addNote: (taskId: string, body: string) => Note;
  listNotes: (taskId: string) => Note[];
  listAllNotesSince: (sinceMs: number) => Note[];
  listCompletedSince: (sinceMs: number) => Task[];
  getTaskAge: (id: string) => { hoursSinceCreated: number; hoursSinceStatusChange: number } | null;
};

export function createRepository(db: Database): Repository {
  const insertTask = db.prepare(`
    INSERT INTO tasks (id, title, description, status, priority, parent_id, created_at, updated_at, completed_at)
    VALUES (@id, @title, @description, @status, @priority, @parent_id, @created_at, @updated_at, @completed_at)
  `);
  const selectTask = db.prepare<[string], TaskRow>(`SELECT * FROM tasks WHERE id = ?`);
  const selectChildren = db.prepare<[string], TaskRow>(`SELECT * FROM tasks WHERE parent_id = ? ORDER BY created_at ASC`);
  const deleteOne = db.prepare<[string]>(`DELETE FROM tasks WHERE id = ?`);

  const insertNote = db.prepare(`
    INSERT INTO task_notes (id, task_id, body, created_at)
    VALUES (@id, @task_id, @body, @created_at)
  `);
  const selectNotes = db.prepare<[string], NoteRow>(`SELECT * FROM task_notes WHERE task_id = ? ORDER BY created_at ASC`);
  const selectNotesSince = db.prepare<[number], NoteRow>(`SELECT * FROM task_notes WHERE created_at >= ? ORDER BY created_at ASC`);
  const selectCompletedSince = db.prepare<[number], TaskRow>(
    `SELECT * FROM tasks WHERE completed_at IS NOT NULL AND completed_at >= ? ORDER BY completed_at DESC`,
  );

  return {
    createTask(input) {
      const ts = now();
      const row: TaskRow = {
        id: nanoid(10),
        title: input.title,
        description: input.description ?? "",
        status: input.status ?? "todo",
        priority: input.priority ?? "medium",
        parent_id: input.parentId ?? null,
        created_at: ts,
        updated_at: ts,
        completed_at: null,
      };
      insertTask.run(row);
      return rowToTask(row);
    },

    getTask(id) {
      const r = selectTask.get(id);
      return r ? rowToTask(r) : null;
    },

    listTopLevelTasks({ status, sort }) {
      const where: string[] = ["parent_id IS NULL"];
      const params: Record<string, unknown> = {};
      if (status && status !== "all") {
        where.push("status = @status");
        params.status = status;
      }
      let orderBy = "created_at DESC";
      if (sort === "oldest") orderBy = "created_at ASC";

      const rows = db
        .prepare<Record<string, unknown>, TaskRow>(
          `SELECT * FROM tasks WHERE ${where.join(" AND ")} ORDER BY ${orderBy}`,
        )
        .all(params);

      const tasks = rows.map(rowToTask);
      if (sort === "priority") {
        tasks.sort((a, b) => PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority]);
      }
      return tasks;
    },

    listSubtasks(parentId) {
      return selectChildren.all(parentId).map(rowToTask);
    },

    updateTask(id, input) {
      const existing = selectTask.get(id);
      if (!existing) return null;

      const next: TaskRow = {
        ...existing,
        title: input.title ?? existing.title,
        description: input.description ?? existing.description,
        status: input.status ?? existing.status,
        priority: input.priority ?? existing.priority,
        updated_at: now(),
        completed_at:
          input.status === "done"
            ? existing.completed_at ?? now()
            : input.status && input.status !== "done"
              ? null
              : existing.completed_at,
      };

      db.prepare(`
        UPDATE tasks
        SET title = @title, description = @description, status = @status,
            priority = @priority, updated_at = @updated_at, completed_at = @completed_at
        WHERE id = @id
      `).run(next);

      return rowToTask(next);
    },

    deleteTask(id) {
      deleteOne.run(id);
    },

    addNote(taskId, body) {
      const row: NoteRow = { id: nanoid(10), task_id: taskId, body, created_at: now() };
      insertNote.run(row);
      return rowToNote(row);
    },

    listNotes(taskId) {
      return selectNotes.all(taskId).map(rowToNote);
    },

    listAllNotesSince(sinceMs) {
      return selectNotesSince.all(sinceMs).map(rowToNote);
    },

    listCompletedSince(sinceMs) {
      return selectCompletedSince.all(sinceMs).map(rowToTask);
    },

    getTaskAge(id) {
      const r = selectTask.get(id);
      if (!r) return null;
      const ts = now();
      const refForStatus = r.completed_at ?? r.updated_at;
      return {
        hoursSinceCreated: (ts - r.created_at) / 3_600_000,
        hoursSinceStatusChange: (ts - refForStatus) / 3_600_000,
      };
    },
  };
}

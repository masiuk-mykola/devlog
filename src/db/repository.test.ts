import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "./migrations";
import { createRepository, type Repository } from "./repository";

let repo: Repository;
let db: Database.Database;

beforeEach(() => {
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  repo = createRepository(db);
});

afterEach(() => {
  db.close();
});

describe("tasks repository", () => {
  it("creates and reads a task with ISO timestamps", () => {
    const created = repo.createTask({ title: "first" });
    expect(created.title).toBe("first");
    expect(created.status).toBe("todo");
    expect(created.priority).toBe("medium");
    expect(created.id).toMatch(/.+/);
    expect(new Date(created.createdAt).toString()).not.toBe("Invalid Date");

    const fetched = repo.getTask(created.id);
    expect(fetched?.id).toBe(created.id);
  });

  it("lists top-level tasks only by default", () => {
    const parent = repo.createTask({ title: "parent" });
    repo.createTask({ title: "child", parentId: parent.id });
    const list = repo.listTopLevelTasks({});
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(parent.id);
  });

  it("filters by status", () => {
    repo.createTask({ title: "a", status: "todo" });
    repo.createTask({ title: "b", status: "in_progress" });
    expect(repo.listTopLevelTasks({ status: "todo" })).toHaveLength(1);
    expect(repo.listTopLevelTasks({ status: "in_progress" })).toHaveLength(1);
  });

  it("sorts by priority high→low when requested", () => {
    repo.createTask({ title: "low", priority: "low" });
    repo.createTask({ title: "high", priority: "high" });
    repo.createTask({ title: "med", priority: "medium" });
    const sorted = repo.listTopLevelTasks({ sort: "priority" });
    expect(sorted.map((t) => t.priority)).toEqual(["high", "medium", "low"]);
  });

  it("updates status sets completedAt only when transitioning to done", () => {
    const t = repo.createTask({ title: "x" });
    const inProg = repo.updateTask(t.id, { status: "in_progress" });
    expect(inProg?.completedAt).toBeNull();
    const done = repo.updateTask(t.id, { status: "done" });
    expect(done?.completedAt).not.toBeNull();
    const reopened = repo.updateTask(t.id, { status: "todo" });
    expect(reopened?.completedAt).toBeNull();
  });

  it("cascades subtask deletion when parent is deleted", () => {
    const parent = repo.createTask({ title: "p" });
    const child = repo.createTask({ title: "c", parentId: parent.id });
    repo.deleteTask(parent.id);
    expect(repo.getTask(child.id)).toBeNull();
  });

  it("appends notes and lists them in created order", () => {
    const t = repo.createTask({ title: "x" });
    const n1 = repo.addNote(t.id, "first");
    const n2 = repo.addNote(t.id, "second");
    const notes = repo.listNotes(t.id);
    expect(notes.map((n) => n.id)).toEqual([n1.id, n2.id]);
  });

  it("getTaskAge returns hours since created and since status change", () => {
    const t = repo.createTask({ title: "x" });
    const age = repo.getTaskAge(t.id);
    expect(age).not.toBeNull();
    expect(age!.hoursSinceCreated).toBeGreaterThanOrEqual(0);
    expect(age!.hoursSinceStatusChange).toBeGreaterThanOrEqual(0);
  });
});

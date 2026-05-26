import Database, { type Database as DB } from "better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { runMigrations } from "./migrations";

let db: DB | null = null;

export function getDb(): DB {
  if (db) return db;

  const dbPath = resolve(process.env.DATABASE_PATH ?? "./data/devlog.db");
  const dir = dirname(dbPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}

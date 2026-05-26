# AGENT_LOG

Honest log of how this project was built with Claude Code. Newest entry on top.

## 2026-05-26 — Task 7: Seed script

- `src/db/seed.ts` populates 6 realistic engineering tasks (flaky CI, refactor billing, postmortem, Node bump, dark mode, slow queries). Mix of statuses and priorities so the prioritizer + standup agents have something to chew on later.
- Runnable via `npm run seed` (already wired in Task 1's package.json scripts as `tsx src/db/seed.ts`).

## 2026-05-26 — Task 6: CRUD route handlers

- `src/lib/api-error.ts` provides `withErrorHandler` + `ApiHttpError`. Zod errors map to 400 with flattened details; `ApiHttpError` lets handlers throw structured 4xx (used for 404s); unknown errors → 500 + `console.error`.
- Five routes: `GET/POST /api/tasks`, `GET/PATCH/DELETE /api/tasks/:id`, `POST /api/tasks/:id/notes`. Single-task GET enriches with `subtasks` + `notes`.
- `Ctx.params` is `Promise<{id}>` — Next.js 15 dynamic-route params are awaited.
- Smoke-checked end-to-end with curl (create, list, patch→done sets completedAt, note append, zod 400, delete, 404).

## 2026-05-26 — Task 5: Repository (TDD)

- TDD: wrote 8 tests against the in-memory SQLite first; ran them to confirm they fail (no impl); then implemented `createRepository(db)` in `src/db/repository.ts`. All 8 tests pass.
- Notable: `updateTask` toggles `completed_at` — sets it when status transitions to `done` (preserving the existing value if already done), and clears it when status leaves `done`. The test "updates status sets completedAt only when transitioning to done" enforces this.
- `src/lib/time.ts` provides the tiny `now()` / `toIso()` helpers so timestamps are consistent across the repository.
- `vitest.config.ts` configured with `@` alias matching tsconfig and `src/**/*.test.ts` glob.

## 2026-05-26 — Task 4: Zod schemas

- `src/schemas/task.ts` defines `StatusEnum`, `PriorityEnum`, `TaskSchema`, `CreateTaskSchema`, `UpdateTaskSchema`, `NoteSchema`, `CreateNoteSchema`. These are the **API-facing shapes** — timestamps are ISO 8601 strings, not unix ms. Conversion lives in the repository layer (Task 5).
- One source of truth — these schemas are reused by Route Handlers (request validation) and by agent tool definitions (Task 11+).

## 2026-05-26 — Task 3: DB + migrations

- `src/db/client.ts` and `src/db/migrations.ts` written from spec — synchronous better-sqlite3 client with WAL journal, foreign keys on, and idempotent `CREATE TABLE IF NOT EXISTS` migrations that run on first `getDb()` call. No separate migration command — schema bootstraps on demand.
- Verified both tables exist via a one-shot `tsx` import.

## 2026-05-26 — Task 2: shadcn/ui

- shadcn CLI generated everything in `components/ui/` (button, input, textarea, label, select, badge, sheet, dialog, dropdown-menu, tabs, card, sonner, separator, scroll-area, skeleton, tooltip). None of those files are hand-edited.
- Mounted `<Toaster richColors position="top-right" />` in `app/layout.tsx` by hand — the only manual edit in this task.
- shadcn auto-injected its CSS variables into `app/globals.css`; left them untouched.
- Two known minor gaps documented for future contributors: (1) `next-themes` is pulled in by shadcn's `sonner.tsx` but no `<ThemeProvider>` is mounted — fine, we use system theme; (2) `components.json` has `"style": "base-nova"`, the current shadcn CLI preset name (replaces the older `"default"`), so `shadcn add <component>` keeps working.

## 2026-05-26 — Task 1: Bootstrap

- Claude scaffolded the Next.js 15 project via `create-next-app` (App Router, TypeScript, Tailwind v4, Turbopack).
- Claude added runtime deps (`@anthropic-ai/sdk`, `@tanstack/react-query`, `better-sqlite3`, `nanoid`, `zod`) and dev deps (`vitest`, `tsx`).
- Marked `better-sqlite3` as `serverExternalPackages` in `next.config.ts` because Turbopack otherwise tries to bundle the native binary.
- Spec + plan written by Claude through the brainstorming → writing-plans workflow before any code touched the repo.

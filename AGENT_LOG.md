# AGENT_LOG

Honest log of how this project was built with Claude Code. Newest entry on top.

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

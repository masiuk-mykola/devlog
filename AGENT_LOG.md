# AGENT_LOG

Honest log of how this project was built with Claude Code. Newest entry on top.

## 2026-05-26 — Task 14: Standup digest + final polish

- `src/agents/standup.ts` defines three tools (`list_tasks`, `list_notes`, `get_completed_since`) + `STANDUP_SYSTEM` + `extractMarkdown` JSON-block parser.
- `app/api/agents/standup/route.ts` accepts `{sinceHours?}` (defaults 24, max 14d), computes `sinceMs` server-side, streams via SSE.
- `components/standup-panel.tsx` mirrors the prioritizer panel patterns (cancel-on-close, transcript view) and adds a Since selector (24h/3d/7d) + Copy-to-clipboard button.
- Mounted in the header next to "Prioritize my day".
- README rewritten with architecture overview, storage limits, AI agent rundown, and the explicit list of deliberate cuts (auth, kanban, UI tests, 4th agent variant, deploy config).

## Reflection — how Claude shaped this build

- The brainstorming → spec → plan → execute workflow paid off. Every implementation task had verbatim code in the plan; the spec/quality review subagents caught two HIGH bugs in the decomposer clarification flow that would have shipped silently otherwise.
- Hand-wrote the agent runner (`src/agents/runner.ts`) instead of using the SDK's beta `toolRunner` so proposal tools can short-circuit the loop and surface their input as an SSE event for client-side confirmation. Three TDD tests pin that behaviour.
- The custom SSE event taxonomy (`text_delta | tool_use | tool_result | needs_clarification | final | error | done`) is shared by all three agents and rendered by a single `<AgentTranscript>` component.
- Used the new shadcn "base-nova" preset (`@base-ui/react` under the hood) — the scaffold automatically generated the right primitives; no `asChild` → `render` rewrites were needed beyond the create-task dialog.
- Cuts I'm comfortable with: no UI tests, no fourth agent variant, no Loom. Time better spent on the depth of the three agents than the breadth of features.

## 2026-05-26 — Task 13: Decomposer agent with clarification round-trip

- `src/agents/decompose.ts` defines three tools: `get_task` (read-only), `ask_clarification` (proposal — questions echoed back to client without continuing the LLM loop), `propose_subtasks` (proposal — editable subtask list).
- `app/api/agents/decompose/route.ts` accepts `{taskId, clarificationAnswers?}`. Two paths: first invocation → agent may either propose subtasks immediately or emit `needs_clarification`; second invocation (with answers populated) → agent jumps straight to propose_subtasks. The 503 / 400 paths return JSON; the streaming path returns SSE.
- `components/decompose-dialog.tsx` is fully wired: shows the transcript live, renders clarifying questions as an inline form, then renders proposed subtasks as an editable checklist (title input + priority select + remove button), then commits them as subtasks via `useCreateTask` with `parentId` set. Cancel-on-close pattern reused from Task 12.
- Real agent demo requires `ANTHROPIC_API_KEY` in `.env`. Without it, the dialog surfaces the 503 inline.

## 2026-05-26 — Task 12: Prioritizer agent (end-to-end)

- `src/agents/prioritize.ts` defines the system prompt + two tools (`list_tasks`, `get_task_age`) + `extractFinalJson` regex helper.
- `app/api/agents/prioritize/route.ts` streams SSE via `ReadableStream`; returns HTTP 503 with `ai_not_configured` if `ANTHROPIC_API_KEY` is absent (verified via smoke test).
- `src/hooks/use-agent-stream.ts` — generic SSE consumer (parses `event:`/`data:` frames, handles AbortController, tracks status). Reused by all three agents.
- `components/agent-transcript.tsx` — shared transcript view rendering tool-call pills + streaming text. Used by all three agent panels.
- `components/prioritize-panel.tsx` — modal that streams the agent, renders "Start here" + ranked list; clicking a task opens its drawer via lifted state.
- `app/page.tsx` is now a client wrapper that holds the open-task-id and forwards it to TaskList via `externalOpenTaskId`. TaskList accepts the controlled-open prop without losing its internal click-row-to-open behaviour.

## 2026-05-26 — Task 11: Anthropic client, SSE, runner (TDD)

- `src/agents/runner.ts` is a hand-written tool-use loop on top of `@anthropic-ai/sdk` — NOT the SDK's `client.beta.messages.toolRunner`. Why: needed to short-circuit on "proposal" tools (`ask_clarification`, `propose_subtasks`) that surface their input to the client without continuing the LLM round. Wrote the test (3 cases: complete, proposal short-circuit, step cap) first; ran to confirm failure; implemented; all 3 pass + Task 5's 8 still green.
- `src/lib/sse.ts` defines the event taxonomy used by the agent endpoints + the UI: `text_delta | tool_use | tool_result | needs_clarification | final | error | done`.
- `src/agents/tools.ts`: `AgentTool<I>` type + `toAnthropicTool` adapter using zod v4's built-in `z.toJSONSchema`.
- `src/lib/anthropic.ts` is the SDK singleton — throws `"ai_not_configured"` if `ANTHROPIC_API_KEY` is missing so route handlers can map to HTTP 503.

## 2026-05-26 — Task 10: Task drawer

- `components/task-drawer.tsx` is now a side `Sheet` with: editable title/description (commit on blur), Status + Priority selects (commit on change), Subtasks checklist, Notes timeline + Add-note textarea, Decompose-with-AI button (opens placeholder dialog from Task 13), Delete with confirm.
- `components/decompose-dialog.tsx` added as a placeholder dialog — replaced fully in Task 13. Keeps the drawer compilable in the meantime.
- Confirmed compile + render 200 against the seeded DB.
- No base-ui API adaptations needed for this task: `Sheet`/`SheetContent`/`SheetHeader`/`SheetTitle` and `Select`/`onValueChange` all matched the plan exactly. Task 9 already established the `render={}` pattern for `DialogTrigger`; the plan code for Task 10 does not use `asChild` at all so no substitutions were required.

## 2026-05-26 — Task 9: Task list UI

- Main `app/page.tsx` is a server component shell with a `<TaskList>` client child handling state.
- `components/task-list.tsx` owns the status tabs (All/Todo/In progress/Done), sort select (Priority/Newest/Oldest), and the open-drawer id. Skeleton + empty state covered.
- `components/task-row.tsx` renders one row: priority badge, title (button to open), age, inline status `<Select>` that mutates via `useUpdateTask`.
- `components/task-create-dialog.tsx` is a small modal form (title, description, priority) using `useCreateTask`. Uses Base UI's `render` prop on `DialogTrigger` (not `asChild`) since this shadcn setup uses `@base-ui/react/dialog`.
- `components/task-drawer.tsx` is an intentional stub (`return null`) so the build stays green — replaced fully in Task 10.

## 2026-05-26 — Task 8: TanStack Query + hooks

- `src/lib/api-client.ts` is a thin typed fetch wrapper around `/api/tasks` — single `request<T>` helper threads error messages out of the API's `{error:{message}}` envelope.
- `app/providers.tsx` mounts the React Query client (10s staleTime, no refetchOnWindowFocus) — wired in `app/layout.tsx` around `{children}`.
- `src/hooks/use-tasks.ts` exposes `useTasks`, `useTask`, `useCreateTask`, `useUpdateTask`, `useDeleteTask`, `useAddNote`. Mutations invalidate the `["tasks"]` cache + surface errors via Sonner toasts.
- Note query key uses `["tasks","detail","none"]` when no id — keeps queryFn typed without conditional types.

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

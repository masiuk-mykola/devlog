# AGENT_LOG

Honest log of how this project was built with Claude Code. Newest entry on top.

## Note — Code review after the RHF refactor

Ran `/code-review` against the uncommitted diff (font swap, status-based row colors, equal-width priority chip column, Select label render-fn fix, RHF migration of three forms, three new form components). Result: **0 CRITICAL, 0 HIGH, 4 MEDIUM, 2 LOW** — nothing blocking.

**MEDIUM findings (worth fixing before commit):**

1. `task-row.tsx` — `[&_button]:line-through` is too broad: it also strikes through the Base UI `SelectTrigger` (which is rendered as a `<button>`), so the "Done" dropdown label appears struck out. Move `line-through` onto the title button directly.
2. `clarification-form.tsx` — `<Label>` has no `htmlFor`, `<Input>` has no `id`. Clicking the question label does not focus the input. Bind them with a stable id (`clarif-${i}`).
3. `subtask-edit-form.tsx` — title `<Input>` has no associated label at all. Screen readers hear "edit, text" with no semantic. Add `aria-label="Subtask N title"`.
4. All four forms (`task-create-dialog`, `clarification-form`, `subtask-edit-form`, `add-note-form`) — error `<p>` elements lack `role="alert"`/`aria-live`, so validation failures aren't announced. Mark each error paragraph as a live region.

**LOW findings:**

5. `clarification-form.tsx` — `key={q}` would collide if the agent ever returned two identical questions. Switch to `key={i}` (positional, never reorders within one render).
6. `subtask-edit-form.tsx` / `clarification-form.tsx` — `useEffect(() => form.reset({...}), [initialItems])` would wipe in-progress edits if a parent ever passed a freshly-constructed array each render. Current parent (`decompose-dialog`) only assigns from a final agent event, so the reference is stable — but the contract is fragile. Document or shallow-compare before resetting.

**Other categories — clean:** no hardcoded secrets, no SQL/XSS surface, no `dangerouslySetInnerHTML`, no path traversal; all forms validate at the boundary via Zod; no `console.log`, no `any`, no TODOs/FIXMEs; functions all <50 LOC; files all <100 LOC; no `eslint-disable` rules added by this diff.

**No new tests added** for the form components — consistent with the documented stance in the reflection section ("no UI tests"). The validation logic itself is covered by the Zod schemas, which are unit-testable in isolation if/when component tests come in.

## Note — TaskCreateDialog: from ad-hoc useState to RHF + Zod

The "New task" dialog originally wasn't a form at all. It was three `useState` hooks (`title`, `description`, `priority`), a free-floating `<div>` of inputs, and an `onClick={submit}` handler that did `if (!title.trim()) return;` as the only validation. No `<form>` element, no submit semantics, no field-level errors, no schema — just a small modal that happened to call a mutation. At three fields it worked, but it was already accumulating subtle problems: Enter-to-submit didn't work (no form), the empty-title check was silent (nothing told the user *why* the button did nothing), and the validation rules drifted from the API's Zod schema since the UI didn't reference it.

We refactored it to **react-hook-form + @hookform/resolvers + zod**:

- A `FormSchema` derived from the existing `PriorityEnum` defines the UI-side contract with real error messages ("Title is required", "Max 200 characters", "Max 2000 characters" for description).
- `useForm({ resolver: zodResolver(FormSchema) })` replaces three `useState` calls. `form.register(...)` wires native inputs; a `<Controller>` wraps the Base UI `<Select>` because it's a controlled component (this also silences the React Compiler warning about `form.watch()` being non-memoizable).
- The markup is now a real `<form onSubmit={form.handleSubmit(onSubmit)}>` — Enter submits, the browser treats it as a form, `noValidate` keeps the styling consistent with our error UI.
- Errors render under each field with `aria-invalid` on the input. The submit button disables itself while `form.formState.isSubmitting || create.isPending` — closing one race where double-clicking could fire two mutations.
- `form.reset(DEFAULTS)` runs on both successful submit and dialog close, so reopening always shows a clean form.

**Why this is better now**

- One source of truth for shape and rules — the schema. Adding `dueDate` later is one new line in `FormSchema`, one new field, one new register call. No drift between "what the form lets you submit" and "what the API accepts".
- Real, accessible error UX — screen readers see `aria-invalid`, sighted users see the message under the bad field, instead of a button that silently does nothing.
- Submit is now uncontrolled per-field — fewer re-renders on every keystroke, which matters once the dialog has 6–10 fields.
- The `<form>` element earns us Enter-to-submit, browser autofill semantics, and `formState.isSubmitting` to gate the button without an extra `isLoading` ref.

**Why this matters as the project grows**

- The next forms (edit-task panel, settings, the decompose-confirmation flow) can lift the same pattern: a UI schema next to the component, `zodResolver`, `<Controller>` for any non-native input. No bespoke `useState` soup per form.
- Cross-field validation (e.g., "due date must be after start date", "if priority is high, description required") becomes a `.refine(...)` on the schema rather than imperative checks scattered through handlers.
- Server-side errors can be surfaced into the form via `form.setError("title", { message })` — once we wire `useCreateTask`'s rejection to that, the same field-level UI handles both client and server failures, instead of leaning on a toast for everything.
- Async validation (e.g., a uniqueness check) plugs in via the resolver without restructuring the component.
- Testing is easier: the schema is unit-testable in isolation; the form's reset/submit behaviour is observable via `form.formState` without poking at internal `useState`.

The cost was two small deps (~30 KB combined, tree-shakeable) and a 30-line component growing to ~80 lines. Worth it before the third form lands and we'd be tempted to copy-paste the useState pattern.

## Note — Why no axios

The HTTP client in `src/lib/api-client.ts` is plain `fetch`. axios was deliberately not added:

- **Same-origin Next.js** — frontend and API live on the same host (`/api/tasks/...`). No CORS, no baseURL, no auth headers to inject — none of the usual reasons to reach for axios apply.
- **Native `fetch` in React 19 / Next 16** — first-class, integrates with the Next cache, no polyfill needed. Adding axios would mean ~13 KB of bundle for zero new capability.
- **React Query owns the rest** — retry, dedup, caching, mutations, invalidation all live at the TanStack Query layer, not the HTTP client. Axios interceptors would have nowhere meaningful to plug in.
- **A 10-line `request<T>()` helper** (`api-client.ts:5-15`) already covers JSON serialization, typed responses, and unwrapping the `{error:{message}}` envelope — that's the whole "wrapper" axios would otherwise provide.

axios would be the right call if this project had multiple API domains with different baseURLs/auth, complex interceptor chains (refresh-token flows, tracing), upload-progress requirements, or a legacy-browser target. None of those apply here.

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

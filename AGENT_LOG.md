# AGENT_LOG

Honest log of how this project was built with Claude Code. Newest entry on top.

## Note — UI improvements batch (15 items) verified live with Playwright

After the RHF refactor and the a11y/`set-state-in-effect` cleanup, I went through 15 targeted UI improvements in one batch — no mobile responsiveness work, deliberately scoped to desktop-first polish. Everything was driven and verified through the **Playwright MCP** (`mcp__plugin_playwright_playwright__browser_*`) in a real browser against the running dev server, not just typecheck/tests.

**What changed (grouped):**

- **List header & filters** — task counts on status tabs (`All 7 / Todo 4 / In progress 2 / Done 1`); search input with `/` keyboard hint; sort + status + search + open-task all live in URL state via `useSearchParams` (`?status=todo&sort=priority&q=foo&open=<id>`); reload preserves state, links are shareable. `useTasks()` consolidated to one fetch-all query; filter/sort/counts derived client-side.
- **Optimistic mutations** — `useUpdateTask` and `useDeleteTask` patch the list and detail caches in `onMutate`, snapshot for rollback in `onError`, invalidate in `onSettled`. Clicking the status select per row now updates the row and tab counts instantly with no perceptible request lag.
- **Task row polish** — stale dot (amber 8×8) for `in_progress` tasks older than 72h via new `isStale()` in `src/lib/time.ts`; `Done` rows muted (transparent bg + `opacity-60`) instead of vibrant emerald; `line-through` scoped to the title button only (no more bleed onto the SelectTrigger).
- **Drawer rewrite** — title + description now run through react-hook-form with an explicit **Save** button, an "Unsaved changes" / "All changes saved" microcopy line, and `disabled` gating on `!isDirty || isPending`. Status + priority remain instant-commit selects. Manual `+ Add subtask` inline form added (was only AI-decomposer before). Notes timestamps switched to `relativeTime()` (extracted from `task-row.tsx` into `src/lib/time.ts`).
- **Delete confirmation** — replaced the native `confirm()` with a shadcn `Dialog` showing the task title in the message ("This permanently removes "X" and all its subtasks and notes"). Optimistic delete from list + rollback on error.
- **Agent transcript** — replaced raw `tool: list_tasks` + JSON dumps with user-facing bullets: `• Reading your tasks…`, `• Checking task age…`, `• Looking at what shipped recently…`. JSON kept inside `<details>` but collapsed and de-emphasised. `tool_result` events suppressed entirely from the transcript view since the matching `tool_use` bullet covers them.
- **Standup digest** — new `<SlackMarkdown>` renderer (`components/slack-markdown.tsx`, ~40 lines, no extra deps) that handles `*bold*`, `_italic_`, `` `code` ``, and `- ` bullets line-by-line. The agent's Slack mrkdwn output now shows as actual structured markup (bold section headers, code chips, bulleted lists), not a `<pre>` plain-text dump.
- **Panel UX** — `Prioritize my day` promoted to `default` (primary) variant; `Draft standup` stays `outline`. Both agent panels gained a **Rerun** button visible once the run completes. `PrioritizePanel` now navigates to `?open=<id>` directly instead of needing `onPickTask` prop drilling from `app/page.tsx`.
- **Keyboard** — `N` opens the New-task dialog (self-listening inside `TaskCreateDialog`, skips when focus is in any input/textarea/contentEditable). `/` focuses the search input (`TaskList` listens). Both have visible affordances (`title="New task (N)"` on the button, `Search…  /` placeholder).

**Verified flows in Playwright** (browser-driven, snapshot-based, against real dev server):

1. Search input fills with "flaky" → URL becomes `?q=flaky` → list collapses to one row (`Investigate flaky CI on PR-checks workflow`).
2. Press `N` from a focused body → New-task dialog opens with title input auto-focused.
3. Click a task title → drawer opens, URL becomes `?open=gPfjTBxNxL`, Save button is `[disabled]` with "All changes saved" microcopy. Edit title → microcopy switches to "Unsaved changes", Save activates. Click Save → returns to disabled/"All changes saved". 
4. Click Delete task → AlertDialog opens with the task title interpolated into the body. Cancel closes the dialog.
5. Change status select on a `Todo` row to `In progress` → tab counts flip from `Todo 4 / In progress 2` to `Todo 3 / In progress 3` instantly (optimistic), no spinner.
6. Click Prioritize my day → modal opens, transcript bullets stream (`• Reading your tasks…`, `• Checking task age…` twice for two stuck tasks), final markdown renders, Rerun button appears.
7. Click Draft standup → transcript streams, final block renders as structured Slack mrkdwn (bold `*blockers*` headers, inline `code` chips, `<ul>` bullets), Rerun + Copy buttons present.

**What didn't get tested in browser** (not because flaky — because data didn't allow):

- Stale amber dot: seed tasks are all 19h old, threshold is 72h. Code path covered by unit logic (`isStale` is just `Date.now() - parsed > 72*3600000`), behaviour will fire when data ages.
- Notes relative time: seed contains zero notes. `relativeTime` is the same helper that's been in `task-row.tsx` for weeks; just relocated and reused.

**Verification commands run between batches:**

- `npm run typecheck` — clean throughout.
- `npm run test` — 11/11 passing (8 repository + 3 runner); no test changes needed since UI work didn't touch DB or agent runner.
- `npm run build` — clean, after wrapping `PrioritizePanel` in `<Suspense>` (it now reads `useSearchParams()` to construct `?open=` links). Build catches Suspense-boundary issues that `tsc` cannot.
- `npx eslint <changed paths>` — clean.

**What I deliberately did not do:**

- **Mobile responsiveness** — explicitly out of scope per the user request for this pass. Header buttons + filter row + task rows likely overflow at <420px and would need a separate iteration.
- **`AlertDialog` as a shadcn primitive** — used a regular `Dialog` with explicit destructive button styling. Adding a dedicated `AlertDialog` component would be cleaner but is one more file for the same visual outcome.
- **Debounce on the search input** — every keystroke writes to URL and triggers a render. The data is in-memory and small (single-user); 50 tasks at 60 wpm is nothing. Premature optimisation.
- **Search highlighting** — match the substring inside the row. Nice-to-have, not load-bearing for the feature.
- **Standup markdown as a real lib** (`react-markdown` etc.) — Slack mrkdwn is its own dialect (`*bold*` not `**bold**`, no headings, no tables). Pulling a CommonMark renderer would be wrong syntax and ~30 KB; a 40-line custom parser fits the actual output shape exactly.

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

# DevLog — Design Spec

**Date:** 2026-05-26
**Status:** Approved for implementation planning
**Source:** `HW AI (2).pdf` (assignment brief, in repo root)

---

## 1. Purpose

DevLog is a single-user task tracker for an engineering team with an embedded AI layer that removes the friction of "what do I work on next," "break this task down for me," and "draft today's standup." The product half is deliberately small — the AI agents are the differentiator and the part being evaluated. Scope target: 8–10 hours of build time.

## 2. Stack (locked)

- **Framework:** Next.js 15 (App Router) + TypeScript
- **Backend:** Next.js Route Handlers (no separate Express process)
- **Database:** SQLite via `better-sqlite3` (synchronous, file-based)
- **LLM:** Anthropic Claude (`claude-sonnet-4-6`) via `@anthropic-ai/sdk`
- **Styling/components:** Tailwind v4 + shadcn/ui (generated into repo)
- **Client state:** TanStack Query for server-state caching + optimistic updates
- **Validation:** Zod, shared between Route Handlers and agent tool schemas
- **Tests:** Vitest (one repository test + one agent-runner test, intentionally minimal)

## 3. Architecture

### 3.1 Process model
Single Next.js process. CRUD routes hit SQLite synchronously. Agent routes return a `ReadableStream` (SSE-style) so the UI can render the agent thinking as it streams. No background workers, no queues — the assignment is one user / one team and the agents are short-running.

### 3.2 Directory layout
```
app/
  layout.tsx
  page.tsx                    # task list (server component shell)
  api/
    tasks/
      route.ts                # GET (list), POST (create)
      [id]/route.ts           # GET, PATCH, DELETE
      [id]/notes/route.ts     # POST (append note)
    agents/
      prioritize/route.ts     # streaming
      decompose/route.ts      # streaming
      standup/route.ts        # streaming
src/
  db/
    client.ts                 # better-sqlite3 singleton
    migrations.ts             # schema bootstrap (idempotent)
    repository.ts             # all DB access fns (no inline SQL in routes)
    seed.ts                   # runnable via `npm run seed`
  agents/
    runner.ts                 # generic Anthropic tool-use loop
    prioritize.ts             # prompt + tool defs for agent 1
    decompose.ts              # prompt + tool defs + clarification flow
    standup.ts                # prompt + tool defs for agent 3
  lib/
    anthropic.ts              # SDK client + SSE helpers
    sse.ts                    # ReadableStream helpers (encoder, framers)
  schemas/
    task.ts                   # zod schemas shared by API + agent tools
components/
  ui/                         # shadcn/ui generated primitives
  task-list.tsx
  task-row.tsx
  task-drawer.tsx
  prioritize-panel.tsx
  decompose-dialog.tsx
  standup-panel.tsx
  agent-stream.tsx            # shared SSE consumer + transcript renderer
```

### 3.3 Boundary rules
- UI components NEVER import from `src/db/` or `src/agents/`. They go through HTTP via TanStack Query hooks.
- Agents NEVER touch the DB directly. They emit *proposed* mutations as tool calls; the Route Handler decides what to persist or streams the proposal to the client for explicit user confirmation.
- All DB access goes through `src/db/repository.ts` — no inline SQL in route handlers.

## 4. Data model

### 4.1 SQLite schema
```sql
CREATE TABLE tasks (
  id           TEXT PRIMARY KEY,         -- nanoid
  title        TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  status       TEXT NOT NULL CHECK (status IN ('todo','in_progress','done')),
  priority     TEXT NOT NULL CHECK (priority IN ('low','medium','high')),
  parent_id    TEXT REFERENCES tasks(id) ON DELETE CASCADE,
  created_at   INTEGER NOT NULL,         -- unix ms
  updated_at   INTEGER NOT NULL,
  completed_at INTEGER                    -- nullable, set when status -> done
);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_parent ON tasks(parent_id);

CREATE TABLE task_notes (
  id         TEXT PRIMARY KEY,
  task_id    TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
```

### 4.2 Modeling choices
- **Subtasks live in the same `tasks` table** via self-referencing `parent_id`. One model, one CRUD surface. List view filters `parent_id IS NULL`.
- **`task_notes` is a separate table** so status-update / standup agents can query free-form completion notes with timestamps cheaply.
- **`completed_at` distinct from `updated_at`** so the prioritizer can reason about staleness ("in_progress for 6 days") without conflating it with edits.
- **Timestamps stored as unix ms** internally for cheap date math; API layer serialises to ISO 8601 strings.
- **No users / teams / tags / due-dates / assignees** — explicitly out of scope.

### 4.3 Zod schemas
`src/schemas/task.ts` exports `TaskSchema`, `CreateTaskSchema`, `UpdateTaskSchema`, `NoteSchema`. These describe the **API-facing shape** (timestamps as ISO 8601 strings). `src/db/repository.ts` is the only place that converts between DB rows (unix-ms `INTEGER`) and the API shape — keeping that conversion in one file. Schemas are reused by (a) Route Handler request validation and (b) agent tool input/output validation. Single source of truth for the wire format.

## 5. AI agents

The assignment is explicit: these must be real agents (multi-step, contextual, with autonomous decision points), not one-shot LLM calls. Each agent below earns that label.

### 5.1 Generic runner — `src/agents/runner.ts`
A small harness around the Anthropic SDK that:
1. Sends system prompt + user message + tool definitions.
2. If response has `tool_use` blocks, executes each tool (read-only DB queries plus a few "proposal" tools), feeds `tool_result` back, continues the loop.
3. Stops on `end_turn` OR after a hard step cap of **6** iterations (prevents runaway loops; surfaces a clean `agent_step_cap_exceeded` error if hit).
4. Streams `text_delta`, `tool_use`, `tool_result`, `final`, `done` events to the client over SSE.

### 5.2 Agent 1 — Prioritizer (`POST /api/agents/prioritize`)
**Tools available to the model:**
- `list_tasks({status?, limit?})` — reads from DB
- `get_task_age({id})` — returns `{hoursSinceCreated, hoursSinceStatusChange}`

**Loop:** reads all open tasks → optionally inspects age for stuck items → produces ranked top-N with one-sentence justifications + a single "start here" pick.

**Why it's agentic:** doesn't trust priority alone. Considers age, status, and "stuck" signals before deciding. Tool round-trips are visible in the stream.

**Final payload (`event: final`):**
```json
{
  "startHere": { "taskId": "...", "title": "...", "reason": "..." },
  "ranked": [
    { "taskId": "...", "title": "...", "rank": 1, "reason": "..." }
  ]
}
```

### 5.3 Agent 2 — Decomposer (`POST /api/agents/decompose`)
**Request:** `{ taskId: string, clarificationAnswers?: Record<string,string> }`

**Tools:**
- `get_task({id})` — fetch the task
- `ask_clarification({questions: string[]})` — special "proposal" tool: routes its output to the client as `event: needs_clarification` and ends the stream cleanly. The client UI prompts the user; on submission, the client re-invokes the endpoint with `clarificationAnswers` populated and the agent continues.
- `propose_subtasks({items: [{title, description, priority}]})` — emits `event: final` with the proposed subtasks. The client renders an editable checklist and POSTs each to `/api/tasks` (with `parent_id` set) after user confirmation.

**Loop:** reads task → heuristic check: if description is short OR title contains vague verbs ("refactor", "improve", "investigate", "look into") without specifics → calls `ask_clarification` first → otherwise jumps to `propose_subtasks`.

**Why it's agentic:** has a real branching decision point. The clarification path is a genuine second turn — user answers, model re-runs with new context, then commits.

### 5.4 Agent 3 — Standup digest (`POST /api/agents/standup`)
**Request:** `{ sinceHours?: number }` (default 24)

**Tools:**
- `list_tasks({status?})`
- `list_notes({sinceMs})`
- `get_completed_since({sinceMs})`

**Loop:** synthesises (1) what shipped, (2) what's in flight, (3) what's stuck (no status change > 3 days), (4) recent notes → drafts a Slack-style standup with four sections: **Shipped / In flight / Blockers / Heads-up**. Tone: terse, lowercase, no fluff.

**Why it's agentic:** synthesises across multiple data sources, makes judgment calls about "stuck" and "noteworthy," produces a single artifact. Visibly multi-step in the stream.

**Final payload:** `{ markdown: string }` (Slack-mrkdwn-compatible)

## 6. API surface

### 6.1 CRUD
| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/api/tasks?status=&sort=` | — | `Task[]` (top-level only) |
| POST | `/api/tasks` | `CreateTaskSchema` | `Task` |
| GET | `/api/tasks/:id` | — | `Task & { subtasks: Task[], notes: Note[] }` |
| PATCH | `/api/tasks/:id` | `UpdateTaskSchema` (partial) | `Task` |
| DELETE | `/api/tasks/:id` | — | `{ ok: true }` (cascades to children) |
| POST | `/api/tasks/:id/notes` | `{ body: string }` | `Note` |

Sort options: `priority` (high→low), `newest`, `oldest`. Filter `status` accepts `todo|in_progress|done|all`.

### 6.2 Agents (all SSE, `Content-Type: text/event-stream`)
| Path | Body | Stream events |
|---|---|---|
| `POST /api/agents/prioritize` | `{}` | `text_delta`, `tool_use`, `tool_result`, `final`, `done` |
| `POST /api/agents/decompose` | `{ taskId, clarificationAnswers? }` | same + possibly `needs_clarification` |
| `POST /api/agents/standup` | `{ sinceHours? }` | same |

## 7. UI

Four surfaces, single-page app.

### 7.1 `/` — Task list (main screen)
- Header: app title, **"Prioritize my day"** button, **"Draft standup"** button.
- Filter bar: status tabs (All / Todo / In progress / Done), sort dropdown (Priority / Newest / Oldest), "+ New task" button.
- Task list rows: title, priority badge, status pill (clickable for inline change), age ("2d ago"), child-count badge if subtasks exist. Clicking a row opens the drawer.
- Empty state: copy + "Create your first task" CTA. (Sample data populated out-of-band via `npm run seed` — README documents this so reviewers can demo immediately.)

### 7.2 Task drawer (right-side slide-over, not a route)
- Editable title, description, status, priority.
- Subtasks section (collapsible) — inline checkboxes that PATCH status.
- Notes timeline — list of past notes + textarea + "Add note".
- **"Decompose with AI"** button → opens decomposer dialog.
- Delete button (with confirm dialog).

### 7.3 Prioritizer panel (modal / sheet)
- Triggered from header.
- Streams: tool-call pills (collapsible "🔧 list_tasks → 12 results"), text bubbles for reasoning.
- Final card: "Start with → [Task title]" prominent + ranked list of up to 5 with one-line justifications. Clicking a ranked item opens its drawer.

### 7.4 Standup digest panel (modal / sheet)
- Triggered from header.
- "Since:" selector (24h / 3d / 7d).
- Streams the agent working, then renders a formatted Slack-ready block with **Copy** button.

### 7.5 Decomposer flow detail
1. User clicks "Decompose with AI" in task drawer.
2. Dialog opens; agent streams in shared transcript view.
3. **Branch A** — agent calls `propose_subtasks` → dialog shows editable checklist of proposed subtasks (title editable, priority dropdown, deletable rows) → "Create all" POSTs each as a new task with `parent_id` set.
4. **Branch B** — agent calls `ask_clarification` → dialog renders the questions as text inputs → user submits → client re-invokes `/api/agents/decompose` with the same `taskId` plus `clarificationAnswers` → stream resumes from a fresh agent turn → typically results in Branch A.

## 8. Error handling

- **API:** every Route Handler wrapped in `withErrorHandler(fn)` that catches, logs (`console.error`), returns `{ error: { code, message, details? } }` with appropriate HTTP status. Zod errors → 400 with field details. SQLite constraint violations → 409. Unknown → 500.
- **Agent endpoints mid-stream errors:** emit a final `event: error` SSE frame with `{ code, message }` and close cleanly. Never leave the stream hanging.
- **Missing `ANTHROPIC_API_KEY`:** agent endpoints return 503 with body `{ error: { code: 'ai_not_configured', message: 'Set ANTHROPIC_API_KEY in .env' } }`. UI shows an inline banner instead of a toast.
- **Anthropic API failures (rate limit / network):** agent panel surfaces a retryable error state with a "Retry" button. No automatic retries — the user is in the loop.
- **Step cap exceeded:** runner emits `event: error` with code `agent_step_cap_exceeded`. No silent truncation, no partial commits.
- **Client-side:** TanStack Query mutation `onError` surfaces toasts via shadcn/ui Sonner.

## 9. Environment

### 9.1 `.env.example`
```
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-4-6
DATABASE_PATH=./data/devlog.db
```

### 9.2 Scripts (`package.json`)
- `dev` — `next dev`
- `build` — `next build`
- `start` — `next start`
- `seed` — `tsx src/db/seed.ts` (populates a few sample tasks for review demo)
- `test` — `vitest run`
- `lint` — `next lint`
- `typecheck` — `tsc --noEmit`

### 9.3 Bootstrap
On Route Handler cold-start, `src/db/client.ts` runs `migrations.ts` (idempotent `CREATE TABLE IF NOT EXISTS`) so the DB file initialises itself on first request — reviewers don't need a separate migration command.

## 10. Testing (deliberately minimal)

Documented in README as a conscious cut for scope:

- `src/db/repository.test.ts` — integration test against a temp DB: create → list with filters → cascade delete.
- `src/agents/runner.test.ts` — Anthropic client mocked: verifies the tool-call loop terminates, calls tools in order, and respects the step cap.

No UI tests, no Playwright. Manual verification of UI flows + a brief AGENT_LOG note documenting that decision.

## 11. Scope budget (~8 hours)

1. Scaffold (Next.js + Tailwind + shadcn) + DB layer + CRUD API — **~2h**
2. Task list UI + drawer + filter/sort — **~2h**
3. Anthropic SDK wiring + agent runner harness + streaming plumbing — **~1.5h**
4. Three agents (prompts + tools + UI panels) — **~2h**
5. Polish + AGENT_LOG + README + `.env.example` + smoke tests — **~0.5h**

## 12. Explicitly out of scope

Documented in README under "What I didn't build and why":
- Authentication / multi-user / teams
- Real-time sync (no WebSockets / no Liveblocks)
- Drag-and-drop reordering (status is the order signal)
- Tags, labels, due dates, assignees
- Kanban / calendar views
- Notifications, webhooks, integrations
- Comprehensive test coverage (one repo + one agent runner test only)
- Deployment configuration (local-only per assignment)
- The fourth optional AI agent variant — three is enough to demonstrate range

## 13. Deliverables

Mirroring the assignment's "What to ship" section:

- `README.md` — run instructions, architecture overview, storage choice + limits, AI provider notes, deliberate cuts.
- `AGENT_LOG.md` — kept up to date through the build, not retro-written. Records what Claude scaffolded, what I changed by hand, where it went sideways.
- `.env.example` — keys above, no real values.
- `npm install && npm run dev` works without manual steps.
- Optional Loom — deferred unless time remains.
